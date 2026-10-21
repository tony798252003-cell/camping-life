import { describe, it, expect } from 'vitest'
import { useCampsiteForm } from './useCampsiteForm'
import type { Campsite } from '../types/database'

const base = (over: Partial<Campsite> = {}) =>
  ({
    id: 7, name: '雲頂', city: '新竹縣', district: '尖石鄉', altitude: 1000, phone: '03-1111',
    latitude: 24.5, longitude: 121.1, night_rush_time: '18:00-22:00', shower_restrictions: '24H',
    tags: ['雲海'], amenities: null, capacity_zones: null, is_verified: false,
    field_sources: {
      latitude: { source: 'gemini', confidence: 'low', urls: [], confirmed: false },
      phone: { source: 'claude', confidence: 'high', urls: ['https://a.example'], confirmed: false },
    },
    ...over,
  }) as unknown as Campsite

const make = (c = base()) => {
  const f = useCampsiteForm()
  f.init(c)
  return f
}

describe('useCampsiteForm.toPayload', () => {
  // 為什麼：使用者改過的值不能再被標示成 AI 推測
  it('修改欄位 → source 改 manual 且 confirmed', () => {
    const f = make()
    f.form.value.phone = '03-2222'
    const p = f.toPayload() as any
    expect(p.field_sources.phone).toMatchObject({ source: 'manual', confirmed: true, urls: [] })
  })

  // 為什麼：手動修正座標是最常見的校正，AI 猜錯的座標改完要變成可信
  it('手動修正 latitude/longitude 也標 manual', () => {
    const f = make()
    f.form.value.latitude = 24.6
    f.form.value.longitude = 121.2
    const p = f.toPayload() as any
    expect(p.field_sources.latitude.source).toBe('manual')
    expect(p.field_sources.latitude.confirmed).toBe(true)
    expect(p.field_sources.longitude.source).toBe('manual')
  })

  // 為什麼：沒動的欄位不能被偷偷蓋章，否則 AI 欄位永遠看不出還沒確認
  it('沒改的欄位保留原 field_sources', () => {
    const f = make()
    f.form.value.phone = '03-2222'
    const p = f.toPayload() as any
    expect(p.field_sources.latitude).toMatchObject({ source: 'gemini', confirmed: false })
  })

  // 為什麼：夜衝時段格式在載入時會被正規化（空格），純開啟再儲存不該被當成使用者修改
  it('沒有任何修改時 field_sources 不變', () => {
    const f = make()
    const p = f.toPayload() as any
    expect(p.field_sources).toEqual(base().field_sources)
  })

  // 為什麼：儲存時不能把唯讀欄位送回資料庫
  it('移除 id / created_at / created_by', () => {
    const p = make().toPayload() as any
    expect(p).not.toHaveProperty('id')
    expect(p).not.toHaveProperty('created_at')
    expect(p).not.toHaveProperty('created_by')
  })

  // 為什麼：標籤在畫面上是逗號字串，儲存要轉回陣列，且改標籤也算使用者修改
  it('標籤字串轉陣列並標 manual', () => {
    const f = make()
    f.tagsString.value = '雲海, 草地，戲水池'
    const p = f.toPayload() as any
    expect(p.tags).toEqual(['雲海', '草地', '戲水池'])
    expect(p.field_sources.tags.source).toBe('manual')
  })
})

describe('useCampsiteForm.confirmField', () => {
  // 為什麼：使用者看過 AI 值覺得沒錯，只需確認而不改值；值不變、來源不能被改成 manual
  it('確認只把 confirmed 設 true，保留來源', () => {
    const f = make()
    f.confirmField('latitude')
    expect(f.form.value.field_sources!.latitude).toMatchObject({ source: 'gemini', confirmed: true })
    expect((f.toPayload() as any).field_sources.latitude.source).toBe('gemini')
  })

  // 為什麼：⚠️ 清單要只列出還沒確認的欄位
  it('unconfirmedKeys 只列未確認', () => {
    const f = make()
    expect(f.unconfirmedKeys.value.sort()).toEqual(['latitude', 'phone'])
    f.confirmField('phone')
    expect(f.unconfirmedKeys.value).toEqual(['latitude'])
  })
})
