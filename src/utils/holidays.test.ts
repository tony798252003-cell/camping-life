import { describe, it, expect } from 'vitest'
import { isHoliday } from './holidays'

// 為什麼：首頁和車程估算都依賴假日判斷，日期錯了會誤報塞車或漏標連假
describe('isHoliday', () => {
  it('國慶日是假日', () => expect(isHoliday('2026-10-10')).toBeTruthy())
  it('一般平日不是假日', () => expect(isHoliday('2026-10-14')).toBeFalsy())
})
