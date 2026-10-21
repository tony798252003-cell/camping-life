import { describe, it, expect } from 'vitest'
import { campsiteNavUrl, campsiteTelUrl } from './campsiteNav'

describe('campsiteNavUrl', () => {
  // 為什麼：有 place_id 時導到 Google 上的那個店家，比座標更準（座標可能是 AI 或舊資料）
  it('有 google_place_id 用 destination_place_id', () => {
    const u = campsiteNavUrl({ name: '雲頂 營區', google_place_id: 'ChIJabc', latitude: 1, longitude: 2 })!
    expect(u).toContain('destination_place_id=ChIJabc')
    expect(u).toContain(encodeURIComponent('雲頂 營區'))
  })
  // 為什麼：手動建立的營區沒有 place_id，仍要能導航
  it('沒有 place_id 退回座標', () => {
    expect(campsiteNavUrl({ name: 'x', latitude: 24.5, longitude: 121.1 })).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=24.5,121.1',
    )
  })
  // 為什麼：座標也沒有就不該產生壞連結，畫面才能隱藏導航鈕
  it('什麼都沒有回 null', () => {
    expect(campsiteNavUrl({ name: 'x' })).toBeNull()
  })
})

describe('campsiteTelUrl', () => {
  // 為什麼：資料裡的電話常帶空格、橫線、括號，tel: 連結要乾淨才撥得出去
  it('去除分隔符號', () => {
    expect(campsiteTelUrl('03-584 1234')).toBe('tel:035841234')
  })
  // 為什麼：沒電話不能顯示撥號鈕
  it('空值回 null', () => {
    expect(campsiteTelUrl('')).toBeNull()
    expect(campsiteTelUrl(null)).toBeNull()
  })
})
