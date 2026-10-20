import { describe, it, expect } from 'vitest'
import { correctTemp, isAltitudeCorrected } from './altitudeTemp'

// 為什麼：山區營地夜溫被高估，低溫警告會漏報，使用者可能沒帶夠保暖裝備
describe('correctTemp', () => {
  it('營區比格點高 1000 m → 降 6°C', () => expect(correctTemp(15, 1500, 500)).toBeCloseTo(9))
  it('營區比格點低 200 m → 上修 1.2°C', () => expect(correctTemp(15, 300, 500)).toBeCloseTo(16.2))
  it('任一海拔為 null 時原值回傳（不能憑空校正）', () => {
    expect(correctTemp(15, null, 500)).toBe(15)
    expect(correctTemp(15, 500, null)).toBe(15)
  })
  it('夜溫 12°C、營區高 800 m → 7.2°C，低於 10°C 會觸發警告', () => {
    const t = correctTemp(12, 1300, 500)
    expect(t).toBeCloseTo(7.2)
    expect(t < 10).toBe(true)
  })
})

describe('isAltitudeCorrected', () => {
  it('任一海拔為 null → false（畫面不能顯示「已依海拔校正」）', () => {
    expect(isAltitudeCorrected(null, 500)).toBe(false)
    expect(isAltitudeCorrected(500, null)).toBe(false)
  })
  it('兩者都有 → true', () => expect(isAltitudeCorrected(1200, 500)).toBe(true))
})
