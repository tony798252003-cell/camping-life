import { describe, it, expect } from 'vitest'
import { buildNewGearPayload, buildExamplePayloads, buildNewTentPayload } from './gearPayload'

describe('gearPayload', () => {
  // camping_gear 沒有 purchase_date，送出會被 PostgREST 拒絕，導致新增失敗
  it('所有 payload 都不含 purchase_date', () => {
    const all = [buildNewGearPayload('u1'), ...buildExamplePayloads('u1'), buildNewTentPayload({ name: ' a ', brand: 'b' }, 'u1')]
    for (const p of all) expect(p).not.toHaveProperty('purchase_date')
  })

  // RLS 要求 auth.uid() = user_id，沒帶 user_id 的範例資料會插入失敗
  it('範例資料都帶 user_id', () => {
    const list = buildExamplePayloads('u1')
    expect(list).toHaveLength(3)
    expect(list.every(p => p.user_id === 'u1')).toBe(true)
  })

  it('帳篷 payload 會 trim 名稱與品牌', () => {
    const p = buildNewTentPayload({ name: ' 帳 ', brand: ' B ' }, 'u1')
    expect(p.name).toBe('帳')
    expect(p.brand).toBe('B')
  })
})
