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

// 去過或加入最愛的營區不隱藏（自己住過／自己挑的，不該被別人的分數藏起來）；
// 沒有 Google 資料的（自己手動新增）也不隱藏，因為「沒資料」不等於「低分」
export function isHiddenByGoogle(c: GoogleFields, visited: boolean, favorite = false): boolean {
    if (visited || favorite) return false
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
// 行程 status 幾乎都停在 planning（沒人回頭改），所以跟首頁／統計一樣以日期判斷：日期已過且沒取消就算去過
export function isVisitedTrip(t: { status: string | null; trip_date: string | null }, today: string): boolean {
    if (t.status === 'cancelled') return false
    if (t.status === 'completed' || t.status === 'booked') return true
    return !!t.trip_date && t.trip_date < today
}

export type VisitedSegment = 'all' | 'visited' | 'unvisited' | 'favorite'

// 最愛和去過無關：最愛分段只看最愛，去過／沒去過只看去過
export function matchesSegment(segment: VisitedSegment, visited: boolean, favorite: boolean): boolean {
    if (segment === 'all') return true
    if (segment === 'favorite') return favorite
    return (segment === 'visited') === visited
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

// ---- 要去的月份（依「目前可訂到」）----
export interface MonthOption {
    key: string // YYYY-MM
    label: string // 2026年11月
}

// 從今天所在的月份起連續 count 個月；today 用 todayYmd()（台北），不依賴系統時區
export function upcomingMonths(today: string, count = 12): MonthOption[] {
    const [y, m] = today.split('-').map(Number) as [number, number]
    return Array.from({ length: count }, (_, i) => {
        const idx = y * 12 + (m - 1) + i
        const year = Math.floor(idx / 12)
        const month = (idx % 12) + 1
        return { key: `${year}-${String(month).padStart(2, '0')}`, label: `${year}年${month}月` }
    })
}

// 該月 1 號已經開放訂位 → 至少有一部分月份可訂；YYYY-MM-DD 字串可直接比大小
export function isBookableInMonth(bookableUntil: string | null | undefined, monthKey: string): boolean {
    return !!bookableUntil && bookableUntil >= `${monthKey}-01`
}

// 沒有 bookable_until 的無法判斷，獨立成 noData 讓 UI 決定要不要顯示
export function splitByBookableMonth<T extends { bookable_until?: string | null }>(list: T[], monthKey: string): { matched: T[]; noData: T[] } {
    const matched: T[] = []
    const noData: T[] = []
    for (const c of list) {
        if (!c.bookable_until) noData.push(c)
        else if (isBookableInMonth(c.bookable_until, monthKey)) matched.push(c)
    }
    return { matched, noData }
}

// 2027-04-24 → 2027/4/24
export function formatYmdSlash(ymd: string): string {
    const [y, m, d] = ymd.split('-').map(Number)
    return `${y}/${m}/${d}`
}
