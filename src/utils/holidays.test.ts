import { describe, it, expect } from 'vitest'
import { isHoliday } from './holidays'

// 為什麼：首頁和車程估算都依賴假日判斷，日期錯了會誤報塞車或漏標連假
describe('isHoliday', () => {
  it('國慶日是假日', () => expect(isHoliday('2026-10-10')).toBeTruthy())
  it('一般平日不是假日', () => expect(isHoliday('2026-10-14')).toBeFalsy())
  // 為什麼：2027 年的連假如果沒有資料，車程的塞車提示會全部失效
  it('2027 元旦是假日', () => expect(isHoliday('2027-01-01')).toBeTruthy())
  it('2027 國慶日是假日', () => expect(isHoliday('2027-10-10')).toBeTruthy())
  it('2027 春節補假（2/9）是假日', () => expect(isHoliday('2027-02-09')).toBeTruthy())
})
