import { describe, it, expect } from 'vitest'
import type { ViewEvent } from './viewEvent'
import { layoutDay, allDayFor } from './timeGridLayout'

const ev = (o: Partial<ViewEvent> & { key: string }): ViewEvent => ({
  source: 'event', sourceId: o.key, title: o.key, color: '#000', categoryId: null,
  allDay: false, startDate: '2026-10-17', endDate: '2026-10-17', past: false, ...o,
})
const timed = (key: string, s: number, e: number) => ev({ key, startMin: s, endMin: e })
const D = '2026-10-17'

describe('layoutDay', () => {
  it('首尾相接不算重疊', () => {
    // 09–10 與 10–11 若被當成重疊，會平白縮成半寬，使用者以為時間衝突
    const r = layoutDay(D, [timed('a', 540, 600), timed('b', 600, 660)])
    expect(r.map((p) => [p.col, p.cols])).toEqual([[0, 1], [0, 1]])
  })
  it('真正重疊的事件分欄', () => {
    // 09–11 與 10–12 同時進行，必須並排顯示才看得到兩個
    const r = layoutDay(D, [timed('a', 540, 660), timed('b', 600, 720)])
    expect(r.map((p) => [p.col, p.cols])).toEqual([[0, 2], [1, 2]])
  })
  it('cols 取群內最大欄數，且群與群互不影響', () => {
    // a 與 b、c 重疊但 b、c 不互疊 -> 2 欄；後面獨立的 d 不能被拉成 2 欄
    const r = layoutDay(D, [timed('a', 540, 720), timed('b', 540, 600), timed('c', 600, 660), timed('d', 780, 840)])
    expect(r.find((p) => p.event.key === 'a')).toMatchObject({ col: 1, cols: 2 })
    expect(r.find((p) => p.event.key === 'b')).toMatchObject({ col: 0, cols: 2 })
    expect(r.find((p) => p.event.key === 'c')).toMatchObject({ col: 0, cols: 2 })
    expect(r.find((p) => p.event.key === 'd')).toMatchObject({ col: 0, cols: 1 })
  })
  it('跨午夜事件截到當日範圍', () => {
    // 22:00–02:00 在 10/17 只畫到 24:00，10/18 從 0:00 開始，否則格子會畫出界
    const e = ev({ key: 'n', endDate: '2026-10-18', startMin: 1320, endMin: 120 })
    expect(layoutDay('2026-10-17', [e])[0]).toMatchObject({ top: 1320, bottom: 1440 })
    expect(layoutDay('2026-10-18', [e])[0]).toMatchObject({ top: 0, bottom: 120 })
  })
  it('全天事件與不涵蓋當日的事件不在結果內', () => {
    // 全天事件走頂部全天列；若混進時間格會被排成 0 分鐘高度
    const all = ev({ key: 'all', allDay: true })
    expect(layoutDay(D, [all, ev({ key: 'x', startDate: '2026-10-18', endDate: '2026-10-18', startMin: 60, endMin: 120 })])).toEqual([])
  })
})

describe('allDayFor', () => {
  it('只收涵蓋當日的全天事件（含多天）', () => {
    // 多天行程中間那天也要出現在全天列
    const multi = ev({ key: 'm', allDay: true, startDate: '2026-10-16', endDate: '2026-10-18' })
    const other = ev({ key: 'o', allDay: true, startDate: '2026-10-19', endDate: '2026-10-19' })
    expect(allDayFor(D, [multi, other]).map((e) => e.key)).toEqual(['m'])
  })
  it('跨午夜的時間事件不算全天', () => {
    // 22:00–02:00 是時間格事件，放進全天列會讓兩天都多出一個假的全天項目
    const n = ev({ key: 'n', endDate: '2026-10-18', startMin: 1320, endMin: 120 })
    expect(allDayFor('2026-10-17', [n])).toEqual([])
    expect(allDayFor('2026-10-18', [n])).toEqual([])
  })
})
