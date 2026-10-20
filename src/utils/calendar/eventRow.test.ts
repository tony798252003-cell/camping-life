import { describe, it, expect } from 'vitest'
import type { CalendarEventRow } from '../../types/database'
import { taipeiYmd } from '../dateRange'
import { toEventRow, fromEventRow, type EventInput } from './eventRow'

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
