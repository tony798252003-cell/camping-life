import { describe, it, expect } from 'vitest'
import type { CalendarEventRow, CpblSchedule, EventCategory } from '../types/database'
import { buildFeed, tripToView } from './calendar/eventSources'
import { holidays } from './holidays'
import { addMonths, busySpans, candidateLabel, candidateTag, isNotYetBookable, suggestTripDates } from './tripDateSuggest'

const today = '2026-10-27' // 週二
const suggest = (o: Partial<Parameters<typeof suggestTripDates>[0]> = {}) =>
  suggestTripDates({ today, months: 3, holidays, busy: [], ...o })
const starts = (o: Partial<Parameters<typeof suggestTripDates>[0]> = {}) => suggest(o).map((c) => c.start)

const cat = (id: string, name: string, system_key: string | null = null) =>
  ({ id, system_key, color: '#000000', name, owner_id: 'u', sort_order: 0, created_at: '' }) as EventCategory
const cats = [cat('c-camp', '露營', 'camping'), cat('c-ball', '練球'), cat('c-p', '個人', 'personal')]
const ev = (o: Partial<CalendarEventRow>): CalendarEventRow =>
  ({
    id: 'e1', title: 't', description: null, is_all_day: true, category_id: null, start_date: '2026-11-07', end_date: '2026-11-07',
    start_time: '2026-11-07T00:00:00+08:00', end_time: '2026-11-07T00:00:00+08:00', cpbl_game_id: null, visibility: 'private', recurrence: null,
    ...o,
  }) as CalendarEventRow
const trip = (o: Record<string, unknown> = {}) =>
  ({ id: 1, trip_date: '2026-11-14', duration_days: 2, status: 'booked', night_rush: false, campsite_id: 1, campsite_name: null, campsites: { name: '營區A' }, ...o }) as Parameters<typeof tripToView>[0]
const feed = (o: Partial<Parameters<typeof buildFeed>[0]> = {}) =>
  buildFeed({ events: [], trips: [], games: [], categories: cats, showCpbl: true, hiddenCategoryIds: new Set(), today, ...o })

describe('suggestTripDates', () => {
  it('列出接下來 3 個月的週末，每個都是週六到週日 2 天', () => {
    // 為什麼：建議清單的基本盤就是每個週末；第一個是今天（週二）之後的週六
    const list = suggest()
    expect(list[0]).toMatchObject({ start: '2026-10-31', end: '2026-11-01', days: 2, isLongWeekend: false })
    expect(starts()).toContain('2026-11-07')
  })

  it('連假整段建議一次，裡面的週末不另外列', () => {
    // 為什麼：12/25（五）–12/27（日）是一段 3 天連假；若週末再列一次，使用者會看到重疊的兩個選項
    const list = suggest()
    expect(list.find((c) => c.start === '2026-12-25')).toMatchObject({ end: '2026-12-27', days: 3, isLongWeekend: true, holidayName: '行憲紀念日' })
    expect(starts()).not.toContain('2026-12-26')
    // 1/1（五）–1/3（日）同理
    expect(list.find((c) => c.start === '2027-01-01')).toMatchObject({ days: 3, holidayName: '開國紀念日' })
    expect(starts()).not.toContain('2027-01-02')
  })

  it('連假的附屬名稱（連假／補假）不當標籤，春節各天統一叫春節', () => {
    // 為什麼：標籤要讓人一眼看出是哪個節日；「連假・連假」或「連假・除夕」都看不懂
    const list = suggestTripDates({ today: '2027-01-20', months: 1, holidays, busy: [] })
    expect(list.find((c) => c.start === '2027-02-04')).toMatchObject({ end: '2027-02-10', days: 7, holidayName: '春節' })
  })

  it('補班的週六不算放假，剩下的週日一天不建議', () => {
    // 為什麼：補班日照常上班，算成假日會建議到要上班的日子；只剩一天也無法過夜
    expect(starts({ workdays: ['2026-11-14'] })).not.toContain('2026-11-14')
    expect(starts({ workdays: ['2026-11-14'] })).not.toContain('2026-11-15')
  })

  it('補班的週六不算進連假長度', () => {
    // 週五放假 + 週六補班 + 週日：連假被切斷，不能建議成 3 天
    const hs = [{ date: '2026-11-13', name: '某節' }]
    expect(suggest({ holidays: hs, workdays: ['2026-11-14'] }).some((c) => c.start <= '2026-11-15' && c.end >= '2026-11-13')).toBe(false)
    // 沒有補班時同一段就是 3 天連假
    expect(suggest({ holidays: hs }).find((c) => c.start === '2026-11-13')).toMatchObject({ days: 3, holidayName: '某節' })
  })

  it('只要有一天重疊就排除', () => {
    // 為什麼：週日有安排，整個週末就出不了門，不能因為週六空著就建議
    const s = starts({ busy: [{ start: '2026-11-15', end: '2026-11-15' }] })
    expect(s).not.toContain('2026-11-14')
    expect(s).toContain('2026-11-07')
    expect(s).toContain('2026-11-21')
  })

  it('連假被擋掉時整段不建議', () => {
    // 連假中間有安排，建議 3 天就會撞到
    expect(starts({ busy: [{ start: '2026-12-27', end: '2026-12-27' }] })).not.toContain('2026-12-25')
  })

  it('只看今天之後開始、3 個月內開始的', () => {
    // 為什麼：今天週日時那個週末已經過一半，不該再建議；3 個月以外的不在範圍內
    expect(suggestTripDates({ today: '2026-11-01', months: 3, holidays, busy: [] })[0]!.start).toBe('2026-11-07')
    expect(suggestTripDates({ today: '2026-10-31', months: 3, holidays, busy: [] })[0]!.start).toBe('2026-10-31')
    const all = suggest()
    const last = all[all.length - 1]!
    expect(last.start <= addMonths(today, 3)).toBe(true)
    expect(starts()).not.toContain('2027-01-30')
  })

  it('全部都有安排時回空陣列', () => {
    expect(suggest({ busy: [{ start: '2026-10-01', end: '2027-03-01' }] })).toEqual([])
  })
})

