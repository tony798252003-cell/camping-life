// 營區庫的篩選／排序純函式（元件只負責 UI 狀態）
import type { Campsite } from '../types/database'

// ---- 海拔 ----
export interface AltitudeBand {
    key: string
    label: string
    min: number | null
    max: number | null
}

// EasyCamp 的 6 個級距；整數公尺，所以 300 / 301 是分界
export const ALTITUDE_BANDS: AltitudeBand[] = [
    { key: 'lt300', label: '300m以下', min: null, max: 300 },
    { key: '301-500', label: '301–500m', min: 301, max: 500 },
    { key: '501-800', label: '501–800m', min: 501, max: 800 },
    { key: '801-1000', label: '801–1000m', min: 801, max: 1000 },
    { key: '1001-1500', label: '1001–1500m', min: 1001, max: 1500 },
    { key: 'gt1500', label: '1501m以上', min: 1501, max: null },
]

// 沒有設定上下限（不拘）時才保留沒填海拔的營區；一旦限制海拔，未知海拔無法證明符合
export function matchesAltitude(altitude: number | null | undefined, min: number | null, max: number | null): boolean {
    if (min === null && max === null) return true
    if (altitude === null || altitude === undefined) return false
    if (min !== null && altitude < min) return false
    if (max !== null && altitude > max) return false
    return true
}

// 篩選條件目前剛好對應某個級距就回傳其 key；自訂範圍（進階篩選設的）回 ''
export function altitudeBandKey(min: number | null, max: number | null): string {
    return ALTITUDE_BANDS.find(b => b.min === min && b.max === max)?.key ?? ''
}

// ---- Google 評分 ----
export const GOOGLE_MIN_RATING = 4.0
export const GOOGLE_MIN_REVIEWS = 20

type GoogleFields = Pick<Campsite, 'google_rating' | 'google_rating_count' | 'google_business_status'>

// 去過的營區不隱藏（自己住過，不該被別人的分數藏起來）；
// 沒有 Google 資料的（自己手動新增）也不隱藏，因為「沒資料」不等於「低分」
export function isHiddenByGoogle(c: GoogleFields, visited: boolean): boolean {
    if (visited) return false
    if (c.google_business_status === 'CLOSED_PERMANENTLY') return true
    if (c.google_rating === null || c.google_rating === undefined) return false
    return c.google_rating < GOOGLE_MIN_RATING || (c.google_rating_count ?? 0) < GOOGLE_MIN_REVIEWS
}

// ---- 快捷標籤（和進階篩選互相獨立，兩邊都是 AND）----
type FeatureFields = Pick<Campsite, 'spot_types' | 'scenery_features' | 'water_features' | 'playground_features'>

export interface FeatureChip {
    key: string
    label: string
    test: (c: FeatureFields) => boolean
}

const PLAY_WATER = ['戲水池', '溪流', '河流', '瀑布', '滑水道']

export const FEATURE_CHIPS: FeatureChip[] = [
    { key: 'shelter', label: '有雨棚', test: c => !!c.spot_types?.includes('雨棚') },
    { key: 'cloud', label: '有雲海', test: c => !!c.scenery_features?.includes('雲海') },
    { key: 'night', label: '有夜景', test: c => !!c.scenery_features?.includes('夜景') },
    { key: 'water', label: '可玩水', test: c => PLAY_WATER.some(w => c.water_features?.includes(w)) },
    { key: 'kids', label: '親子', test: c => !!c.playground_features?.length },
    { key: 'forest', label: '森林', test: c => !!c.scenery_features?.includes('森林') },
]

// ---- 去過 / 沒去過 ----
export type VisitedSegment = 'all' | 'visited' | 'unvisited'

export function matchesSegment(segment: VisitedSegment, visited: boolean): boolean {
    return segment === 'all' || (segment === 'visited') === visited
}

// ---- 排序 ----
export type CampsiteSort = 'rating' | 'name'

// 評分高→低；沒評分的排最後（它們是自己新增的，不該蓋過有證據的好營區）；同分評論多的在前，再比名稱讓順序穩定
export function sortCampsites<T extends GoogleFields & { name: string }>(list: T[], sort: CampsiteSort): T[] {
    const byName = (a: T, b: T) => a.name.localeCompare(b.name, 'zh-Hant')
    if (sort === 'name') return [...list].sort(byName)
    return [...list].sort((a, b) => {
        const ra = a.google_rating ?? null
        const rb = b.google_rating ?? null
        if (ra === null && rb === null) return byName(a, b)
        if (ra === null) return 1
        if (rb === null) return -1
        if (ra !== rb) return rb - ra
        const ca = a.google_rating_count ?? 0
        const cb = b.google_rating_count ?? 0
        return cb !== ca ? cb - ca : byName(a, b)
    })
}
