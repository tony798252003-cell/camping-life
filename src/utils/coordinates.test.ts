import { describe, it, expect } from 'vitest'
import { isLikelyInTaiwan } from './coordinates'

describe('isLikelyInTaiwan', () => {
  // 為什麼：本島座標是常態，不能被誤攔
  it('台北 → true', () => {
    expect(isLikelyInTaiwan(25.03, 121.56)).toBe(true)
  })
  // 為什麼：離島營區（金門、馬祖、蘭嶼）經緯度落在本島範圍外，外框要涵蓋，否則使用者每次存都被警告
  it('金門、馬祖、蘭嶼 → true', () => {
    expect(isLikelyInTaiwan(24.43, 118.32)).toBe(true)
    expect(isLikelyInTaiwan(26.16, 119.95)).toBe(true)
    expect(isLikelyInTaiwan(22.04, 121.55)).toBe(true)
  })
  // 為什麼：真實事故，經度被存成 1214342947（少打小數點），要攔下
  it('經度 1214342947 → false', () => {
    expect(isLikelyInTaiwan(24.5, 1214342947)).toBe(false)
  })
  // 為什麼：緯度與經度填反是常見錯誤（121.5, 24.5），要攔下
  it('經緯度對調 → false', () => {
    expect(isLikelyInTaiwan(121.5, 24.5)).toBe(false)
  })
  // 為什麼：沒座標的營區很多（手動建立），不該被警告
  it('null / undefined / NaN → true（不警告）', () => {
    expect(isLikelyInTaiwan(null, null)).toBe(true)
    expect(isLikelyInTaiwan(undefined, 121)).toBe(true)
    expect(isLikelyInTaiwan(NaN, NaN)).toBe(true)
  })
})
