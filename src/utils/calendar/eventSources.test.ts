import { describe, it, expect } from 'vitest'
import type { CalendarEventRow, CpblSchedule, EventCategory } from '../../types/database'
import { buildFeed, eventToView, gameToView, isRakutenGame, tripToView } from './eventSources'

const today = '2026-10-17'
const cat = (id: string, system_key: string, color: string) =>
  ({ id, system_key, color, name: system_key, owner_id: 'u', sort_order: 0, created_at: '' }) as EventCategory
const CAMP = cat('c-camp', 'camping', '#10b981')
const BASE = cat('c-base', 'baseball', '#9d1c32')
const WORK = cat('c-work', 'work', '#3b82f6')
const cats = [CAMP, BASE, WORK, cat('c-p', 'personal', '#8b5cf6')]
const catMap = new Map(cats.map((c) => [c.id, c]))

const ev = (o: Partial<CalendarEventRow>): CalendarEventRow =>
  ({
    id: 'e1', title: 't', description: null, is_all_day: false, category_id: null, start_date: null, end_date: null,
    start_time: '2026-10-17T04:00:00Z', end_time: '2026-10-17T05:00:00Z', cpbl_game_id: null, visibility: 'private',
    ...o,
  }) as CalendarEventRow
const trip = (o: Record<string, unknown> = {}) =>
  ({ id: 1, trip_date: '2026-10-20', duration_days: 1, status: 'booked', night_rush: false, campsite_id: 1, campsite_name: null, campsites: { name: '營區A' }, ...o }) as Parameters<typeof tripToView>[0]
const game = (o: Partial<CpblSchedule>): CpblSchedule =>
  ({ id: 'G1', game_date: '2026-10-25', home_team_name: '統一7-ELEVEn獅', visiting_team_name: '樂天桃猿', game_sno: 1, field_abbe: 'x', created_at: null, ...o }) as CpblSchedule
const feed = (o: Partial<Parameters<typeof buildFeed>[0]> = {}) =>
  buildFeed({ events: [], trips: [], games: [], categories: cats, showCpbl: true, hiddenCategoryIds: new Set(), today, ...o })

describe('eventToView', () => {
  it('全天事件讀 start_date/end_date', () => {
    // 新版寫入的真正資料在這兩欄
    const v = eventToView(ev({ is_all_day: true, start_date: '2026-10-17', end_date: '2026-10-19' }), catMap, '#8b5cf6', today)
    expect(v).toMatchObject({ allDay: true, startDate: '2026-10-17', endDate: '2026-10-19' })
  })
  it('start_date 為 null 退回 start_time 的台北日期', () => {
    // 舊資料不能從畫面消失（Review Focus 2）；UTC 04:00 = 台北中午
    const v = eventToView(ev({ is_all_day: true, start_date: null, start_time: '2026-10-17T04:00:00Z', end_time: '2026-10-17T04:00:00Z' }), catMap, '#8b5cf6', today)
    expect(v).toMatchObject({ startDate: '2026-10-17', endDate: '2026-10-17' })
  })
  it('跨午夜的 timed 事件不是多天事件', () => {
    // 時間軸要用 startMin/endMin 排；台北 22:00 到隔天 01:00
    const v = eventToView(ev({ start_time: '2026-10-17T14:00:00Z', end_time: '2026-10-17T17:00:00Z' }), catMap, '#8b5cf6', today)
    expect(v).toMatchObject({ allDay: false, startDate: '2026-10-17', endDate: '2026-10-18', startMin: 1320, endMin: 60 })
  })
  it('顏色跟著分類，null 用個人色；past 看 endDate', () => {
    // 使用者改分類色，事件顏色要一起變
    expect(eventToView(ev({ category_id: 'c-work' }), catMap, '#123456', today).color).toBe('#3b82f6')
    expect(eventToView(ev({}), catMap, '#123456', today).color).toBe('#123456')
    expect(eventToView(ev({}), catMap, '#123456', '2026-10-18').past).toBe(true)
    expect(eventToView(ev({}), catMap, '#123456', today).past).toBe(false)
  })
})

