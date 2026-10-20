import { describe, it, expect } from 'vitest'
import { pickNextTrip, type TripLike } from './nextTrip'

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
