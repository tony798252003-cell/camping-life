import { describe, it, expect } from 'vitest'
import { shouldCollapseReview } from './tripReviewCollapse'

// 為什麼：出發前填不了評分／心得，收合避免干擾；出發當天起要能立刻填
// 2026-10-22T02:00Z = 台北 10/22 10:00
const NOW = new Date('2026-10-22T02:00:00Z')

describe('shouldCollapseReview', () => {
  it('新增行程收合', () => expect(shouldCollapseReview(null, true, NOW)).toBe(true))
  it('未來行程收合', () => expect(shouldCollapseReview('2026-10-23', false, NOW)).toBe(true))
  it('今天出發不收合（邊界）', () => expect(shouldCollapseReview('2026-10-22', false, NOW)).toBe(false))
  it('過去行程不收合', () => expect(shouldCollapseReview('2026-10-01', false, NOW)).toBe(false))
  it('以台北日期為準：UTC 還是 10/21 晚上、台北已 10/22', () => {
    expect(shouldCollapseReview('2026-10-22', false, new Date('2026-10-21T17:00:00Z'))).toBe(false)
  })
  it('既有行程沒日期不收合', () => expect(shouldCollapseReview(undefined, false, NOW)).toBe(false))
})
