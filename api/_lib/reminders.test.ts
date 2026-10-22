import { describe, it, expect, vi } from 'vitest'
import type { CalendarEventRow } from '../../src/types/database.js'
import { HttpError } from './http.js'
import {
  buildSummary,
  handleReminders,
  runReminders,
  tomorrowTaipei,
  type ReminderDb,
  type ReminderTrip,
  type SendFn,
  type Subscription,
} from './reminders.js'

const ev = (over: Partial<CalendarEventRow> & { id: string }): CalendarEventRow => ({
  category_id: null,
  color: null,
  cpbl_game_id: null,
  created_at: '2026-01-01T00:00:00Z',
  created_by: 'u1',
  description: null,
  end_date: null,
  end_time: '2026-10-23T10:00:00+08:00',
  event_type: null,
  family_id: null,
  is_all_day: true,
  recurrence: null,
  start_date: '2026-10-23',
  start_time: '2026-10-23T00:00:00+08:00',
  title: '事件',
  visibility: 'private',
  ...over,
})
const trip = (over: Partial<ReminderTrip> & { id: number }): ReminderTrip => ({
  trip_date: '2026-10-23',
  duration_days: 2,
  status: null,
  night_rush: false,
  merged_into_id: null,
  user_id: 'u1',
  family_id: null,
  campsite_name: '山上營地',
  campsites: null,
  ...over,
})
const DAY = '2026-10-23'

// 為什麼：提醒在台灣晚上 20:00 發，「明天」若被系統時區帶偏，會提醒錯一天
describe('tomorrowTaipei', () => {
  it('台北 20:00（UTC 12:00）→ 隔天', () => {
    expect(tomorrowTaipei(new Date('2026-10-22T12:00:00Z'))).toBe('2026-10-23')
  })
  it('台北日期換日的邊界：UTC 15:59 仍是 10/22，16:00 已是 10/23（不隨系統 TZ 變）', () => {
    expect(tomorrowTaipei(new Date('2026-10-22T15:59:59Z'))).toBe('2026-10-23')
    expect(tomorrowTaipei(new Date('2026-10-22T16:00:00Z'))).toBe('2026-10-24')
  })
  it('跨月跨年', () => {
    expect(tomorrowTaipei(new Date('2026-12-31T12:00:00Z'))).toBe('2027-01-01')
  })
})

describe('buildSummary', () => {
  // 為什麼：沒事還推播會讓使用者關掉通知
  it('沒有任何事 → null（不發）', () => {
    expect(buildSummary({ events: [], trips: [], day: DAY })).toBeNull()
    expect(buildSummary({ events: [ev({ id: 'a', start_date: '2026-10-25' })], trips: [], day: DAY })).toBeNull()
  })
  it('全天事件、定時事件（含時間，排在全天之後）', () => {
    const s = buildSummary({
      events: [
        ev({ id: 'a', title: '看牙', is_all_day: false, start_time: '2026-10-23T09:30:00+08:00', end_time: '2026-10-23T10:30:00+08:00', start_date: null }),
        ev({ id: 'b', title: '繳費' }),
      ],
      trips: [],
      day: DAY,
    })
    expect(s).toEqual({ title: '明天的提醒', body: '繳費\n09:30 看牙' })
  })
  it('多天事件進行中的那天也算', () => {
    const s = buildSummary({ events: [ev({ id: 'a', title: '出差', start_date: '2026-10-22', end_date: '2026-10-24' })], trips: [], day: DAY })
    expect(s?.body).toBe('出差')
  })
  it('每年重複：生日顯示「第 N 年」，起始年當年不加', () => {
    const s = buildSummary({
      events: [
        ev({ id: 'a', title: '小明生日', recurrence: 'yearly', start_date: '2020-10-23', end_date: '2020-10-23' }),
        ev({ id: 'b', title: '新紀念日', recurrence: 'yearly', start_date: '2026-10-23', end_date: '2026-10-23' }),
        ev({ id: 'c', title: '別天', recurrence: 'yearly', start_date: '2020-10-24', end_date: '2020-10-24' }),
      ],
      trips: [],
      day: DAY,
    })
    expect(s?.body.split('\n').sort()).toEqual(['小明生日（第 6 年）', '新紀念日'])
  })
  it('明天出發的行程', () => {
    expect(buildSummary({ events: [], trips: [trip({ id: 1 })], day: DAY })?.body).toBe('明天出發：山上營地')
  })
  it('不是明天出發的行程不會觸發通知', () => {
    expect(buildSummary({ events: [], trips: [trip({ id: 1, trip_date: '2026-10-22' })], day: DAY })).toBeNull()
  })
  it('夜衝行程在 trip_date 前一天出發；取消與已合併的不提醒', () => {
    const night = trip({ id: 1, trip_date: '2026-10-24', night_rush: true })
    expect(buildSummary({ events: [], trips: [night], day: DAY })?.body).toBe('明天出發：山上營地')
    expect(buildSummary({ events: [], trips: [trip({ id: 2, status: 'cancelled' }), trip({ id: 3, merged_into_id: 1 })], day: DAY })).toBeNull()
  })
  it('營區名稱優先用關聯營區，都沒有退回「露營」', () => {
    expect(buildSummary({ events: [], trips: [trip({ id: 1, campsites: { name: '關聯營' } })], day: DAY })?.body).toBe('明天出發：關聯營')
    expect(buildSummary({ events: [], trips: [trip({ id: 1, campsite_name: ' ' })], day: DAY })?.body).toBe('明天出發：露營')
  })
  it('超過 5 行折成「…還有 N 項」', () => {
    const events = Array.from({ length: 7 }, (_, i) => ev({ id: `e${i}`, title: `事${i}` }))
    const lines = buildSummary({ events, trips: [], day: DAY })!.body.split('\n')
    expect(lines).toHaveLength(6)
    expect(lines[5]).toBe('…還有 2 項')
  })
})

