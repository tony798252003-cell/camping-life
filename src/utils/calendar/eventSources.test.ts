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
    const v = eventToView(ev({ is_all_day: true, start_date: '2026-10-17', end_date: '2026-10-19' }), catMap, today)
    expect(v).toMatchObject({ allDay: true, startDate: '2026-10-17', endDate: '2026-10-19' })
  })
  it('start_date 為 null 退回 start_time 的台北日期', () => {
    // 舊資料不能從畫面消失（Review Focus 2）；UTC 04:00 = 台北中午
    const v = eventToView(ev({ is_all_day: true, start_date: null, start_time: '2026-10-17T04:00:00Z', end_time: '2026-10-17T04:00:00Z' }), catMap, today)
    expect(v).toMatchObject({ startDate: '2026-10-17', endDate: '2026-10-17' })
  })
  it('跨午夜的 timed 事件不是多天事件', () => {
    // 時間軸要用 startMin/endMin 排；台北 22:00 到隔天 01:00
    const v = eventToView(ev({ start_time: '2026-10-17T14:00:00Z', end_time: '2026-10-17T17:00:00Z' }), catMap, today)
    expect(v).toMatchObject({ allDay: false, startDate: '2026-10-17', endDate: '2026-10-18', startMin: 1320, endMin: 60 })
  })
  it('結束在隔天 00:00 的 timed 事件算到前一天 24:00', () => {
    // 為什麼：否則隔天會多出一個 0 分鐘的幽靈項目撐亂時間軸
    const v = eventToView(ev({ start_time: '2026-10-17T14:00:00Z', end_time: '2026-10-17T16:00:00Z' }), catMap, today)
    expect(v).toMatchObject({ startDate: '2026-10-17', endDate: '2026-10-17', startMin: 1320, endMin: 1440 })
  })
  it('past 看 endDate', () => {
    expect(eventToView(ev({}), catMap, '2026-10-18').past).toBe(true)
    expect(eventToView(ev({}), catMap, today).past).toBe(false)
  })
  // 為什麼：C5 規定顏色代表「誰看得到」；若仍跟分類色，全家與私人事件在畫面上分不出來
  it('顏色由可見性決定，與分類色無關', () => {
    const shared = eventToView(ev({ category_id: 'c-work', visibility: 'shared' }), catMap, today)
    const priv = eventToView(ev({ category_id: 'c-work', visibility: 'private' }), catMap, today)
    expect(shared).toMatchObject({ color: '#8E7DBE', owner: 'family', categoryName: 'work' })
    expect(priv).toMatchObject({ color: '#4A9E9B', owner: 'me' })
  })
  // 為什麼：家人新增的全家事件要標示是誰排的；自己的或私人的標了反而是噪音
  it('creatorName 只有全家事件且建立者不是自己才有', () => {
    const ctx = { meId: 'me', names: new Map([['wife', '小美']]) }
    expect(eventToView(ev({ visibility: 'shared', created_by: 'wife' }), catMap, today, ctx).creatorName).toBe('小美')
    expect(eventToView(ev({ visibility: 'shared', created_by: 'me' }), catMap, today, ctx).creatorName).toBeUndefined()
    expect(eventToView(ev({ visibility: 'private', created_by: 'me' }), catMap, today, ctx).creatorName).toBeUndefined()
  })
})

describe('tripToView', () => {
  it('duration_days 3 → endDate +2；0 或 null 當 1 天', () => {
    // 舊資料天數不完整時行程不能壞掉（Review Focus 2）
    expect(tripToView(trip({ duration_days: 3 }), 'c-camp', today).endDate).toBe('2026-10-22')
    expect(tripToView(trip({ duration_days: 0 }), 'c-camp', today).endDate).toBe('2026-10-20')
    expect(tripToView(trip({ duration_days: null }), 'c-camp', today).endDate).toBe('2026-10-20')
  })
  it('夜衝 startDate 為前一天', () => {
    // 前一晚就要出發，月曆空白會讓人排到別的事
    const v = tripToView(trip({ trip_date: '2026-10-23', night_rush: true }), 'c-camp', today)
    expect(v).toMatchObject({ startDate: '2026-10-22', nightRushDate: '2026-10-22', allDay: true })
    expect(feed({ trips: [trip({ trip_date: '2026-10-23', night_rush: true })] })[0]?.startDate).toBe('2026-10-22')
  })
  it('campsite_id 為 null 用快照名，都空則「露營」', () => {
    // 舊行程缺營區關聯時不能從 feed 消失
    expect(tripToView(trip({ campsite_id: null, campsites: null, campsite_name: '舊營區' }), null, today).title).toBe('舊營區')
    const t = trip({ campsite_id: null, campsites: null, campsite_name: null })
    expect(tripToView(t, null, today).title).toBe('露營')
    expect(feed({ trips: [t] })).toHaveLength(1)
  })
})

