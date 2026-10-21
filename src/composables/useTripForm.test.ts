import { describe, it, expect } from 'vitest'
import { useTripForm } from './useTripForm'
import { CAMPSITE_REQUIRED_MESSAGE } from '../utils/tripValidation'

const make = () => useTripForm(() => '2026-11-07')

describe('useTripForm.toPayload', () => {
  // 為什麼：只打名字沒選清單會讓重複營區再次出現（規格 §5.6）
  it('新增模式：有 campsite_name 但 campsite_id 為 null 時 throw', () => {
    const f = make()
    f.resetForm()
    f.formData.value.campsite_name = '雲頂露營區'
    f.formData.value.campsite_id = null as any
    expect(() => f.toPayload(true)).toThrow(CAMPSITE_REQUIRED_MESSAGE)
  })

  // 為什麼：規格 Q5 決定 B，新增露營必須選營區，營區欄位空白也不能存
  it('新增模式：campsite_id 與 campsite_name 都空時 throw', () => {
    const f = make()
    f.resetForm()
    expect(() => f.toPayload(true)).toThrow(CAMPSITE_REQUIRED_MESSAGE)
  })

  // 為什麼：改版前的舊行程沒有 campsite_id，擋掉會讓使用者無法修改舊資料
  it('編輯模式：舊行程沒有 campsite_id 不 throw', () => {
    const f = make()
    f.initFormData({ trip_date: '2026-01-01', campsite_name: '舊營區', duration_days: 2 })
    expect(() => f.toPayload(false)).not.toThrow()
  })

  // 為什麼：結束日 = trip_date + duration_days - 1，0 天會讓行程在行事曆消失（Review Focus 2）
  it('duration_days 為 0 時改成 1', () => {
    const f = make()
    f.initFormData({ trip_date: '2026-01-01', campsite_id: 3, campsite_name: 'A', duration_days: 2 })
    f.formData.value.duration_days = 0
    expect(f.toPayload(false).duration_days).toBe(1)
  })

  // 為什麼：舊行程 duration_days 為 null 時畫面不能壞、行程不能從行事曆消失（Review Focus 2）
  it('初始化舊行程 duration_days 為 null 時當作 1 天', () => {
    const f = make()
    f.initFormData({ trip_date: '2026-01-01', campsite_name: '舊營區', duration_days: null })
    expect(f.formData.value.duration_days).toBe(1)
    expect(f.toPayload(false).duration_days).toBe(1)
  })

  // 為什麼：資料庫 cost/price 不可為 null，空字串要轉成 0；海拔空值要存 null
  it('空的費用轉 0、空的海拔轉 null', () => {
    const f = make()
    f.initFormData({ trip_date: '2026-01-01', campsite_id: 3, campsite_name: 'A' })
    f.formData.value.cost = '' as any
    f.formData.value.altitude = '' as any
    const p = f.toPayload(false)
    expect(p.cost).toBe(0)
    expect(p.altitude).toBeNull()
  })
})

describe('useTripForm.hasChanges', () => {
  // 為什麼：只是開啟畫面就跳出「儲存變更」會讓使用者以為資料被改過
  it('只開啟、沒有修改時為 false；修改後為 true', () => {
    const f = make()
    f.initFormData({ trip_date: '2026-01-01', campsite_id: 3, campsite_name: 'A', duration_days: 2 })
    expect(f.hasChanges.value).toBe(false)
    f.formData.value.notes = '改了'
    expect(f.hasChanges.value).toBe(true)
  })

  it('新增模式 resetForm 後為 false，且帶入 initialDate', () => {
    const f = make()
    f.resetForm()
    expect(f.hasChanges.value).toBe(false)
    expect(f.formData.value.trip_date).toBe('2026-11-07')
  })
})