describe('tripToView', () => {
  it('duration_days 3 → endDate +2；0 或 null 當 1 天', () => {
    // 舊資料天數不完整時行程不能壞掉（Review Focus 2）
    expect(tripToView(trip({ duration_days: 3 }), '#10b981', 'c-camp', today).endDate).toBe('2026-10-22')
    expect(tripToView(trip({ duration_days: 0 }), '#10b981', 'c-camp', today).endDate).toBe('2026-10-20')
    expect(tripToView(trip({ duration_days: null }), '#10b981', 'c-camp', today).endDate).toBe('2026-10-20')
  })
  it('夜衝 startDate 為前一天；planning 帶 tripStatus', () => {
    // 前一晚就要出發，月曆空白會讓人排到別的事
    const v = tripToView(trip({ trip_date: '2026-10-23', night_rush: true, status: 'planning' }), '#10b981', 'c-camp', today)
    expect(v).toMatchObject({ startDate: '2026-10-22', nightRushDate: '2026-10-22', tripStatus: 'planning', allDay: true })
    expect(feed({ trips: [trip({ trip_date: '2026-10-23', night_rush: true })] })[0]?.startDate).toBe('2026-10-22')
  })
  it('campsite_id 為 null 用快照名，都空則「露營」', () => {
    // 舊行程缺營區關聯時不能從 feed 消失
    expect(tripToView(trip({ campsite_id: null, campsites: null, campsite_name: '舊營區' }), 'c', null, today).title).toBe('舊營區')
    const t = trip({ campsite_id: null, campsites: null, campsite_name: null })
    expect(tripToView(t, 'c', null, today).title).toBe('露營')
    expect(feed({ trips: [t] })).toHaveLength(1)
  })
})

describe('buildFeed', () => {
  it('cancelled 與已合併的行程不出現', () => {
    // 合併後只留主行程，避免重複
    expect(feed({ trips: [trip({ status: 'cancelled' }), trip({ id: 2, merged_into_id: 1 })] })).toHaveLength(0)
  })
  it('hiddenCategoryIds 含露營分類 → 行程不出現', () => {
    // 篩選要對行程也生效
    expect(feed({ trips: [trip()], hiddenCategoryIds: new Set(['c-camp']) })).toHaveLength(0)
  })
  it('只保留樂天的比賽', () => {
    // 行事曆只關心桃猿賽程
    expect(isRakutenGame(game({}))).toBe(true)
    const f = feed({ games: [game({}), game({ id: 'G2', home_team_name: '中信兄弟', visiting_team_name: '統一7-ELEVEn獅' })] })
    expect(f.map((x) => x.sourceId)).toEqual(['G1'])
    expect(gameToView(game({}), '#9d1c32', today).title).toBe('⚾ 樂天桃猿 vs 統一7-ELEVEn獅')
  })
  it('showCpbl=false 沒有 cpbl 項目，但棒球分類的使用者事件仍在', () => {
    // Review Focus 5：關開關不能吃掉使用者自建的棒球事件
    const f = feed({ showCpbl: false, games: [game({})], events: [ev({ category_id: 'c-base' })] })
    expect(f.map((x) => x.source)).toEqual(['event'])
  })
  it('使用者事件綁定比賽時，該場疊加項目不出現', () => {
    // Review Focus 5：同一天不能出現兩次
    const f = feed({ games: [game({})], events: [ev({ category_id: 'c-base', cpbl_game_id: 'G1' })] })
    expect(f.map((x) => x.source)).toEqual(['event'])
  })
  it('排序：日期、全天優先、startMin', () => {
    // 同一天全天事件要排在有時段事件前面
    const f = feed({
      events: [ev({ id: 'b', start_time: '2026-10-17T04:00:00Z' }), ev({ id: 'a', start_time: '2026-10-17T01:00:00Z' }), ev({ id: 'd', is_all_day: true, start_date: '2026-10-17', end_date: '2026-10-17' })],
    })
    expect(f.map((x) => x.sourceId)).toEqual(['d', 'a', 'b'])
  })
})
