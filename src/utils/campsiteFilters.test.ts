import { describe, it, expect } from 'vitest'
import {
    ALTITUDE_BANDS,
    FEATURE_CHIPS,
    altitudeBandKey,
    isHiddenByGoogle,
    matchesAltitude,
    matchesSegment,
    sortCampsites,
} from './campsiteFilters'

const band = (key: string) => ALTITUDE_BANDS.find(b => b.key === key)!
const inBand = (key: string, alt: number | null) => matchesAltitude(alt, band(key).min, band(key).max)

describe('海拔級距', () => {
    it('300 屬於「300m以下」、301 屬於下一級，級距不重疊也不漏', () => {
        expect(inBand('lt300', 300)).toBe(true)
        expect(inBand('lt300', 301)).toBe(false)
        expect(inBand('301-500', 301)).toBe(true)
        expect(inBand('301-500', 300)).toBe(false)
    })
    it('1000 / 1001 與 1500 / 1501 的分界跟 EasyCamp 一致', () => {
        expect(inBand('801-1000', 1000)).toBe(true)
        expect(inBand('801-1000', 1001)).toBe(false)
        expect(inBand('1001-1500', 1001)).toBe(true)
        expect(inBand('1001-1500', 1500)).toBe(true)
        expect(inBand('1001-1500', 1501)).toBe(false)
        expect(inBand('gt1500', 1501)).toBe(true)
    })
    it('每個整數海拔只會落在一個級距', () => {
        for (const alt of [0, 300, 301, 500, 501, 800, 801, 1000, 1001, 1500, 1501, 3000]) {
            expect(ALTITUDE_BANDS.filter(b => inBand(b.key, alt))).toHaveLength(1)
        }
    })
    it('沒填海拔只在「不拘」顯示，選了級距就不顯示（無法證明符合）', () => {
        expect(matchesAltitude(null, null, null)).toBe(true)
        expect(matchesAltitude(undefined, null, null)).toBe(true)
        for (const b of ALTITUDE_BANDS) expect(inBand(b.key, null)).toBe(false)
    })
    it('篩選條件對應不到級距（進階篩選自訂範圍）時下拉要顯示不拘而不是誤選', () => {
        expect(altitudeBandKey(801, 1000)).toBe('801-1000')
        expect(altitudeBandKey(null, null)).toBe('')
        expect(altitudeBandKey(800, null)).toBe('')
    })
})

const g = (rating: number | null, count: number | null, status: string | null = null) => ({
    google_rating: rating,
    google_rating_count: count,
    google_business_status: status,
})

describe('Google 隱藏規則', () => {
    it('評分低於 4.0 隱藏，剛好 4.0 保留', () => {
        expect(isHiddenByGoogle(g(3.9, 500), false)).toBe(true)
        expect(isHiddenByGoogle(g(4.0, 500), false)).toBe(false)
    })
    it('評論少於 20 隱藏（少量評論的高分不可信），剛好 20 保留', () => {
        expect(isHiddenByGoogle(g(5.0, 19), false)).toBe(true)
        expect(isHiddenByGoogle(g(4.5, 20), false)).toBe(false)
    })
    it('永久歇業一律隱藏，即使評分很高；暫停營業不隱藏（可能只是季節性）', () => {
        expect(isHiddenByGoogle(g(4.8, 900, 'CLOSED_PERMANENTLY'), false)).toBe(true)
        expect(isHiddenByGoogle(g(4.8, 900, 'CLOSED_TEMPORARILY'), false)).toBe(false)
    })
    it('沒有 Google 資料的（自己新增）不隱藏：沒資料不等於低分', () => {
        expect(isHiddenByGoogle(g(null, null), false)).toBe(false)
    })
    it('去過的營區永遠不隱藏，包含低分與歇業', () => {
        expect(isHiddenByGoogle(g(3.2, 5), true)).toBe(false)
        expect(isHiddenByGoogle(g(4.8, 900, 'CLOSED_PERMANENTLY'), true)).toBe(false)
    })
})

describe('快捷標籤', () => {
    const chip = (k: string) => FEATURE_CHIPS.find(c => c.key === k)!
    const base = { spot_types: null, scenery_features: null, water_features: null, playground_features: null }
    it('可玩水只算能下去玩的水域，不含其他水域標籤', () => {
        expect(chip('water').test({ ...base, water_features: ['瀑布'] })).toBe(true)
        expect(chip('water').test({ ...base, water_features: ['湖泊'] })).toBe(false)
        expect(chip('water').test(base)).toBe(false)
    })
    it('親子 = 有任一遊樂設施；空陣列不算', () => {
        expect(chip('kids').test({ ...base, playground_features: ['溜滑梯'] })).toBe(true)
        expect(chip('kids').test({ ...base, playground_features: [] })).toBe(false)
    })
    it('雲海／夜景／森林看景觀，雨棚看營位類型', () => {
        expect(chip('cloud').test({ ...base, scenery_features: ['雲海'] })).toBe(true)
        expect(chip('night').test({ ...base, scenery_features: ['雲海'] })).toBe(false)
        expect(chip('forest').test({ ...base, scenery_features: ['森林'] })).toBe(true)
        expect(chip('shelter').test({ ...base, spot_types: ['雨棚'] })).toBe(true)
        expect(chip('shelter').test({ ...base, scenery_features: ['雨棚'] })).toBe(false)
    })
})

describe('去過／沒去過分段', () => {
    it('全部不分；去過與沒去過互斥', () => {
        expect(matchesSegment('all', true)).toBe(true)
        expect(matchesSegment('all', false)).toBe(true)
        expect(matchesSegment('visited', true)).toBe(true)
        expect(matchesSegment('visited', false)).toBe(false)
        expect(matchesSegment('unvisited', false)).toBe(true)
        expect(matchesSegment('unvisited', true)).toBe(false)
    })
})

describe('排序', () => {
    const s = (name: string, rating: number | null, count: number | null = null) => ({ name, ...g(rating, count) })
    it('評分高到低，沒評分排最後（不可蓋過有評分的營區）', () => {
        const out = sortCampsites([s('無', null), s('乙', 4.2, 50), s('甲', 4.8, 50)], 'rating')
        expect(out.map(c => c.name)).toEqual(['甲', '乙', '無'])
    })
    it('同分時評論多的在前，因為樣本大較可信', () => {
        const out = sortCampsites([s('少', 4.5, 30), s('多', 4.5, 600)], 'rating')
        expect(out.map(c => c.name)).toEqual(['多', '少'])
    })
    it('依名稱排序時不看評分，且不改動原陣列', () => {
        const src = [s('B', 4.9), s('A', null)]
        const out = sortCampsites(src, 'name')
        expect(out.map(c => c.name)).toEqual(['A', 'B'])
        expect(src[0]!.name).toBe('B')
        expect(out).not.toBe(src)
    })
})
