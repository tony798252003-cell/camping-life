import { describe, it, expect } from 'vitest'
import { buildTripSavePayload } from './tripPayload'
import type { NewCampingTrip } from '../types/database'

const trip = { title: 't', trip_date: '2026-10-20' } as unknown as NewCampingTrip

describe('buildTripSavePayload', () => {
  // 家人編輯行程時若改了 user_id，原擁有者會因 RLS 刪除 0 筆而刪不掉
  it('編輯時不送 user_id / family_id（即使輸入帶了）', () => {
    const p = buildTripSavePayload({ ...trip, user_id: 'x', family_id: 'f' } as NewCampingTrip, { isEdit: true, userId: 'wife', familyId: 'f2' })
    expect(p).not.toHaveProperty('user_id')
    expect(p).not.toHaveProperty('family_id')
    expect(p).toMatchObject({ title: 't' })
  })

  it('新增時寫入 user_id 與 family_id', () => {
    expect(buildTripSavePayload(trip, { isEdit: false, userId: 'u', familyId: null })).toMatchObject({ user_id: 'u', family_id: null })
  })
})
