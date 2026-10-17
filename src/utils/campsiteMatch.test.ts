import { describe, it, expect } from 'vitest'
import {
  normalizeCampsiteName,
  bracketContent,
  isNameSimilar,
  distanceMeters,
  editDistance,
  matchCampsite,
  type MatchableCampsite,
} from './campsiteMatch'

// 台中某點；緯度 1 度約 111,195 m，所以 0.0011 度約 122 m
const BASE = { latitude: 24.15, longitude: 120.67 }
const north = (m: number) => ({ latitude: BASE.latitude + m / 111195, longitude: BASE.longitude })

const site = (o: Partial<MatchableCampsite> & { id: number; name: string }): MatchableCampsite => ({
  district: null, latitude: null, longitude: null, ...o,
})

describe('normalizeCampsiteName', () => {
  it('移除括號內容與通用字', () => {
    // 括號是備註（原名、分區），不是名稱主幹
    expect(normalizeCampsiteName('雲頂露營區（原山林）')).toBe('雲頂')
  })
  it('不移除主幹前綴', () => {
    // 「拉拉山雲頂」和「雲頂」是不同主幹，不能被正規化成同一個
    expect(normalizeCampsiteName('拉拉山 雲頂營地')).toBe('拉拉山雲頂')
  })
  it('全形英數轉半形、台轉臺、轉小寫', () => {
    // 同一個營區常有「台/臺」和全半形的寫法差異
    expect(normalizeCampsiteName('台灣ＡＢＣ 營地')).toBe('臺灣abc')
  })
  it('英文通用字不分大小寫', () => {
    expect(normalizeCampsiteName('雲頂 Camping')).toBe('雲頂')
  })
  it('只剩通用字時回傳空字串', () => {
    expect(normalizeCampsiteName('露營區')).toBe('')
  })
  it('長的通用字先移除', () => {
    // 若先移除「露營」，「露營區」會殘留「區」
    expect(normalizeCampsiteName('山頂露營區')).toBe('山頂')
  })
})

describe('bracketContent', () => {
  it('取第一組括號（半形或全形）內文字', () => {
    // 括號規則要用它判斷「A區 vs B區」
    expect(bracketContent('雲頂（A區）')).toBe('A區')
    expect(bracketContent('雲頂(B區)(x)')).toBe('B區')
    expect(bracketContent('雲頂')).toBeNull()
  })
})

describe('editDistance / distanceMeters', () => {
  it('編輯距離', () => {
    // 少一個字、改一個字都要能被抓到
    expect(editDistance('雲頂露營', '雲頂露營區')).toBe(1)
    expect(editDistance('abc', 'abc')).toBe(0)
    expect(editDistance('', 'abc')).toBe(3)
  })
  it('haversine 距離合理', () => {
    // 閾值 300 m 依賴距離準確
    const d = distanceMeters(BASE, north(1000))
    expect(d).toBeGreaterThan(990)
    expect(d).toBeLessThan(1010)
  })
})

describe('isNameSimilar', () => {
  it('空字串不算相似', () => {
    // 否則只叫「露營區」的資料會和所有營區「互相包含」
    expect(isNameSimilar('露營區', '雲頂露營區')).toBe(false)
    expect(isNameSimilar('', '')).toBe(false)
  })
  it('互相包含或編輯距離 ≤ 2', () => {
    // 改名或少一個字要能抓到
    expect(isNameSimilar('雲頂露營', '雲頂露營區')).toBe(true)
    expect(isNameSimilar('拉拉山雲頂', '雲頂')).toBe(true)
    expect(isNameSimilar('快樂農場', '悲傷樂園')).toBe(false)
  })
})

describe('matchCampsite', () => {
  it('google_place_id 相同 → same_place，即使座標很遠', () => {
    // place_id 是確定的身分，座標品質不影響
    const r = matchCampsite(
      { name: 'X', district: null, ...BASE, google_place_id: 'P1' },
      [site({ id: 1, name: 'Y', google_place_id: 'P1', ...north(50000) })],
    )
    expect(r.map((m) => m.level)).toEqual(['same_place'])
  })

  it('120 m 內、少一個字 → likely', () => {
    // 同地點的改名或漏字，應視為已收錄
    const r = matchCampsite(
      { name: '雲頂露營', district: null, ...BASE },
      [site({ id: 1, name: '雲頂露營區', ...north(120) })],
    )
    expect(r[0]?.level).toBe('likely')
  })

  it('250 m 內、名稱完全不同 → nearby', () => {
    // 附近有營區只提示，不自動排除
    const r = matchCampsite(
      { name: '星空谷', district: null, ...BASE },
      [site({ id: 1, name: '雲頂', ...north(250) })],
    )
    expect(r[0]?.level).toBe('nearby')
  })

  it('同名、1.2 km → likely', () => {
    // 舊座標不可靠，寧可提示
    const r = matchCampsite(
      { name: '雲頂露營區', district: null, ...BASE },
      [site({ id: 1, name: '雲頂', ...north(1200) })],
    )
    expect(r[0]?.level).toBe('likely')
  })

  it('名稱相似但不相同、1.2 km → 不是重複', () => {
    // 只有「完全相同」才放寬到 2 km
    const r = matchCampsite(
      { name: '雲頂露營', district: null, ...BASE },
      [site({ id: 1, name: '雲頂露營大', ...north(1200) })],
    )
    expect(r).toEqual([])
  })

  it('同名但 5 km → 不是重複（Review Focus 4）', () => {
    // 全台常有同名營區，距離遠就是不同地點
    const r = matchCampsite(
      { name: '快樂農場', district: null, ...BASE },
      [site({ id: 1, name: '快樂農場', ...north(5000) })],
    )
    expect(r).toEqual([])
  })

  it('缺座標：同名同鄉鎮 → likely；同名不同鄉鎮 → []', () => {
    // 沒座標無法用距離判斷，只能靠鄉鎮收斂
    const cand = { name: '雲頂', district: '和平區', latitude: null, longitude: null }
    expect(matchCampsite(cand, [site({ id: 1, name: '雲頂營地', district: '和平區', ...BASE })])[0]?.level).toBe('likely')
    expect(matchCampsite(cand, [site({ id: 1, name: '雲頂營地', district: '新社區', ...BASE })])).toEqual([])
  })

  it('bracketAware：括號不同、100 m → nearby', () => {
    // A區和B區可能是同園區的不同營區，不能當成同一個
    const cand = { name: '雲頂（A區）', district: null, ...BASE }
    const ex = [site({ id: 1, name: '雲頂（B區）', ...north(100) })]
    expect(matchCampsite(cand, ex, { bracketAware: true })[0]?.level).toBe('nearby')
    expect(matchCampsite(cand, ex)[0]?.level).toBe('likely')
  })

  it('已合併的營區不參與比對', () => {
    // 合併後的舊資料只是別名，不該再被提示
    const r = matchCampsite(
      { name: '雲頂', district: null, ...BASE },
      [site({ id: 1, name: '雲頂', ...BASE, merged_into_id: 9 })],
    )
    expect(r).toEqual([])
  })

  it('依嚴重度、距離排序', () => {
    // UI 先顯示最可能的重複
    const r = matchCampsite(
      { name: '雲頂', district: null, ...BASE },
      [
        site({ id: 1, name: '星空谷', ...north(100) }),
        site({ id: 2, name: '雲頂', ...north(200) }),
        site({ id: 3, name: '雲頂', ...north(50) }),
      ],
    )
    expect(r.map((m) => m.campsite.id)).toEqual([3, 2, 1])
  })
})
