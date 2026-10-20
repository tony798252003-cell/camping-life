import { describe, it, expect } from 'vitest'
import { browseableTrips, defaultTripIndex, pickNextTrip, type TripLike } from './nextTrip'

const trip = (o: Partial<TripLike> & { id: number; trip_date: string }): TripLike => ({
  duration_days: 1, status: 'booked', night_rush: false, merged_into_id: null, ...o,
})

// 為什麼：這張卡置頂在首頁，挑錯會直接誤導出發安排
describe('pickNextTrip', () => {
  const today = '2026-10-17'
  it('進行中的行程優先於未來的行程', () => {
    // 已經在營區的人，卡片要顯示現在這趟而不是下一趟
    const a = trip({ id: 1, trip_date: '2026-10-16', duration_days: 3 })
    const b = trip({ id: 2, trip_date: '2026-10-20' })
    expect(pickNextTrip([b, a], today)).toBe(a)
  })
  it('今晚夜衝出發的行程優先於進行中的行程', () => {
    // 夜衝前一晚就要出發，要先提醒
    const going = trip({ id: 1, trip_date: '2026-10-16', duration_days: 3 })
    const rush = trip({ id: 2, trip_date: '2026-10-18', night_rush: true })
    expect(pickNextTrip([going, rush], today)).toBe(rush)
  })
  it('cancelled、已合併、昨天已結束的不算；沒有符合回 null', () => {
    // 取消或已被合併的行程不應再被當成下一趟
    const trips = [
      trip({ id: 1, trip_date: '2026-10-20', status: 'cancelled' }),
      trip({ id: 2, trip_date: '2026-10-20', merged_into_id: 9 }),
      trip({ id: 3, trip_date: '2026-10-16' }),
    ]
    expect(pickNextTrip(trips, today)).toBeNull()
  })
  it('同一天有兩筆取 id 小的', () => {
    // 結果要穩定，不隨資料回傳順序跳動
    const a = trip({ id: 5, trip_date: '2026-10-20' })
    const b = trip({ id: 3, trip_date: '2026-10-20' })
    expect(pickNextTrip([a, b], today)).toBe(b)
  })
})

// 為什麼：卡片可以前後翻看，清單和預設位置錯了就會翻到不存在或被取消的行程
describe('browseableTrips / defaultTripIndex', () => {
  const today = '2026-10-17'
  it('沒有行程：清單為空、預設 -1', () => {
    // 空狀態要顯示「新增露營」而不是壞掉
    expect(browseableTrips([])).toEqual([])
    expect(defaultTripIndex([], today)).toBe(-1)
  })
  it('排除取消與已合併，並依日期、id 排序', () => {
    // 和行事曆一致，否則首頁翻得到日曆上看不到的行程
    const a = trip({ id: 2, trip_date: '2026-11-01' })
    const b = trip({ id: 1, trip_date: '2026-11-01' })
    const c = trip({ id: 3, trip_date: '2026-09-01' })
    const x = trip({ id: 4, trip_date: '2026-10-20', status: 'cancelled' })
    const y = trip({ id: 5, trip_date: '2026-10-21', merged_into_id: 1 })
    expect(browseableTrips([a, x, b, y, c]).map((t) => t.id)).toEqual([3, 1, 2])
  })
  it('預設位置就是 pickNextTrip 挑的那趟', () => {
    // 進入首頁看到的必須和以前一樣
    const list = browseableTrips([
      trip({ id: 1, trip_date: '2026-09-01' }),
      trip({ id: 2, trip_date: '2026-10-16', duration_days: 3 }),
      trip({ id: 3, trip_date: '2026-10-25' }),
    ])
    expect(list[defaultTripIndex(list, today)]!.id).toBe(2)
  })
  it('只有過去的行程：預設是最近的一趟', () => {
    // 沒有下一趟時，停在最近完成的比空白更有用
    const list = browseableTrips([trip({ id: 1, trip_date: '2026-08-01' }), trip({ id: 2, trip_date: '2026-09-01' })])
    expect(defaultTripIndex(list, today)).toBe(1)
  })
})
