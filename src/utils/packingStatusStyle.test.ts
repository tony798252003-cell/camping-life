import { describe, it, expect } from 'vitest'
import { PACKING_STYLES, packingStyle } from './packingStatusStyle'

// 為什麼：曾有 risk/chance 沒樣式，「留意降雨」顯示成無底色＋太陽。每個 status 都必須有完整樣式。
const ALL_STATUSES = ['wet', 'risk', 'chance', 'damp', 'drying', 'dry', 'perfect'] as const

describe('packingStatusStyle', () => {
  it.each(ALL_STATUSES)('%s 有 bg / icon / label / desc 與圖示', (s) => {
    const st = packingStyle(s)
    expect(st).toBeTruthy()
    expect(st.bg).toMatch(/^bg-/)
    expect(st.icon).toMatch(/^text-/)
    expect(st.label).toMatch(/^text-/)
    expect(st.desc).toMatch(/^text-/)
    expect(['sun', 'rain']).toContain(st.iconType)
  })

  it('樣式表沒有多餘或缺少的 status', () => {
    expect(Object.keys(PACKING_STYLES).sort()).toEqual([...ALL_STATUSES].sort())
  })

  it('risk / chance 用雨雲圖示', () => {
    expect(packingStyle('risk').iconType).toBe('rain')
    expect(packingStyle('chance').iconType).toBe('rain')
  })
})
