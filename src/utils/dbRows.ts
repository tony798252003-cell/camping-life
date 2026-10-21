import type { Tables } from '../types/supabase'
import type { Campsite, GearItem } from '../types/database'

// DB 欄位可空，但 ROI 計算一律當數字用（新增時都有帶 0）
export const toGearItem = (row: Tables<'camping_gear'>): GearItem => ({
  ...row,
  cost: row.cost ?? 0,
  rental_price: row.rental_price ?? 0,
  base_usage_count: row.base_usage_count ?? 0,
})

export const toGearItems = (rows: Tables<'camping_gear'>[] | null): GearItem[] => (rows ?? []).map(toGearItem)

// campsites 的 JSONB 欄位（field_sources、amenities、capacity_zones）在 DB 端是 Json，
// 結構由寫入端保證，這是唯一收窄的地方
export const toCampsites = (rows: Tables<'campsites'>[] | null): Campsite[] => (rows ?? []) as unknown as Campsite[]
