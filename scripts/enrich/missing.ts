// 找出還缺資料的營區（純函式，供 list-missing.ts 與測試使用）。
// 欄位集合＝api/_lib/gemini.ts 的 Gemini 草稿會填的欄位（mergeGemini 把 ai_summary 寫到 campsite_notes）。

export const ENRICHABLE_FIELDS = [
  'spot_types',
  'scenery_features',
  'water_features',
  'playground_features',
  'booking_method',
  'shower_restrictions',
  'night_rush_time',
  'booking_timing',
  'check_in_time',
  'check_out_time',
  'phone',
  'amenities',
  'campsite_notes',
] as const

export interface CampsiteRow {
  id: number
  name: string
  city: string | null
  district: string | null
  google_maps_url: string | null
  created_at: string | null
  merged_into_id: number | null
  field_sources: unknown
  [k: string]: unknown
}

export interface MissingItem {
  id: number
  name: string
  city: string | null
  district: string | null
  google_maps_url: string | null
  missing: string[]
  fieldSourceKeys: string[]
  tripCount: number
}

export interface Options {
  limit: number
  city?: string
  visited?: boolean
}

// 空值：null、''、[]、{}，或 amenities 物件裡沒有任何 boolean（has_* 都沒填）
export function isEmptyValue(key: string, v: unknown): boolean {
  if (v === null || v === undefined) return true
  if (typeof v === 'string') return v.trim() === ''
  if (Array.isArray(v)) return v.length === 0
  if (typeof v === 'object') {
    const vals = Object.values(v as object)
    return key === 'amenities' ? !vals.some((x) => typeof x === 'boolean') : vals.length === 0
  }
  return false
}

export function missingFields(c: CampsiteRow): string[] {
  return ENRICHABLE_FIELDS.filter((k) => isEmptyValue(k, c[k]))
}

export function selectMissing(
  campsites: CampsiteRow[],
  tripCounts: Map<number, number>,
  opts: Options,
): MissingItem[] {
  const items: MissingItem[] = []
  for (const c of campsites) {
    if (c.merged_into_id !== null) continue // 已合併的是舊列，不要補
    if (opts.city && c.city !== opts.city) continue
    const tripCount = tripCounts.get(c.id) ?? 0
    if (opts.visited && tripCount === 0) continue
    const missing = missingFields(c)
    if (missing.length === 0) continue
    const fs = c.field_sources
    items.push({
      id: c.id,
      name: c.name,
      city: c.city,
      district: c.district,
      google_maps_url: c.google_maps_url,
      missing,
      fieldSourceKeys: fs && typeof fs === 'object' ? Object.keys(fs) : [],
      tripCount,
      // created_at 只用來排序，不輸出
      ...({ _created: c.created_at ?? '' } as object),
    })
  }
  items.sort(
    (a, b) =>
      b.tripCount - a.tripCount ||
      String((b as any)._created).localeCompare(String((a as any)._created)) ||
      b.id - a.id,
  )
  for (const i of items) delete (i as any)._created
  return items.slice(0, opts.limit)
}
