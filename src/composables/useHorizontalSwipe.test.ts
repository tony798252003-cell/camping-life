import { describe, it, expect } from 'vitest'
import { dragOffset, pagerDecision, swipeDirection } from './useHorizontalSwipe'

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

describe('dragOffset', () => {
  it('偏水平才跟手、而且打折；偏垂直捲動時畫面不能左右晃', () => {
    expect(dragOffset(-100, 10)).toBe(-70)
    expect(dragOffset(30, 80)).toBe(0)
  })
})

describe('pagerDecision', () => {
  const W = 360 // 手機寬度
  it('快速一滑：規則同 swipeDirection，左滑下一段、右滑上一段', () => {
    // 輪播和週／日檢視要同一套手感，否則同一個 app 裡有的地方滑得動、有的滑不動
    expect(pagerDecision(-80, 5, 200, W)).toBe(1)
    expect(pagerDecision(80, 5, 200, W)).toBe(-1)
  })
  it('慢慢拖但超過 1/3 寬度也換頁', () => {
    // 跟手拖曳時使用者是看著鄰月拉進來的，拉過三分之一放手卻彈回會覺得 app 不聽話
    expect(pagerDecision(-120, 0, 1500, W)).toBe(1)
    expect(pagerDecision(120, 0, 1500, W)).toBe(-1)
    // 慢拖不到 1/3 是在猶豫，彈回原本的月份
    expect(pagerDecision(-119, 0, 1500, W)).toBe(0)
  })
  it('偏垂直的手勢永遠不換頁', () => {
    // 月格下方是行程清單，上下捲時手指帶點橫向不能把月份翻走
    expect(pagerDecision(-150, 200, 1500, W)).toBe(0)
    expect(pagerDecision(-60, 60, 200, W)).toBe(0)
  })
  it('小幅移動（點日期格的抖動）不換頁', () => {
    expect(pagerDecision(-20, 0, 100, W)).toBe(0)
  })
  it('量不到寬度（0）時只靠快速一滑判斷，不會因為 0/3 = 0 而任何拖曳都換頁', () => {
    expect(pagerDecision(-10, 0, 1500, 0)).toBe(0)
  })
})
