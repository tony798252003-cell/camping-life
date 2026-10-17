import { describe, it, expect } from 'vitest'
import {
  taipeiYmd, taipeiMinutes, todayYmd, addDays, diffDays, eachDay, weekdayMon0, taipeiIso, tripRange,
} from './dateRange'

// 為什麼：行事曆差一天是最傷信任的 bug；這些測試在 UTC 與 America/Los_Angeles 下都要通過
describe('dateRange', () => {
  it('taipeiYmd：UTC 晚上 = 台北隔天', () => {
    // 系統 TZ 不是台北時，不能用 local date 方法
    expect(taipeiYmd('2026-10-16T16:30:00Z')).toBe('2026-10-17')
    expect(taipeiYmd(new Date('2026-10-16T15:59:00Z'))).toBe('2026-10-16')
  })
  it('taipeiMinutes：台北當日 00:00 起算', () => {
    // 時間軸排版靠它，且午夜不能變成 24:xx
    expect(taipeiMinutes('2026-10-17T11:05:00Z')).toBe(19 * 60 + 5)
    expect(taipeiMinutes('2026-10-16T16:00:00Z')).toBe(0)
  })
  it('todayYmd 用台北日期', () => {
    // 傳入 UTC 16:30 時，台北已是隔天
    expect(todayYmd(new Date('2026-10-16T16:30:00Z'))).toBe('2026-10-17')
  })
  it('addDays 跨年、閏日、負數', () => {
    // 純字串運算，才不會被 DST 或 TZ 影響
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09') // 美國 DST 切換日
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
  })
  it('diffDays = b - a', () => {
    // 跨 DST 也必須是整數天
    expect(diffDays('2026-03-07', '2026-03-10')).toBe(3)
    expect(diffDays('2026-10-17', '2026-10-15')).toBe(-2)
  })
  it('eachDay 含頭尾', () => {
    // endDate 包含當天
    expect(eachDay('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'])
    expect(eachDay('2026-10-30', '2026-10-30')).toEqual(['2026-10-30'])
    expect(eachDay('2026-10-31', '2026-10-30')).toEqual([])
  })
  it('weekdayMon0：0=週一 … 6=週日', () => {
    // 月曆格子以週一開頭
    expect(weekdayMon0('2026-10-19')).toBe(0)
    expect(weekdayMon0('2026-10-25')).toBe(6)
  })
  it('taipeiIso', () => {
    // 寫入 DB 的時間必須明確帶 +08:00
    expect(taipeiIso('2026-10-17', '08:30')).toBe('2026-10-17T08:30:00+08:00')
  })
  it('tripRange：結束日 = trip_date + duration_days - 1', () => {
    // duration_days 含頭尾
    expect(tripRange('2026-10-23', 3)).toEqual({ start: '2026-10-23', end: '2026-10-25' })
    expect(tripRange('2026-10-23', 0)).toEqual({ start: '2026-10-23', end: '2026-10-23' })
    expect(tripRange('2026-10-23', null)).toEqual({ start: '2026-10-23', end: '2026-10-23' })
    expect(tripRange('2026-10-23', -2)).toEqual({ start: '2026-10-23', end: '2026-10-23' })
  })
})
