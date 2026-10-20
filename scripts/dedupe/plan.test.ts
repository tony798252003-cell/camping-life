import { describe, expect, it } from 'vitest'
import {
  countFilledFields, fillEmptyFields, groupDuplicateTrips, groupDuplicates, nameStem, pickKeeper,
  type CampsiteRow, type TripRow,
} from './plan'

const mk = (o: Partial<CampsiteRow> & { id: number }): CampsiteRow => ({
  name: `營區${o.id}`, district: null, latitude: null, longitude: null,
  tripCount: 0, photoCount: 0, filledFields: 0, ...o,
})
// 緯度 0.001 度約 111 m
const at = (km: number) => ({ latitude: 24 + km / 111, longitude: 121 })

describe('pickKeeper', () => {
  // 為什麼：保留被引用最多的，要改指向的行程最少，合併風險最低
  it('行程數最多者優先', () => {
    expect(pickKeeper([mk({ id: 5, tripCount: 1 }), mk({ id: 3, tripCount: 4 })])).toBe(3)
  })
  // 為什麼：照片是使用者上傳的不可重建資料，行程數相同時要保住它
  it('行程數相同時，有照片者優先', () => {
    expect(pickKeeper([mk({ id: 2, tripCount: 1 }), mk({ id: 8, tripCount: 1, photoCount: 2 })])).toBe(8)
  })
  // 為什麼：有座標才能比對與顯示地圖
  it('有座標優先於欄位數', () => {
    expect(pickKeeper([mk({ id: 1, filledFields: 9 }), mk({ id: 2, ...at(0) })])).toBe(2)
  })
  // 為什麼：欄位多代表補值動作少
  it('欄位完整者優先', () => {
    expect(pickKeeper([mk({ id: 1, filledFields: 2 }), mk({ id: 2, filledFields: 7 })])).toBe(2)
  })
  // 為什麼：全部相同時結果必須確定，重跑報告建議不能變
  it('全部相同取最小 id', () => {
    expect(pickKeeper([mk({ id: 9 }), mk({ id: 4 }), mk({ id: 6 })])).toBe(4)
  })
})

describe('nameStem', () => {
  // 為什麼：同園區的 A 區 B 區要能認出是同一園區，避免誤合併
  it('移除括號與結尾分區字樣', () => {
    expect(nameStem('雲頂A區')).toBe('雲頂')
    expect(nameStem('雲頂（B區）')).toBe('雲頂')
    expect(nameStem('雲頂二區')).toBe('雲頂')
  })
})

describe('groupDuplicates', () => {
  // 為什麼：A~B、B~C 時三筆其實是同一個營區，只合 A、B 會留下 C
  it('遞移：A~B、B~C 同一群', () => {
    const a = mk({ id: 1, name: '甲露營區', ...at(0) })
    const b = mk({ id: 2, name: '甲露營區', ...at(0.2) })
    const c = mk({ id: 3, name: '甲露營區', ...at(0.4) }) // 與 a 相距 400m 但與 b 200m
    const g = groupDuplicates([a, b, c])
    expect(g).toHaveLength(1)
    expect(g[0]!.members.map(m => m.id)).toEqual([1, 2, 3])
  })
  // 為什麼：same_place 與 300m 內相似名稱是最有把握的，才能列為 high
  it('google_place_id 相同 → high', () => {
    const g = groupDuplicates([
      mk({ id: 1, name: '甲', google_place_id: 'p' }),
      mk({ id: 2, name: '乙完全不同', google_place_id: 'p' }),
    ])
    expect(g[0]!.confidence).toBe('high')
  })
  it('同名 < 300m → high', () => {
    const g = groupDuplicates([mk({ id: 1, name: '甲露營區', ...at(0) }), mk({ id: 2, name: '甲營區', ...at(0.1) })])
    expect(g[0]!.confidence).toBe('high')
  })
  // 為什麼：300m–2km 或沒座標只靠名稱，需要人看過，不能高信心
  it('同名 300m–2km → medium；沒座標同名同鄉鎮 → medium', () => {
    expect(groupDuplicates([mk({ id: 1, name: '甲營區', ...at(0) }), mk({ id: 2, name: '甲營區', ...at(1) })])[0]!.confidence).toBe('medium')
    expect(groupDuplicates([mk({ id: 1, name: '甲營區', district: '仁愛鄉' }), mk({ id: 2, name: '甲營區', district: '仁愛鄉' })])[0]!.confidence).toBe('medium')
  })
  // 為什麼：電話相同但名稱、位置都不同，可能是連鎖或登記錯誤，只列給使用者判斷
  it('只靠電話相同（距離 5km）→ 同群 low，正規化去掉 - 與空白', () => {
    const g = groupDuplicates([
      mk({ id: 1, name: '甲', phone: '03-123 456', ...at(0) }),
      mk({ id: 2, name: '乙', phone: '03123456', ...at(5) }),
    ])
    expect(g).toHaveLength(1)
    expect(g[0]!.confidence).toBe('low')
  })
  // 為什麼：同名同鄉鎮但相距很遠多半是不同營區，只列不併
  it('同名同鄉鎮距離 8km → 同群 low', () => {
    const g = groupDuplicates([
      mk({ id: 1, name: '甲農場', district: '仁愛鄉', ...at(0) }),
      mk({ id: 2, name: '甲農場', district: '仁愛鄉', ...at(8) }),
    ])
    expect(g).toHaveLength(1)
    expect(g[0]!.confidence).toBe('low')
  })
  it('同名不同鄉鎮且遠 → 不成群', () => {
    expect(groupDuplicates([
      mk({ id: 1, name: '甲農場', district: '仁愛鄉', ...at(0) }),
      mk({ id: 2, name: '甲農場', district: '信義鄉', ...at(8) }),
    ])).toHaveLength(0)
  })
  // 為什麼：同園區不同分區不是重複，要警告使用者別合併
  it('主幹相同且 < 500m → samePark', () => {
    const g = groupDuplicates([mk({ id: 1, name: '雲頂A區', ...at(0) }), mk({ id: 2, name: '雲頂（B區）', ...at(0.2) })])
    expect(g).toHaveLength(1)
    expect(g[0]!.samePark).toBe(true)
  })
  // 為什麼：完全同名的真重複不應被警告成「不同分區」
  it('名稱完全相同的重複不算 samePark', () => {
    const g = groupDuplicates([mk({ id: 1, name: '雲頂營區', ...at(0) }), mk({ id: 2, name: '雲頂露營區', ...at(0.1) })])
    expect(g[0]!.samePark).toBe(false)
  })
  // 為什麼：已被合併的營區不該再出現在下一輪報告
  it('忽略已合併的列，並給 suggestedKeepId', () => {
    const g = groupDuplicates([
      mk({ id: 1, name: '甲營區', ...at(0), merged_into_id: 9 }),
      mk({ id: 2, name: '甲營區', ...at(0), tripCount: 1 }),
      mk({ id: 3, name: '甲營區', ...at(0), tripCount: 3 }),
    ])
    expect(g[0]!.members.map(m => m.id)).toEqual([2, 3])
    expect(g[0]!.suggestedKeepId).toBe(3)
  })
})