describe('trip / game 的固定歸屬', () => {
  // 為什麼：規格定義露營行程一律全家、中職賽程一律「我」，不受分類或可見性欄位影響
  it('trip -> 全家色；cpbl -> 我的色', () => {
    expect(tripToView(trip(), 'c-camp', today)).toMatchObject({ color: '#8E7DBE', owner: 'family' })
    expect(gameToView(game({}), today)).toMatchObject({ color: '#4A9E9B', owner: 'me' })
  })
})

describe('buildFeed', () => {
  // 為什麼：SELECT 現在也會回家人的分類；若系統分類（露營/棒球）沒限定自己的，
  // 家人的露營分類 id 會被拿來當篩選依據，自己隱藏露營時行程不會被隱藏
  it('系統分類只認自己的（ctx.meId）', () => {
    const wifeCamp = { ...CAMP, id: 'w-camp', owner_id: 'wife' } as EventCategory
    const mine = cats.map((c) => ({ ...c, owner_id: 'me' }) as EventCategory)
    const f = feed({
      categories: [wifeCamp, ...mine],
      trips: [trip()],
      hiddenCategoryIds: new Set(['c-camp']),
      ctx: { meId: 'me', names: new Map() },
    })
    expect(f).toHaveLength(0)
  })
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
    expect(gameToView(game({}), today).title).toBe('⚾ 樂天桃猿 vs 統一7-ELEVEn獅')
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

describe('每年重複事件（F3）', () => {
  const yearly = (o: Partial<CalendarEventRow> = {}) =>
    ev({ id: 'b1', title: '媽媽生日', is_all_day: true, start_date: '2024-12-31', end_date: '2024-12-31', recurrence: 'yearly', ...o })
  const run = (e: CalendarEventRow, from: string, to: string) =>
    feed({ events: [e], range: { from, to } }).filter((v) => v.sourceId === e.id)

  it('範圍跨年（12/31 到 1/1）時兩個年度的出現都要在', () => {
    // 為什麼：展開若只看 from 的年份，跨年週會漏掉隔年 1/1 的事件
    const r = run(yearly({ start_date: '2024-01-01', end_date: '2024-01-01' }), '2026-12-31', '2027-01-01')
    expect(r.map((v) => v.startDate)).toEqual(['2027-01-01'])
    const r2 = run(yearly(), '2026-12-31', '2027-01-01')
    expect(r2.map((v) => v.startDate)).toEqual(['2026-12-31'])
  })
  it('2/29 在非閏年顯示於 2/28，閏年維持 2/29', () => {
    // 為什麼：閏日生日每年都要有一天可看，不能整年消失
    const e = yearly({ start_date: '2024-02-29', end_date: '2024-02-29' })
    expect(run(e, '2024-01-01', '2028-12-31').map((v) => v.startDate)).toEqual([
      '2024-02-29', '2025-02-28', '2026-02-28', '2027-02-28', '2028-02-29',
    ])
  })
  it('標題帶第 N 年，起始年當年不加', () => {
    const r = run(yearly({ start_date: '2020-10-22', end_date: '2020-10-22' }), '2020-01-01', '2022-12-31')
    expect(r.map((v) => v.title)).toEqual(['媽媽生日', '媽媽生日（第 1 年）', '媽媽生日（第 2 年）'])
  })
  it('起始年之前不會出現', () => {
    // 為什麼：2026 才建立的紀念日，不能回溯顯示在 2020 年
    const r = run(yearly({ start_date: '2026-05-01', end_date: '2026-05-01' }), '2020-01-01', '2026-12-31')
    expect(r.map((v) => v.startDate)).toEqual(['2026-05-01'])
  })
  it('多天事件每年保持原本天數，含跨年的出現', () => {
    // 為什麼：12/30–1/2 的旅行紀念，在 1/1 的範圍內仍要顯示前一年開始的那一次
    const e = yearly({ start_date: '2024-12-30', end_date: '2025-01-02' })
    const r = run(e, '2026-01-01', '2026-12-31')
    expect(r.map((v) => [v.startDate, v.endDate])).toEqual([
      ['2025-12-30', '2026-01-02'],
      ['2026-12-30', '2027-01-02'],
    ])
  })
  it('每次出現 key 不同，但 sourceId 都指向原系列', () => {
    // 為什麼：Vue v-for 需要唯一 key；點開要編輯整個系列（原 id）
    const r = run(yearly({ start_date: '2024-10-22', end_date: '2024-10-22' }), '2024-01-01', '2026-12-31')
    expect(new Set(r.map((v) => v.key)).size).toBe(3)
    expect(r.every((v) => v.sourceId === 'b1')).toBe(true)
  })
  it('past 以每次出現自己的結束日判斷', () => {
    const r = run(yearly({ start_date: '2024-10-17', end_date: '2024-10-17' }), '2025-01-01', '2027-12-31')
    expect(r.map((v) => v.past)).toEqual([true, false, false]) // 2025 已過；2026 結束日 = 今天，不算過去；2027 未到
  })
  it('沒有 recurrence 的事件維持單一 key 不展開', () => {
    const r = feed({ events: [ev({ is_all_day: true, start_date: '2024-10-17', end_date: '2024-10-17' })] })
    expect(r.map((v) => v.key)).toEqual(['event:e1'])
  })
  it('預設範圍涵蓋今年與未來，月曆翻頁看得到', () => {
    const r = feed({ events: [yearly({ start_date: '2020-10-22', end_date: '2020-10-22' })] })
    expect(r.map((v) => v.startDate)).toContain('2027-10-22')
  })
})

describe('每年重複事件：補充情境', () => {
  const yearly = (o: Partial<CalendarEventRow> = {}) =>
    ev({ id: 'b2', title: '紀念', is_all_day: true, start_date: '2020-10-22', end_date: '2020-10-22', recurrence: 'yearly', ...o })
  const mine = (events: CalendarEventRow[], o: Partial<Parameters<typeof buildFeed>[0]> = {}) =>
    feed({ events, ...o }).filter((v) => v.sourceId === 'b2')

  it('預設窗口邊界：今年 -3 年（含）到 +10 年（含），之外不展開', () => {
    // 為什麼：窗口是已知限制，邊界要被測試鎖住，改動時才會注意到
    const years = mine([yearly()]).map((v) => v.startDate.slice(0, 4))
    expect(years[0]).toBe('2023')
    expect(years[years.length - 1]).toBe('2036')
  })
  it('從 2/29 開始的多天事件：非閏年起點為 2/28，長度不變', () => {
    // 為什麼：起點位移後終點要跟著位移，否則非閏年天數會少一天
    const e = yearly({ start_date: '2024-02-29', end_date: '2024-03-02' })
    const r = feed({ events: [e], range: { from: '2024-01-01', to: '2025-12-31' } }).filter((v) => v.sourceId === 'b2')
    expect(r.map((v) => [v.startDate, v.endDate])).toEqual([
      ['2024-02-29', '2024-03-02'],
      ['2025-02-28', '2025-03-03'],
    ])
  })
  it('被隱藏的分類：重複事件整個不展開', () => {
    // 為什麼：隱藏分類的篩選要先於展開，否則隱藏後每年的出現仍會冒出來
    const r = mine([yearly({ category_id: 'c-work' })], { hiddenCategoryIds: new Set(['c-work']) })
    expect(r).toEqual([])
  })
})
