import type { NewGearItem } from '../types/database'

// camping_gear 沒有 purchase_date 欄位，payload 只放實際存在的欄位
export const DEFAULT_GEAR_EXAMPLES: Omit<NewGearItem, 'user_id'>[] = [
  { name: '屋脊13', base_usage_count: 19, cost: 8992, rental_price: 1400, type: 'tent', category: 'tent' },
  { name: 'CC3', base_usage_count: 12, cost: 34400, rental_price: 2700, type: 'tent', category: 'tent' },
  { name: '天幕', base_usage_count: 13, cost: 4400, rental_price: 800, type: 'tarp', category: 'tarp' },
]

export const buildNewGearPayload = (userId: string): NewGearItem => ({
  name: '新裝備',
  base_usage_count: 0,
  cost: 0,
  rental_price: 0,
  type: 'other',
  category: 'other',
  user_id: userId,
})

// RLS 要求 auth.uid() = user_id，範例資料必須帶 user_id
export const buildExamplePayloads = (userId: string): NewGearItem[] =>
  DEFAULT_GEAR_EXAMPLES.map(e => ({ ...e, user_id: userId }))

export const buildNewTentPayload = (
  input: { name: string; brand: string; imageUrl?: string | null },
  userId: string
): NewGearItem => ({
  name: input.name.trim(),
  brand: input.brand.trim(),
  base_usage_count: 0,
  cost: 0,
  type: 'tent',
  category: 'tent',
  user_id: userId,
  image_url: input.imageUrl || '',
})
