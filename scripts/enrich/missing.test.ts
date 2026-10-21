import { describe, it, expect } from 'vitest'
import { selectMissing, missingFields, isEmptyValue, type CampsiteRow } from './missing'

const row = (o: Partial<CampsiteRow>): CampsiteRow => ({
  id: 1, name: 'a', city: '苗栗縣', district: null, google_maps_url: null,
  created_at: '2026-01-01', merged_into_id: null, field_sources: {}, ...o,
})

describe('isEmptyValue', () => {
  // 為什麼：Gemini／手動可能留下 []、''、{}，這些都代表「沒資料」，不能被當成已填而永遠補不到
  it('null、空字串、空陣列、空物件、沒有 boolean 的 amenities 都算空', () => {
    expect(isEmptyValue('phone', '  ')).toBe(true)
    expect(isEmptyValue('spot_types', [])).toBe(true)
    expect(isEmptyValue('amenities', {})).toBe(true)
    expect(isEmptyValue('amenities', { other: 1 })).toBe(true)
  })
  // 為什麼：has_fridge:false 是明確的「沒有」，不是缺資料；重查會蓋掉使用者確認過的答案
  it('amenities 有 false 也算已填', () => {
    expect(isEmptyValue('amenities', { has_fridge: false })).toBe(false)
  })
})

describe('missingFields', () => {
  it('只列出空的可補欄位', () => {
    const m = missingFields(row({ phone: '0912', spot_types: ['雨棚'] }))
    expect(m).not.toContain('phone')
    expect(m).not.toContain('spot_types')
    expect(m).toContain('check_in_time')
  })
})

describe('selectMissing', () => {
  // 為什麼：已合併的列只是舊資料，補了也不會顯示，還會浪費查詢
  it('排除 merged_into_id 不為 null 的營區', () => {
    expect(selectMissing([row({ id: 1, merged_into_id: 2 })], new Map(), { limit: 10 })).toEqual([])
  })

  it('欄位全滿的營區不列出', () => {
    const full = row({
      spot_types: ['a'], scenery_features: ['a'], water_features: ['a'], playground_features: ['a'],
      booking_method: ['a'], shower_restrictions: 'x', night_rush_time: 'x', booking_timing: 'x',
      check_in_time: 'x', check_out_time: 'x', phone: 'x', amenities: { has_fridge: true }, campsite_notes: 'x',
    })
    expect(selectMissing([full], new Map(), { limit: 10 })).toEqual([])
  })

  // 為什麼：去過的營區使用者最常回頭看，優先補；其次補最近新增的
  it('先依去過次數多到少，再依建立時間新到舊', () => {
    const list = [
      row({ id: 1, created_at: '2026-03-01' }),
      row({ id: 2, created_at: '2026-01-01' }),
      row({ id: 3, created_at: '2026-02-01' }),
    ]
    const r = selectMissing(list, new Map([[2, 3]]), { limit: 10 })
    expect(r.map((x) => x.id)).toEqual([2, 1, 3])
  })

  it('--visited 只留有行程的；--city 只留該縣市；limit 截斷', () => {
    const list = [row({ id: 1 }), row({ id: 2, city: '南投縣' }), row({ id: 3 })]
    const counts = new Map([[2, 1], [3, 1]])
    expect(selectMissing(list, counts, { limit: 10, visited: true }).map((x) => x.id)).toEqual([3, 2])
    expect(selectMissing(list, counts, { limit: 10, city: '苗栗縣' }).map((x) => x.id)).toEqual([3, 1])
    expect(selectMissing(list, counts, { limit: 1 })).toHaveLength(1)
  })

  it('輸出 field_sources 的 key，且不洩漏排序用的內部欄位', () => {
    const [r] = selectMissing([row({ field_sources: { phone: {} } })], new Map(), { limit: 1 })
    expect(r!.fieldSourceKeys).toEqual(['phone'])
    expect(r).not.toHaveProperty('_created')
  })
})
