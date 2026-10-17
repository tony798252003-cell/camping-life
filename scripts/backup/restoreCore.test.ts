import { describe, it, expect } from 'vitest'
import { diffRows, RESTORE_ORDER, sqlLiteral, buildInsertSql } from './restoreCore'

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

// 為什麼：id 是 GENERATED ALWAYS identity 時 PostgREST 無法插入明確 id，只能產生 OVERRIDING SYSTEM VALUE 的 SQL 讓使用者手動貼上；跳脫錯誤會毀資料
describe('sqlLiteral', () => {
  it('字串跳脫單引號', () => expect(sqlLiteral("it's")).toBe("'it''s'"))
  it('null / undefined 為 NULL', () => {
    expect(sqlLiteral(null)).toBe('NULL')
    expect(sqlLiteral(undefined)).toBe('NULL')
  })
  it('數字與布林', () => {
    expect(sqlLiteral(12.5)).toBe('12.5')
    expect(sqlLiteral(true)).toBe('true')
    expect(sqlLiteral(false)).toBe('false')
  })
  it('物件與陣列為 jsonb，內含單引號也跳脫', () => {
    expect(sqlLiteral({ a: "x'y" })).toBe(`'{"a":"x''y"}'::jsonb`)
    expect(sqlLiteral([1, 2])).toBe(`'[1,2]'::jsonb`)
  })
  it('timestamp 字串維持字串', () =>
    expect(sqlLiteral('2026-01-02T03:04:05+00:00')).toBe("'2026-01-02T03:04:05+00:00'"))
})

describe('buildInsertSql', () => {
  it('產生含 OVERRIDING SYSTEM VALUE 的 INSERT，欄位為聯集、缺值補 NULL', () => {
    const sql = buildInsertSql('trip_photos', [{ id: 1, url: 'a' }, { id: 2, note: "n'" }])
    expect(sql).toBe(
      `INSERT INTO public.trip_photos ("id", "url", "note") OVERRIDING SYSTEM VALUE VALUES\n(1, 'a', NULL),\n(2, NULL, 'n''');`
    )
  })
})
