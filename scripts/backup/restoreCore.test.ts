import { describe, it, expect } from 'vitest'
import { diffRows, RESTORE_ORDER } from './restoreCore'

// 為什麼：合併出問題時，這是唯一的回復手段（規格 §8 步驟 6）；備份之後新增的資料不能被動到
describe('diffRows', () => {
  it('只列出備份與線上不同的列；線上多出的列（備份後新增）不列入', () => {
    const r = diffRows([{ id: 1, a: 1 }, { id: 2, a: 2 }], [{ id: 1, a: 1 }, { id: 2, a: 9 }, { id: 3, a: 3 }])
    expect(r.changed).toEqual([{ id: 2, a: 2 }])
    expect(r.missing).toEqual([])
  })

  it('備份有、線上沒有的列列為 missing', () => {
    const r = diffRows([{ id: 1, a: 1 }], [])
    expect(r.missing).toEqual([{ id: 1, a: 1 }])
    expect(r.changed).toEqual([])
  })

  it('jsonb 欄位鍵順序不同不算差異', () => {
    const r = diffRows([{ id: 1, j: { x: 1, y: { p: 1, q: 2 } } }], [{ id: 1, j: { y: { q: 2, p: 1 }, x: 1 } }])
    expect(r.changed).toEqual([])
  })
})

describe('RESTORE_ORDER', () => {
  it('父表在前，避免外鍵還原失敗', () => {
    const i = (t: string) => RESTORE_ORDER.indexOf(t)
    expect(i('campsites')).toBeGreaterThanOrEqual(0)
    expect(i('campsites')).toBeLessThan(i('camping_trips'))
    expect(i('camping_trips')).toBeLessThan(i('trip_photos'))
  })
})
