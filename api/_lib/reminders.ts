import type { CalendarEventRow } from '../../src/types/database.js'
import { addDays, taipeiMinutes, taipeiYmd } from '../../src/utils/dateRange.js'
import { eventToView, expandYearly } from '../../src/utils/calendar/eventSources.js'
import { isActiveTrip, tripStart } from '../../src/utils/nextTrip.js'
import { HttpError, json } from './http.js'

// 每日提醒：前一晚彙總「明天的事」推播給每位訂閱者。純邏輯（明天範圍、摘要文字）與 IO 分開，方便測試。

export const PACK_LIST_TITLE = '露營要帶'
const MAX_LINES = 5

export interface ReminderTrip {
  id: number
  trip_date: string
  duration_days: number | null
  status: string | null
  night_rush: boolean | null
  merged_into_id: number | null
  user_id: string | null
  family_id: string | null
  campsite_name: string | null
  campsites?: { name: string } | null
}

export interface Subscription {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
}

export interface ProfileLite {
  id: string
  family_id: string | null
}

export interface Summary {
  title: string
  body: string
}

// 台北時間的「明天」：用 YMD 字串運算，不依賴系統 TZ
export function tomorrowTaipei(now: Date): string {
  return addDays(taipeiYmd(now), 1)
}

const hhmm = (iso: string) => {
  const m = taipeiMinutes(iso)
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

// 明天有出現的事件文字：一般事件（含跨天）、每年重複事件（含「第 N 年」）；當天開始的定時事件加上開始時間
export function eventLinesForDay(events: CalendarEventRow[], day: string): string[] {
  const lines: Array<{ key: string; text: string }> = []
  for (const e of events) {
    const v = eventToView(e, new Map(), day)
    const hits =
      e.recurrence === 'yearly' && v.allDay
        ? expandYearly(v, day, day, day)
        : v.startDate <= day && day <= v.endDate
          ? [v]
          : []
    for (const h of hits) {
      const timed = !h.allDay && h.startDate === day
      const time = timed ? hhmm(e.start_time) : ''
      lines.push({ key: time, text: timed ? `${time} ${h.title}` : h.title })
    }
  }
  // 全天（key 空字串）在前，之後依時間
  return lines.sort((a, b) => a.key.localeCompare(b.key)).map((l) => l.text)
}

export function tripLinesForDay(trips: ReminderTrip[], day: string, openItems: number): string[] {
  const out: string[] = []
  for (const t of trips) {
    if (!isActiveTrip(t) || tripStart(t) !== day) continue
    const name = [t.campsites?.name, t.campsite_name].map((s) => s?.trim()).find(Boolean) || '露營'
    out.push(`明天出發：${name}`)
  }
  if (out.length > 0 && openItems > 0) out.push(`還有 ${openItems} 項沒帶`)
  return out
}

// 沒有任何事回 null（不發）。行程放前面，最多 5 行，其餘折成「…還有 N 項」
export function buildSummary(i: { events: CalendarEventRow[]; trips: ReminderTrip[]; openItems: number; day: string }): Summary | null {
  const lines = [...tripLinesForDay(i.trips, i.day, i.openItems), ...eventLinesForDay(i.events, i.day)]
  if (lines.length === 0) return null
  const shown = lines.slice(0, MAX_LINES)
  if (lines.length > MAX_LINES) shown.push(`…還有 ${lines.length - MAX_LINES} 項`)
  return { title: '明天的提醒', body: shown.join('\n') }
}

export interface ReminderDb {
  listSubscriptions(): Promise<Subscription[]>
  listProfiles(userIds: string[]): Promise<ProfileLite[]>
  // 回傳全部事件，可見範圍由 runReminders 依 RLS 規則過濾
  listEvents(): Promise<CalendarEventRow[]>
  listTrips(day: string): Promise<ReminderTrip[]>
  // 每個家庭「露營要帶」清單的未完成項目數
  openPackItems(familyIds: string[]): Promise<Map<string, number>>
  deleteSubscriptions(ids: string[]): Promise<void>
  markSuccess(ids: string[], at: string): Promise<void>
}

export type SendFn = (
  sub: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string,
  topic: string,
) => Promise<void>

export interface ReminderDeps {
  db: ReminderDb
  send: SendFn
  now?: () => Date
  cronSecret?: string
}

export interface ReminderResult {
  day: string
  subscriptions: number
  sent: number
  skipped: number
  removed: number
  failed: number
}

// 404／410：訂閱已失效；401／403：推播服務拒絕（VAPID 金鑰換過，舊訂閱永遠無法送達），都該刪
const isGone = (e: unknown) => {
  const s = (e as { statusCode?: number } | null)?.statusCode
  return s === 404 || s === 410 || s === 401 || s === 403
}

export async function runReminders(deps: ReminderDeps): Promise<ReminderResult> {
  const now = deps.now ?? (() => new Date())
  const day = tomorrowTaipei(now())
  const subs = await deps.db.listSubscriptions()
  const result: ReminderResult = { day, subscriptions: subs.length, sent: 0, skipped: 0, removed: 0, failed: 0 }
  if (subs.length === 0) return result

  const userIds = [...new Set(subs.map((s) => s.user_id))]
  const profiles = new Map((await deps.db.listProfiles(userIds)).map((p) => [p.id, p.family_id]))
  const [events, trips] = await Promise.all([deps.db.listEvents(), deps.db.listTrips(day)])
  const familyIds = [...new Set([...profiles.values()].filter((f): f is string => !!f))]
  const openByFamily = familyIds.length > 0 ? await deps.db.openPackItems(familyIds) : new Map<string, number>()

  const gone: string[] = []
  const ok: string[] = []
  for (const userId of userIds) {
    const mine = subs.filter((s) => s.user_id === userId)
    try {
      const fam = profiles.get(userId) ?? null
      // 與 RLS 一致：自己的事件＋同家庭的 shared；行程：自己的或同家庭的
      const myEvents = events.filter(
        (e) => e.created_by === userId || (e.visibility === 'shared' && fam != null && e.family_id === fam),
      )
      const myTrips = trips.filter((t) => t.user_id === userId || (fam != null && t.family_id === fam))
      const summary = buildSummary({ events: myEvents, trips: myTrips, openItems: fam ? (openByFamily.get(fam) ?? 0) : 0, day })
      if (!summary) {
        result.skipped += mine.length
        continue
      }
      // tag／topic 以日期固定：同一天重複跑 cron，通知與推播服務端都是取代而不是疊加
      const tag = `reminder-${day}`
      const payload = JSON.stringify({ ...summary, url: '/', tag })
      for (const s of mine) {
        try {
          await deps.send({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, tag)
          ok.push(s.id)
          result.sent++
        } catch (e) {
          if (isGone(e)) {
            gone.push(s.id)
            result.removed++
          } else {
            result.failed++
            console.error('reminders: send failed', s.id, e)
          }
        }
      }
    } catch (e) {
      result.failed += mine.length
      console.error('reminders: user failed', userId, e)
    }
  }
  // 清理與記錄失敗不影響已送出的結果
  if (gone.length > 0) await deps.db.deleteSubscriptions(gone).catch((e) => console.error('reminders: cleanup failed', e))
  if (ok.length > 0) await deps.db.markSuccess(ok, now().toISOString()).catch((e) => console.error('reminders: markSuccess failed', e))
  return result
}

// Vercel Cron 以 GET 帶 Authorization: Bearer ${CRON_SECRET}；沒設定 secret 一律拒絕（fail closed）
export async function handleReminders(req: Request, deps: ReminderDeps): Promise<Response> {
  const secret = deps.cronSecret
  if (!secret || req.headers.get('Authorization') !== `Bearer ${secret}`) throw new HttpError(401, 'Unauthorized')
  return json(200, await runReminders(deps))
}
