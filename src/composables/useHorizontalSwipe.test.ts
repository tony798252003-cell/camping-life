import { describe, it, expect } from 'vitest'
import { swipeDirection } from './useHorizontalSwipe'

describe('swipeDirection', () => {
  it('左滑是下一段、右滑是上一段', () => {
    // 跟翻頁的直覺一樣：內容往左推走 = 看後面的日期；方向反了使用者會一直翻錯
    expect(swipeDirection(-80, 5, 200)).toBe(1)
    expect(swipeDirection(80, 5, 200)).toBe(-1)
  })
  it('垂直捲動不換期間，就算手指帶點橫向', () => {
    // 週／日檢視的時間軸要上下捲，捲動時月份或日期被翻走是最嚴重的誤觸
    expect(swipeDirection(-60, 200, 200)).toBeNull()
    // 橫向只比縱向多一點（斜滑）也不算，必須明顯偏水平（> 1.5 倍）
    expect(swipeDirection(-60, 40, 200)).toBeNull()
    expect(swipeDirection(-61, 40, 200)).toBe(1)
  })
  it('小幅抖動不算', () => {
    // 點日期格時手指難免移動幾 px，不能因此換期間
    expect(swipeDirection(-49, 0, 100)).toBeNull()
    expect(swipeDirection(-50, 0, 100)).toBe(1)
  })
  it('拖太久不算', () => {
    // 慢慢拖（例如按住在找東西）不是「滑一下」，超過 600ms 不觸發
    expect(swipeDirection(-120, 0, 600)).toBeNull()
    expect(swipeDirection(-120, 0, 599)).toBe(1)
  })
})
