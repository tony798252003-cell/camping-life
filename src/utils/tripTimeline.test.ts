import { describe, it, expect } from 'vitest'
import {
  tripNights, isUpcoming, upcomingBadge, tripYears, summarizeYear, searchTrips, groupTimeline,
  type TimelineTrip,
} from './tripTimeline'

const trip = (o: Partial<TimelineTrip> & { id: number; trip_date: string }): TimelineTrip => ({
  duration_days: 2, campsite_name: `營區${o.id}`, campsites: null, ...o,
})

describe('tripNights', () => {
  it('晚數 = 天數 - 1，單日或沒填天數不會變負數', () => {
    // 摘要卡的「晚」若出現 -1 或把單日行程算成 1 晚，使用者會覺得統計不可信
    expect(tripNights(trip({ id: 1, trip_date: '2026-01-01', duration_days: 3 }))).toBe(2)
    expect(tripNights(trip({ id: 2, trip_date: '2026-01-01', duration_days: 1 }))).toBe(0)
    expect(tripNights(trip({ id: 3, trip_date: '2026-01-01', duration_days: null }))).toBe(0)
  })
})

describe('isUpcoming / upcomingBadge', () => {
  const today = '2026-10-21'
  it('今天出發算即將出發，昨天算已去過', () => {
    // 邊界用日期字串比較；用 Date 時間戳比會在午夜前後把今天的行程誤判成過去
    expect(isUpcoming(trip({ id: 1, trip_date: '2026-10-21' }), today)).toBe(true)
    expect(isUpcoming(trip({ id: 2, trip_date: '2026-10-20' }), today)).toBe(false)
  })
  it('徽章：今天顯示「今天」，其餘顯示 N 天後', () => {
    expect(upcomingBadge(trip({ id: 1, trip_date: '2026-10-21' }), today)).toBe('今天')
    expect(upcomingBadge(trip({ id: 2, trip_date: '2026-10-24' }), today)).toBe('3 天後')
  })
  it('trip_date 帶時間字串也只看日期部分', () => {
    expect(isUpcoming(trip({ id: 1, trip_date: '2026-10-21T00:00:00+00:00' }), today)).toBe(true)
  })
})

describe('summarizeYear', () => {
  const trips = [
    trip({ id: 1, trip_date: '2026-01-10', duration_days: 3, campsites: { id: 7, name: 'A' } }),
    trip({ id: 2, trip_date: '2026-01-20', duration_days: 2, campsites: { id: 7, name: 'A' } }),
    trip({ id: 3, trip_date: '2026-03-05', duration_days: 1, campsites: { id: 8, name: 'B' } }),
    trip({ id: 4, trip_date: '2025-12-31', duration_days: 5, campsites: { id: 9, name: 'C' } }),
  ]
  it('只統計選定年份；營區重複去只算一個；月份長條按趟數累計', () => {
    // 年份邊界（12/31 vs 1/1）若算錯，跨年行程會灌進錯誤的年度
    expect(summarizeYear(trips, 2026)).toEqual({ trips: 3, nights: 3, campsites: 2, monthly: [2, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0] })
  })
  it('沒綁營區的行程以名稱去重', () => {
    const t = [trip({ id: 1, trip_date: '2026-02-01', campsite_name: 'X' }), trip({ id: 2, trip_date: '2026-02-09', campsite_name: 'X' })]
    expect(summarizeYear(t, 2026).campsites).toBe(1)
  })
})

describe('tripYears', () => {
  it('列出資料中出現的年份，新到舊', () => {
    const t = [trip({ id: 1, trip_date: '2024-05-01' }), trip({ id: 2, trip_date: '2026-05-01' }), trip({ id: 3, trip_date: '2024-06-01' })]
    expect(tripYears(t)).toEqual([2026, 2024])
  })
})

describe('searchTrips', () => {
  const trips = [
    trip({ id: 1, trip_date: '2026-01-01', campsites: { name: '楓林谷露營區', city: '桃園市', district: '復興區' } }),
    trip({ id: 2, trip_date: '2026-01-02', campsites: null, campsite_name: '自由大地' }),
  ]
  it('可用營區名、縣市、區域搜尋；空白不過濾', () => {
    // 使用者可能記得名字也可能只記得地區，三種都要找得到
    expect(searchTrips(trips, '楓林').map((t) => t.id)).toEqual([1])
    expect(searchTrips(trips, '桃園').map((t) => t.id)).toEqual([1])
    expect(searchTrips(trips, '復興').map((t) => t.id)).toEqual([1])
    expect(searchTrips(trips, '自由').map((t) => t.id)).toEqual([2])
    expect(searchTrips(trips, '  ')).toHaveLength(2)
  })
})

describe('groupTimeline', () => {
  const today = '2026-10-21'
  const trips = [
    trip({ id: 1, trip_date: '2026-12-25', duration_days: 3 }),
    trip({ id: 2, trip_date: '2026-10-24', duration_days: 3 }),
    trip({ id: 3, trip_date: '2026-09-13', duration_days: 2 }),
    trip({ id: 4, trip_date: '2026-08-23', duration_days: 3 }),
    trip({ id: 5, trip_date: '2025-05-01', duration_days: 2 }),
  ]
  it('即將出發在最上面且由近到遠；已去過依年份新到舊、年內新到舊並附趟數與晚數', () => {
    // 時間軸的閱讀順序：先看接下來要去哪，再往回翻舊回憶
    const g = groupTimeline(trips, today)
    expect(g.map((x) => x.key)).toEqual(['upcoming', '2026', '2025'])
    expect(g[0]!.trips.map((t) => t.id)).toEqual([2, 1])
    expect(g[1]!.trips.map((t) => t.id)).toEqual([3, 4])
    expect(g[1]!.meta).toBe('2 趟 · 3 晚')
    expect(g[2]!.meta).toBe('1 趟 · 1 晚')
  })
  it('沒有即將出發就不出現該群組', () => {
    expect(groupTimeline([trips[4]!], today).map((x) => x.key)).toEqual(['2025'])
  })
})