const sub = (id: string, user_id: string): Subscription => ({ id, user_id, endpoint: `https://push/${id}`, p256dh: 'p', auth: 'a' })

function makeDb(over: Partial<ReminderDb> = {}): ReminderDb & { deleted: string[][]; marked: string[][] } {
  const deleted: string[][] = []
  const marked: string[][] = []
  return {
    deleted,
    marked,
    listSubscriptions: async () => [],
    listProfiles: async (ids) => ids.map((id) => ({ id, family_id: null })),
    listEvents: async () => [],
    listTrips: async () => [],
    deleteSubscriptions: async (ids) => void deleted.push(ids),
    markSuccess: async (ids) => void marked.push(ids),
    ...over,
  }
}
const now = () => new Date('2026-10-22T12:00:00Z')

describe('runReminders', () => {
  // 為什麼：與 RLS 一致，不能把別人的私人事件推給我，但同家庭 shared 要看得到
  it('只推自己的事件＋同家庭 shared；別人的 private 不外洩', async () => {
    const send = vi.fn<SendFn>(async () => {})
    const db = makeDb({
      listSubscriptions: async () => [sub('s1', 'u1'), sub('s2', 'u2'), sub('s3', 'u3')],
      listProfiles: async () => [
        { id: 'u1', family_id: 'f1' },
        { id: 'u2', family_id: 'f1' },
        { id: 'u3', family_id: null },
      ],
      listEvents: async () => [
        ev({ id: 'a', title: 'u1私人', created_by: 'u1' }),
        ev({ id: 'b', title: 'u1全家', created_by: 'u1', visibility: 'shared', family_id: 'f1' }),
      ],
    })
    const r = await runReminders({ db, send, now })
    const bodies = new Map(send.mock.calls.map(([s, p]) => [s.endpoint, JSON.parse(p as string).body as string]))
    expect(bodies.get('https://push/s1')!.split('\n').sort()).toEqual(['u1全家', 'u1私人'].sort())
    expect(bodies.get('https://push/s2')).toBe('u1全家')
    expect(bodies.has('https://push/s3')).toBe(false)
    expect(r).toMatchObject({ day: DAY, sent: 2, skipped: 1 })
    expect(db.marked).toEqual([['s1', 's2']])
  })
  it('同家庭成員看得到家庭行程', async () => {
    const send = vi.fn<SendFn>(async () => {})
    const db = makeDb({
      listSubscriptions: async () => [sub('s2', 'u2')],
      listProfiles: async () => [{ id: 'u2', family_id: 'f1' }],
      listTrips: async () => [trip({ id: 1, user_id: 'u1', family_id: 'f1' })],
    })
    await runReminders({ db, send, now })
    expect(JSON.parse(send.mock.calls[0]![1] as string)).toEqual({ title: '明天的提醒', body: '明天出發：山上營地', url: '/', tag: 'reminder-2026-10-23' })
    expect(send.mock.calls[0]![2]).toBe('reminder-2026-10-23')
  })
  // 為什麼：404/410 代表裝置已取消訂閱，不清掉每天都會失敗；其他錯誤不能誤刪訂閱
  it('410／404 刪除該訂閱，其他錯誤只記錄、不刪、不中斷其他人', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const gone = Object.assign(new Error('gone'), { statusCode: 410 })
    const notFound = Object.assign(new Error('nf'), { statusCode: 404 })
    const boom = Object.assign(new Error('boom'), { statusCode: 500 })
    const send = vi.fn<SendFn>(async (s) => {
      if (s.endpoint.endsWith('/g')) throw gone
      if (s.endpoint.endsWith('/n')) throw notFound
      if (s.endpoint.endsWith('/b')) throw boom
    })
    const db = makeDb({
      listSubscriptions: async () => [
        { ...sub('g', 'u1'), endpoint: 'https://push/g' },
        { ...sub('n', 'u1'), endpoint: 'https://push/n' },
        { ...sub('b', 'u1'), endpoint: 'https://push/b' },
        { ...sub('ok', 'u1'), endpoint: 'https://push/ok' },
      ],
      listEvents: async () => [ev({ id: 'a' })],
    })
    const r = await runReminders({ db, send, now })
    expect(db.deleted).toEqual([['g', 'n']])
    expect(db.marked).toEqual([['ok']])
    expect(r).toMatchObject({ sent: 1, removed: 2, failed: 1 })
    err.mockRestore()
  })
  // 為什麼：VAPID 金鑰換過後舊訂閱會一直被 401/403 拒絕，不清掉每天都白送
  it('401／403 也視為失效訂閱而刪除', async () => {
    const send = vi.fn<SendFn>(async (s) => {
      throw Object.assign(new Error('x'), { statusCode: s.endpoint.endsWith('/a') ? 401 : 403 })
    })
    const db = makeDb({
      listSubscriptions: async () => [{ ...sub('a', 'u1'), endpoint: 'https://push/a' }, { ...sub('b', 'u1'), endpoint: 'https://push/b' }],
      listEvents: async () => [ev({ id: 'a' })],
    })
    await runReminders({ db, send, now })
    expect(db.deleted).toEqual([['a', 'b']])
  })
  it('清理 DB 失敗不會讓整個排程丟錯', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const db = makeDb({
      listSubscriptions: async () => [sub('g', 'u1')],
      listEvents: async () => [ev({ id: 'a' })],
      deleteSubscriptions: async () => {
        throw new Error('db down')
      },
    })
    const send = vi.fn<SendFn>(async () => {
      throw Object.assign(new Error('gone'), { statusCode: 410 })
    })
    await expect(runReminders({ db, send, now })).resolves.toMatchObject({ removed: 1 })
    err.mockRestore()
  })
  it('沒有訂閱就不查其他資料', async () => {
    const listEvents = vi.fn(async () => [])
    const r = await runReminders({ db: makeDb({ listEvents }), send: vi.fn(), now })
    expect(listEvents).not.toHaveBeenCalled()
    expect(r.subscriptions).toBe(0)
  })
})