describe('busySpans', () => {
  it('夜衝的前一晚也算在行程內', () => {
    // 為什麼：週一出發夜衝，週日晚上就要出門，那個週末不能建議
    const busy = busySpans(feed({ trips: [trip({ trip_date: '2026-11-09', duration_days: 1, night_rush: true })] }))
    expect(starts({ busy })).not.toContain('2026-11-07')
  })

  it('週六出發的夜衝只擋自己的週末，不擋前一個週末', () => {
    // 夜衝前一晚是週五，建議都從週六開始，所以前一個週末仍可建議
    const busy = busySpans(feed({ trips: [trip({ trip_date: '2026-11-14', night_rush: true })] }))
    expect(busy).toEqual([{ start: '2026-11-13', end: '2026-11-15' }])
    expect(starts({ busy })).not.toContain('2026-11-14')
    expect(starts({ busy })).toContain('2026-11-07')
  })

  it('編輯中的行程本身不算', () => {
    // 為什麼：否則編輯行程時永遠建議不到它原本的日期，也無法挪到相鄰日期
    const f = feed({ trips: [trip({ id: 5 }), trip({ id: 6, trip_date: '2026-11-21' })] })
    expect(busySpans(f, 5)).toEqual([{ start: '2026-11-21', end: '2026-11-22' }])
  })

  it('取消、已合併的行程不算', () => {
    // 這些行程不會成行，日期其實是空的
    const f = feed({ trips: [trip({ status: 'cancelled' }), trip({ id: 2, merged_into_id: 9 })] })
    expect(busySpans(f)).toEqual([])
  })

  it('全家事件與練球會擋，只有我的事件與桃猿賽程不擋', () => {
    // 為什麼：露營是全家出動，個人行程可以調；練球是孩子的固定活動，就算只設給我看也要避開
    const f = feed({
      events: [
        ev({ id: 'fam', visibility: 'shared', start_date: '2026-11-07', end_date: '2026-11-07' }),
        ev({ id: 'me', visibility: 'private', category_id: 'c-p', start_date: '2026-11-14', end_date: '2026-11-14' }),
        ev({ id: 'ball', visibility: 'private', category_id: 'c-ball', start_date: '2026-11-22', end_date: '2026-11-22' }),
      ],
      games: [{ id: 'G1', game_date: '2026-11-28', home_team_name: '樂天桃猿', visiting_team_name: '統一獅', game_sno: 1, field_abbe: 'x', created_at: null } as CpblSchedule],
    })
    const s = starts({ busy: busySpans(f) })
    expect(s).not.toContain('2026-11-07')
    expect(s).toContain('2026-11-14')
    expect(s).not.toContain('2026-11-21')
    expect(s).toContain('2026-11-28')
  })

  it('每年重複的全家事件展開到今年', () => {
    // 為什麼：生日、紀念日只存第一年，沒展開就擋不到今年那天
    const f = feed({ events: [ev({ visibility: 'shared', recurrence: 'yearly', start_date: '2020-11-21', end_date: '2020-11-21' })] })
    expect(starts({ busy: busySpans(f) })).not.toContain('2026-11-21')
  })
})

describe('顯示', () => {
  it('日期區間與天數', () => {
    expect(candidateLabel({ start: '2026-11-14', end: '2026-11-15', days: 2, isLongWeekend: false })).toBe('11/14（六）–11/15（日）・2天1夜')
  })
  it('連假才有標籤', () => {
    expect(candidateTag({ start: '2026-10-09', end: '2026-10-11', days: 3, isLongWeekend: true, holidayName: '國慶日' })).toBe('連假・國慶日')
    expect(candidateTag({ start: '2026-10-09', end: '2026-10-11', days: 3, isLongWeekend: true })).toBe('連假')
    expect(candidateTag({ start: '2026-11-14', end: '2026-11-15', days: 2, isLongWeekend: false })).toBeNull()
  })
  it('營區可訂日早於出發日才標「尚未開放」', () => {
    // 為什麼：bookable_until 之後的日期還訂不到；沒有資料時無法判斷，不能亂標
    expect(isNotYetBookable('2026-12-31', '2027-01-01')).toBe(true)
    expect(isNotYetBookable('2027-01-01', '2027-01-01')).toBe(false)
    expect(isNotYetBookable(null, '2027-01-01')).toBe(false)
  })
  it('addMonths 月底對齊', () => {
    expect(addMonths('2026-11-30', 3)).toBe('2027-02-28')
    expect(addMonths('2026-10-27', 3)).toBe('2027-01-27')
  })
})