describe('countFilledFields', () => {
  // 為什麼：保留順序用「非空欄位數」，空字串、空陣列、meta 欄位不能灌水
  it('不計 null、空字串、空陣列、meta 欄位', () => {
    expect(countFilledFields({ id: 1, name: 'x', phone: '', tags: [], city: '南投', is_verified: true, amenities: {} })).toBe(2)
  })
})

describe('groupDuplicateTrips', () => {
  const t = (o: Partial<TripRow> & { id: number }): TripRow => ({
    trip_date: '2026-05-01', campsite_id: null, campsite_name: null, photoCount: 0, filledFields: 0, ...o,
  })
  // 為什麼：同一天同營區（id 或名稱快照）才是重複行程；不同日期同營區是正常再訪
  it('同日且 campsite_id 或名稱相同才成群', () => {
    const g = groupDuplicateTrips([
      t({ id: 1, campsite_id: 5 }),
      t({ id: 2, campsite_id: 5, photoCount: 1 }),
      t({ id: 3, campsite_name: '甲 露營區' }),
      t({ id: 4, campsite_name: '甲營區' }),
      t({ id: 5, campsite_id: 5, trip_date: '2026-06-01' }),
    ])
    expect(g.map(x => x.members.map(m => m.id))).toEqual([[1, 2], [3, 4]])
    expect(g[0]!.suggestedKeepId).toBe(2)
  })
})

describe('fillEmptyFields', () => {
  const EXCL = new Set(['id', 'google_place_id'])
  // 為什麼：合併不能蓋掉保留那筆已有的資料，只能補空白
  it('keep 的 null 被第一個有值的 drop 補上，已有值不覆蓋', () => {
    const keep = { id: 1, phone: null, address: '舊址' }
    const drops = [{ id: 2, phone: null, address: '新址' }, { id: 3, phone: '02-1', address: 'x' }, { id: 4, phone: '02-2' }]
    expect(fillEmptyFields(keep, drops, EXCL)).toEqual({ phone: { value: '02-1', fromId: 3 } })
  })
  // 為什麼：空字串與空陣列在 DB 裡等同沒填；若不補，保留那筆會永遠缺資料
  it('空字串與空陣列視為空', () => {
    const keep = { id: 1, note: '  ', tags: [] as string[] }
    const drops = [{ id: 2, note: '備註', tags: ['a'] }]
    expect(fillEmptyFields(keep, drops, EXCL)).toEqual({
      note: { value: '備註', fromId: 2 }, tags: { value: ['a'], fromId: 2 },
    })
  })
  // 為什麼：google_place_id 有 unique 限制且 id 是主鍵，補進去會造成衝突或改壞身分
  it('排除欄位不補', () => {
    const keep = { id: 1, google_place_id: null }
    expect(fillEmptyFields(keep, [{ id: 2, google_place_id: 'p' }], EXCL)).toEqual({})
  })
  // 為什麼：drops 都沒有值時不該產生無意義的更新
  it('drops 全空則不補', () => {
    expect(fillEmptyFields({ id: 1, phone: null }, [{ id: 2, phone: '' }], EXCL)).toEqual({})
  })
})
