import { describe, it, expect } from 'vitest'
import type { CalendarEventRow } from '../../types/database'
import { taipeiYmd } from '../dateRange'
import { toEventRow, fromEventRow, normalizeTimedRange, isBumpedRange, type EventInput } from './eventRow'

const allDay: EventInput = {
  title: 'x', description: null, categoryId: 'c1', allDay: true, startDate: '2026-10-17', endDate: '2026-10-18',
}

describe('toEventRow', () => {
  // 為什麼：全天事件的真正資料是 start_date/end_date；start_time/end_time 是 NOT NULL 舊欄位，寫台北 00:00，
  // 而且它的台北日期必須等於 start_date，M3 合併後的對齊 SQL 才不會改到新版寫入的事件（規格 §6.2，§17 S5）
  it('全天事件', () => {
    const r = toEventRow(allDay)
    expect(r).toMatchObject({
      start_time: '2026-10-17T00:00:00+08:00', end_time: '2026-10-18T00:00:00+08:00',
      start_date: '2026-10-17', end_date: '2026-10-18', visibility: 'private', is_all_day: true,
    })
    expect(taipeiYmd(r.start_time)).toBe(allDay.startDate)
    expect(taipeiYmd(r.end_time)).toBe(allDay.endDate)
  })
  it('timed 事件 start_date 為 null', () => {
    // 有時段的事件靠 start_time 判斷日期與時間，不寫 start_date
    const r = toEventRow({ ...allDay, allDay: false, endDate: '2026-10-17', startTime: '09:00', endTime: '10:00' })
    expect(r.start_date).toBeNull()
    expect(r.start_time).toBe('2026-10-17T09:00:00+08:00')
    expect(r.end_time).toBe('2026-10-17T10:00:00+08:00')
  })
  it('round trip', () => {
    // 編輯既有事件時，表單載入再存回不能改變資料
    const timed: EventInput = { ...allDay, allDay: false, endDate: '2026-10-18', startTime: '22:00', endTime: '01:30', cpblGameId: 'g1' }
    for (const x of [allDay, timed]) {
      const row = { id: 'e', ...toEventRow(x) } as unknown as CalendarEventRow
      expect(fromEventRow(row)).toEqual({ cpblGameId: null, ...x })
    }
  })
})

describe('null category 與跨夜時間', () => {
  const row = (o: Partial<CalendarEventRow>) => ({
    id: 'e1', title: 't', description: null, category_id: null, is_all_day: true, start_date: '2026-10-17', end_date: '2026-10-17',
    start_time: '2026-10-17T00:00:00+08:00', end_time: '2026-10-17T00:00:00+08:00', cpbl_game_id: null, ...o,
  }) as CalendarEventRow
  // 為什麼：舊資料 category_id 為 null，送 '' 會讓 Postgres 22P02 導致永遠存不了
  it('null category 往返不會送出空字串', () => {
    const input = fromEventRow(row({}))
    expect(toEventRow(input).category_id).toBeNull()
  })
  // 為什麼：22:00–02:00 沒改結束日時，不能默默變成 0 分鐘事件
  it('同日結束早於開始改成隔天', () => {
    expect(normalizeTimedRange('2026-10-17', '2026-10-17', '22:00', '02:00')).toEqual({ endDate: '2026-10-18', bumped: true })
    expect(normalizeTimedRange('2026-10-17', '2026-10-17', '09:00', '10:00')).toEqual({ endDate: '2026-10-17', bumped: false })
    expect(normalizeTimedRange('2026-10-17', '2026-10-18', '22:00', '02:00').bumped).toBe(false)
  })
  // 為什麼：09:00–10:00 改開始 14:00 被自動改隔天，再把結束改成 15:00 不能存成 25 小時的事件
  it('自動隔天後時間合理就還原同一天', () => {
    const r1 = normalizeTimedRange('2026-10-17', '2026-10-17', '14:00', '10:00')
    expect(r1).toEqual({ endDate: '2026-10-18', bumped: true })
    expect(normalizeTimedRange('2026-10-17', r1.endDate, '14:00', '10:00', true).bumped).toBe(true)
    expect(normalizeTimedRange('2026-10-17', r1.endDate, '14:00', '15:00', true)).toEqual({ endDate: '2026-10-17', bumped: false })
  })
  // 為什麼：時間改合理後，「已改成隔天」提示不能留在畫面上
  it('isBumpedRange 只在仍跨午夜時為真', () => {
    expect(isBumpedRange('2026-10-17', '2026-10-18', '22:00', '02:00')).toBe(true)
    expect(isBumpedRange('2026-10-17', '2026-10-18', '22:00', '23:00')).toBe(false)
    expect(isBumpedRange('2026-10-17', '2026-10-17', '22:00', '23:00')).toBe(false)
  })
  // 為什麼：使用者手動選了結束日，就是他要的，不能再被自動改回
  it('手動改結束日後不再還原', () => {
    expect(normalizeTimedRange('2026-10-17', '2026-10-20', '14:00', '15:00', true)).toEqual({ endDate: '2026-10-20', bumped: false })
  })
})
