import { describe, it, expect, vi, beforeEach } from 'vitest'

const result = vi.hoisted(() => ({ value: { data: [] as unknown[] | null, error: null as unknown } }))
vi.mock('../lib/supabase', () => ({
  supabase: { from: () => ({ delete: () => ({ eq: () => ({ select: () => Promise.resolve(result.value) }) }) }) },
}))

import { tripQueries, TRIP_DELETE_DENIED } from './supabaseQueries'

describe('tripQueries.delete', () => {
  beforeEach(() => { result.value = { data: [], error: null } })

  // RLS 擋下刪除時 PostgREST 不報錯只回 0 筆；若當成功，UI 會誤報「刪除成功」
  it('刪 0 筆時丟出只有建立者可刪的錯誤', async () => {
    await expect(tripQueries.delete(1)).rejects.toThrow(TRIP_DELETE_DENIED)
  })
  it('刪到 1 筆時正常結束', async () => {
    result.value = { data: [{ id: 1 }], error: null }
    await expect(tripQueries.delete(1)).resolves.toBeUndefined()
  })
  it('DB 錯誤原樣丟出', async () => {
    result.value = { data: null, error: new Error('boom') }
    await expect(tripQueries.delete(1)).rejects.toThrow('boom')
  })
})
