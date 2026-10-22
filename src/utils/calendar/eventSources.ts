import type { CalendarEventRow, CpblSchedule, EventCategory } from '../../types/database'
import { addDays, taipeiMinutes, taipeiYmd, tripRange } from '../dateRange'
import { isActiveTrip, type TripLike } from '../nextTrip'
import type { ViewEvent } from './viewEvent'
import { creatorNameFor, OWNER_COLOR, ownerOf } from './visibility'

// meId / names：判斷「誰新增」的副標；names 是家庭成員 id → 名稱
export interface ViewContext {
  meId: string | null
  names: Map<string, string>
}
const NO_CTX: ViewContext = { meId: null, names: new Map() }

export function isRakutenGame(g: { home_team_name: string; visiting_team_name: string }): boolean {
  return g.home_team_name.includes('樂天') || g.visiting_team_name.includes('樂天')
}

export function eventToView(
  e: CalendarEventRow,
  cats: Map<string, EventCategory>,
  today: string,
  ctx: ViewContext = NO_CTX,
): ViewEvent {
  const allDay = !!e.is_all_day
  // start_date 為 null（舊前端寫入或手動新增）時退回 start_time 的台北日期，事件不能消失
  const startDate = allDay ? (e.start_date ?? taipeiYmd(e.start_time)) : taipeiYmd(e.start_time)
  let endDate = allDay ? (e.end_date ?? taipeiYmd(e.end_time)) : taipeiYmd(e.end_time)
  if (endDate < startDate) endDate = startDate
  const cat = e.category_id ? cats.get(e.category_id) : undefined
  const owner = ownerOf(e.visibility)
  const v: ViewEvent = {
    key: `event:${e.id}`,
    source: 'event',
    sourceId: e.id,
    title: e.title,
    color: OWNER_COLOR[owner],
    owner,
    categoryId: e.category_id,
    allDay,
    startDate,
    endDate,
    past: endDate < today,
  }
  if (cat) v.categoryName = cat.name
  const creator = creatorNameFor(e, ctx.meId, ctx.names)
  if (creator) v.creatorName = creator
  if (!allDay) {
    v.startMin = taipeiMinutes(e.start_time)
    v.endMin = taipeiMinutes(e.end_time)
    // 剛好結束在隔天 00:00：算到前一天 24:00，不要在隔天產生 0 分鐘的幽靈項目
    if (v.endMin === 0 && endDate > startDate) {
      v.endDate = addDays(endDate, -1)
      v.endMin = 1440
      v.past = v.endDate < today
    }
  }
  return v
}

type TripSource = TripLike & {
  campsite_id: number | null
  campsite_name: string | null
  campsites?: { name: string } | null
}

export function tripToView(
  t: TripSource,
  campingCategoryId: string | null,
  today: string,
  campingCategoryName?: string,
): ViewEvent {
  const { start, end } = tripRange(t.trip_date, t.duration_days)
  const nightRush = !!t.night_rush
  const startDate = nightRush ? addDays(t.trip_date, -1) : start
  const title = [t.campsites?.name, t.campsite_name].map((s) => s?.trim()).find(Boolean) || '露營'
  const v: ViewEvent = {
    key: `trip:${t.id}`,
    source: 'trip',
    sourceId: t.id,
    title,
    color: OWNER_COLOR.family, // 露營行程一律視為全家
    owner: 'family',
    categoryId: campingCategoryId,
    allDay: true,
    startDate,
    endDate: end,
    past: end < today,
  }
  if (campingCategoryName) v.categoryName = campingCategoryName
  if (nightRush) v.nightRushDate = startDate
  return v
}

export function gameToView(g: CpblSchedule, today: string): ViewEvent {
  return {
    key: `cpbl:${g.id}`,
    source: 'cpbl',
    sourceId: g.id,
    title: `⚾ ${g.visiting_team_name} vs ${g.home_team_name}`,
    color: OWNER_COLOR.me, // 中職賽程一律視為「我」
    owner: 'me',
    categoryName: '桃猿賽程',
    categoryId: null,
    allDay: true,
    startDate: g.game_date,
    endDate: g.game_date,
    past: g.game_date < today,
  }
}

export interface FeedInput {
  events: CalendarEventRow[]
  trips: TripSource[]
  games: CpblSchedule[]
  categories: EventCategory[]
  showCpbl: boolean
  hiddenCategoryIds: Set<string>
  today: string
  ctx?: ViewContext
}

export function buildFeed(i: FeedInput): ViewEvent[] {
  const cats = new Map(i.categories.map((c) => [c.id, c]))
  // categories 含家人的分類（讓家人的全家事件能顯示分類名稱）；系統分類只認自己的
  const own = i.ctx?.meId ? i.categories.filter((c) => c.owner_id === i.ctx?.meId) : i.categories
  const byKey = (k: string) => own.find((c) => c.system_key === k)
  const camping = byKey('camping')
  const baseball = byKey('baseball')
  const personal = byKey('personal')
  const hidden = (id: string | null) => id != null && i.hiddenCategoryIds.has(id)

  const out: ViewEvent[] = []
  for (const e of i.events) {
    if (hidden(e.category_id ?? personal?.id ?? null)) continue
    out.push(eventToView(e, cats, i.today, i.ctx))
  }
  if (!hidden(camping?.id ?? null)) {
    for (const t of i.trips) {
      if (!isActiveTrip(t)) continue
      out.push(tripToView(t, camping?.id ?? null, i.today, camping?.name))
    }
  }
  if (i.showCpbl && !hidden(baseball?.id ?? null)) {
    // 已被使用者事件綁定的比賽，不再疊加，避免同一天重複
    const bound = new Set(i.events.map((e) => e.cpbl_game_id).filter((x): x is string => !!x))
    for (const g of i.games) {
      if (!isRakutenGame(g) || bound.has(g.id)) continue
      out.push(gameToView(g, i.today))
    }
  }
  return out.sort(
    (a, b) =>
      a.startDate.localeCompare(b.startDate) ||
      Number(b.allDay) - Number(a.allDay) ||
      (a.startMin ?? 0) - (b.startMin ?? 0) ||
      a.key.localeCompare(b.key),
  )
}