async function statusOf(p: Promise<unknown>) {
  try {
    await p
  } catch (e) {
    if (e instanceof HttpError) return e.status
    throw e
  }
  return 200
}

// 為什麼：端點能對所有訂閱者發推播，沒驗證就等於讓外人亂發通知
describe('handleReminders 驗證', () => {
  const req = (auth?: string) => new Request('http://x/api/cron/reminders', { method: 'GET', headers: auth ? { Authorization: auth } : {} })
  const deps = (cronSecret?: string) => ({ db: makeDb(), send: vi.fn(), now, cronSecret })
  it('沒帶或帶錯 secret 回 401', async () => {
    expect(await statusOf(handleReminders(req(), deps('s3cret')))).toBe(401)
    expect(await statusOf(handleReminders(req('Bearer wrong'), deps('s3cret')))).toBe(401)
    expect(await statusOf(handleReminders(req('s3cret'), deps('s3cret')))).toBe(401)
  })
  it('伺服器沒設定 secret 一律 401（不能用「Bearer undefined」通過）', async () => {
    expect(await statusOf(handleReminders(req('Bearer undefined'), deps(undefined)))).toBe(401)
    expect(await statusOf(handleReminders(req('Bearer '), deps('')))).toBe(401)
  })
  it('正確 secret 回 200 與統計', async () => {
    const res = await handleReminders(req('Bearer s3cret'), deps('s3cret'))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ day: DAY, subscriptions: 0 })
  })
})
