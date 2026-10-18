import { describe, it, expect } from 'vitest'
import { canSaveTrip } from './tripValidation'

// 為什麼：營區只能從圖鑑選取，否則只打名字會產生重複或未審核的垃圾營區
describe('canSaveTrip', () => {
  it('新行程沒有 campsite_id 時擋存檔（營區空白或只打了名字沒選清單）', () => {
    expect(canSaveTrip(true, undefined)).toBe(false)
    expect(canSaveTrip(true, null)).toBe(false)
  })
  it('新行程選了已收錄營區可存檔', () => expect(canSaveTrip(true, 12)).toBe(true))
  // 為什麼：改版前的舊行程沒有 campsite_id，擋掉會讓使用者無法修改舊資料
  it('編輯舊行程沒有 campsite_id 仍可存檔', () => expect(canSaveTrip(false, null)).toBe(true))
})
