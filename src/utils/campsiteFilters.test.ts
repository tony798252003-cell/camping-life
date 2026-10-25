import { describe, it, expect } from 'vitest'
import {
    ALTITUDE_BANDS,
    FEATURE_CHIPS,
    altitudeBandKey,
    isHiddenByGoogle,
    matchesAltitude,
    matchesSegment,
    isVisitedTrip,
    sortCampsites,
    upcomingMonths,
    isBookableInMonth,
    splitByBookableMonth,
    formatYmdSlash,
    DRIVE_BANDS,
    driveBandKey,
    matchesDriveBand,
    formatDriveDuration,
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
    it('加入最愛的營區不隱藏：自己挑的不該被別人的分數藏起來，否則最愛清單會少東西', () => {
        expect(isHiddenByGoogle(g(3.2, 5), false, true)).toBe(false)
        expect(isHiddenByGoogle(g(4.8, 900, 'CLOSED_PERMANENTLY'), false, true)).toBe(false)
        expect(isHiddenByGoogle(g(3.2, 5), false, false)).toBe(true)
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
    it('櫻花與落羽松各自獨立，不會互相命中', () => {
        expect(chip('sakura').test({ ...base, scenery_features: ['櫻花'] })).toBe(true)
        expect(chip('sakura').test({ ...base, scenery_features: ['落羽松'] })).toBe(false)
        expect(chip('taxodium').test({ ...base, scenery_features: ['落羽松'] })).toBe(true)
        expect(chip('taxodium').test(base)).toBe(false)
    })
})

describe('去過／沒去過分段', () => {
    it('全部不分；去過與沒去過互斥', () => {
        expect(matchesSegment('all', true, false)).toBe(true)
        expect(matchesSegment('all', false, false)).toBe(true)
        expect(matchesSegment('visited', true, false)).toBe(true)
        expect(matchesSegment('visited', false, false)).toBe(false)
        expect(matchesSegment('unvisited', false, false)).toBe(true)
        expect(matchesSegment('unvisited', true, false)).toBe(false)
    })

    it('最愛分段顯示所有最愛，不論去過沒去過（想再去的和還沒去的都要在）', () => {
        expect(matchesSegment('favorite', true, true)).toBe(true)
        expect(matchesSegment('favorite', false, true)).toBe(true)
        expect(matchesSegment('favorite', true, false)).toBe(false)
        expect(matchesSegment('favorite', false, false)).toBe(false)
    })

    it('最愛不影響去過／沒去過分段', () => {
        expect(matchesSegment('visited', true, true)).toBe(true)
        expect(matchesSegment('unvisited', false, true)).toBe(true)
        expect(matchesSegment('unvisited', true, true)).toBe(false)
    })

    it('行程 status 停在 planning 時，日期已過就算去過（否則「去過」永遠是 0）', () => {
        const today = '2026-10-25'
        expect(isVisitedTrip({ status: 'planning', trip_date: '2026-10-24' }, today)).toBe(true)
        expect(isVisitedTrip({ status: 'planning', trip_date: '2026-10-25' }, today)).toBe(false)
        expect(isVisitedTrip({ status: 'planning', trip_date: null }, today)).toBe(false)
        expect(isVisitedTrip({ status: 'booked', trip_date: '2027-01-01' }, today)).toBe(true)
        expect(isVisitedTrip({ status: 'cancelled', trip_date: '2024-01-01' }, today)).toBe(false)
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

describe('車程級距', () => {
    it('剛好 60 分鐘算「1 小時內」，多 1 秒才進「1–2 小時」，各級上限都含在該級', () => {
        expect(driveBandKey(3600)).toBe('lt1h')
        expect(driveBandKey(3601)).toBe('1-2h')
        expect(driveBandKey(7200)).toBe('1-2h')
        expect(driveBandKey(7201)).toBe('2-3h')
        expect(driveBandKey(10800)).toBe('2-3h')
        expect(driveBandKey(10801)).toBe('gt3h')
    })
    it('每個已知車程只落在一個級距，下拉選單不會漏掉或重複營區', () => {
        for (const sec of [0, 1800, 3600, 3601, 7200, 7201, 10800, 10801, 30000]) {
            expect(DRIVE_BANDS.filter(b => matchesDriveBand(sec, b.key))).toHaveLength(1)
        }
    })
    it('未知車程只在「不拘」顯示，選了級距就隱藏（不知道多遠，不能說它在 1 小時內）', () => {
        expect(driveBandKey(undefined)).toBeNull()
        expect(matchesDriveBand(undefined, '')).toBe(true)
        for (const b of DRIVE_BANDS) expect(matchesDriveBand(undefined, b.key)).toBe(false)
    })
})

describe('車程顯示', () => {
    it('滿一小時顯示 h + 兩位數分鐘，未滿只顯示分鐘，前面加「約」表示是估計', () => {
        expect(formatDriveDuration(6000)).toBe('約 1h40m')
        expect(formatDriveDuration(3900)).toBe('約 1h05m')
        expect(formatDriveDuration(2700)).toBe('約 45m')
    })
    it('四捨五入到分鐘，59 分 40 秒顯示成 1h00m 而不是 60m', () => {
        expect(formatDriveDuration(3580)).toBe('約 1h00m')
    })
})

describe('車程排序', () => {
    const s = (name: string, sec: number | null) => ({ name, sec, ...g(4.5, 100) })
    const bySec = (c: { sec: number | null }) => c.sec
    it('近到遠，未知車程排最後（不能排在確定很近的營區前面）', () => {
        const out = sortCampsites([s('未知', null), s('遠', 9000), s('近', 1200)], 'drive', bySec)
        expect(out.map(c => c.name)).toEqual(['近', '遠', '未知'])
    })
    it('車程相同時比名稱，讓順序穩定不跳動', () => {
        const out = sortCampsites([s('B', 3000), s('A', 3000)], 'drive', bySec)
        expect(out.map(c => c.name)).toEqual(['A', 'B'])
    })
    it('車程還沒算出來（沒給 driveSeconds）時全部當未知，退回名稱排序而不是報錯', () => {
        const out = sortCampsites([s('B', 100), s('A', 9000)], 'drive')
        expect(out.map(c => c.name)).toEqual(['A', 'B'])
    })
})

describe('要去的月份', () => {
    it('從今天所在月份起 12 個月，跨年時年份要進位', () => {
        const m = upcomingMonths('2026-10-25')
        expect(m).toHaveLength(12)
        expect(m[0]).toEqual({ key: '2026-10', label: '2026年10月' })
        expect(m[3]).toEqual({ key: '2027-01', label: '2027年1月' })
        expect(m[11]!.key).toBe('2027-09')
    })
    it('可訂到上個月最後一天：該月完全還沒開放，要隱藏', () => {
        expect(isBookableInMonth('2026-11-30', '2026-12')).toBe(false)
    })
    it('可訂到該月 1 號：至少第一天可訂，要顯示', () => {
        expect(isBookableInMonth('2026-12-01', '2026-12')).toBe(true)
        expect(isBookableInMonth('2027-04-24', '2026-12')).toBe(true)
    })
    it('沒有 bookable_until 不能證明可訂，但也不是「不可訂」，所以分到 noData', () => {
        expect(isBookableInMonth(null, '2026-12')).toBe(false)
        const list = [
            { n: 'a', bookable_until: '2026-11-30' },
            { n: 'b', bookable_until: '2026-12-01' },
            { n: 'c', bookable_until: null },
            { n: 'd' },
        ]
        const { matched, noData } = splitByBookableMonth(list, '2026-12')
        expect(matched.map(c => c.n)).toEqual(['b'])
        expect(noData.map(c => c.n)).toEqual(['c', 'd'])
    })
    it('日期顯示不補零', () => {
        expect(formatYmdSlash('2027-04-04')).toBe('2027/4/4')
    })
})
