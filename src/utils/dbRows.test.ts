import { describe, it, expect } from 'vitest'
import { toGearItem, toCampsites } from './dbRows'
import type { Tables } from '../types/supabase'

const gearRow = (over: Partial<Tables<'camping_gear'>> = {}): Tables<'camping_gear'> => ({
  base_usage_count: null, brand: null, category: null, cost: null, created_at: '2026-01-01',
  family_id: null, id: 1, image_url: null, name: '帳', rental_price: null, type: 'tent',
  usage_count: null, user_id: 'u', ...over,
})

describe('toGearItem', () => {
  it('DB 欄位可空，但 ROI 計算一律當數字用：null 要變成 0，否則算出 NaN', () => {
    const g = toGearItem(gearRow())
    expect([g.cost, g.rental_price, g.base_usage_count]).toEqual([0, 0, 0])
  })
  it('已有數值時不能被改掉，否則裝備成本會被洗掉', () => {
    const g = toGearItem(gearRow({ cost: 5000, rental_price: 300, base_usage_count: 4 }))
    expect([g.cost, g.rental_price, g.base_usage_count]).toEqual([5000, 300, 4])
  })
})

describe('toCampsites', () => {
  it('查詢結果為 null（失敗或無資料）時回空陣列，畫面才不會壞', () => {
    expect(toCampsites(null)).toEqual([])
  })
})
