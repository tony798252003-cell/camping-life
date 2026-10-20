import { describe, it, expect } from 'vitest'
import type { ViewEvent } from './viewEvent'
import { buildMonthWeeks, layoutWeek } from './monthLayout'

const ev = (o: Partial<ViewEvent> & { key: string }): ViewEvent => ({
  source: 'event', sourceId: o.key, title: o.key, color: '#000', categoryId: null,
  allDay: true, startDate: '2026-10-20', endDate: '2026-10-20', past: false, ...o,
})
const multi = (key: string, startDate: string, endDate: string) => ev({ key, startDate, endDate })
const W1 = ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25']
const W2 = ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']

describe('buildMonthWeeks', () => {
  it('週一起始並補鄰月日期', () => {
    // 10/1 是週四，第一格必須是 9/28，否則月曆欄位和星期對不上
    expect(buildMonthWeeks(2026, 10)[0]![0]).toBe('2026-09-28')
  })
  it('只產生必要週數', () => {
    // 2026-02 剛好 4 週多一天：1/26–3/1 共 5 週，不能多補一整週空白
    const w = buildMonthWeeks(2026, 2)
    expect(w.length).toBe(5)
    expect(w[4]![6]).toBe('2026-03-01')
    expect(w.every((r) => r.length === 7)).toBe(true)
  })
})

describe('layoutWeek', () => {
  it('跨週的 bar 在兩週各切一段並標記延續', () => {
    // 10/23(五)–10/27(二)：視覺上要連續，所以兩週都要有 bar 且帶 continues 旗標
    const e = multi('a', '2026-10-23', '2026-10-27')
    expect(layoutWeek(W1, [e]).bars).toEqual([
      { event: e, row: 0, startCol: 4, span: 3, continuesBefore: false, continuesAfter: true },
    ])
    expect(layoutWeek(W2, [e]).bars).toEqual([
      { event: e, row: 0, startCol: 0, span: 2, continuesBefore: true, continuesAfter: false },
    ])
  })
  it('首尾不重疊的兩個 bar 共用 row 0', () => {
    // 不浪費列數，月格高度才不會被撐大
    const l = layoutWeek(W1, [multi('a', '2026-10-19', '2026-10-20'), multi('b', '2026-10-21', '2026-10-22')])
    expect(l.bars.map((b) => b.row)).toEqual([0, 0])
  })
  it('超過 maxBars 的 bar 改成每天一個 dot', () => {
    // 三個重疊事件、只有 2 列：第 3 個不能消失，退成它涵蓋每天的 dot
    const es = [multi('a', '2026-10-20', '2026-10-22'), multi('b', '2026-10-20', '2026-10-22'), multi('c', '2026-10-20', '2026-10-22')]
    const l = layoutWeek(W1, es, 2)
    expect(l.bars.length).toBe(2)
    for (const d of ['2026-10-20', '2026-10-21', '2026-10-22']) expect(l.dots[d]!.map((x) => x.key)).toEqual(['c'])
  })
  it('排序：開始早、天數長優先', () => {
    // 長條放上面，短條補在下面，視覺才穩定
    const l = layoutWeek(W1, [multi('short', '2026-10-20', '2026-10-21'), multi('long', '2026-10-20', '2026-10-23'), multi('early', '2026-10-18', '2026-10-19')])
    expect(l.bars.map((b) => b.event.key)).toEqual(['early', 'long', 'short'])
    expect(l.bars.find((b) => b.event.key === 'long')!.row).toBe(0)
    expect(l.bars.find((b) => b.event.key === 'short')!.row).toBe(1)
  })
  it('cpbl 比賽只進 cpblDays，不畫 dot', () => {
    // 桃猿賽程是背景標記，不能跟使用者事件擠在同一格
    const g = ev({ key: 'cpbl:1', source: 'cpbl', startDate: '2026-10-21', endDate: '2026-10-21' })
    const l = layoutWeek(W1, [g])
    expect([...l.cpblDays]).toEqual(['2026-10-21'])
    expect(l.dots['2026-10-21'] ?? []).toEqual([])
  })
  it('跨午夜的 timed 事件不是 bar，涵蓋的每天各一個 dot', () => {
    // 22:00–02:00 兩天都有活動，月格兩天都要看得到
    const t = ev({ key: 't', allDay: false, startDate: '2026-10-17', endDate: '2026-10-18', startMin: 1320, endMin: 120 })
    const l = layoutWeek(['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18'], [t])
    expect(l.bars).toEqual([])
    expect(l.dots['2026-10-17']!.length).toBe(1)
    expect(l.dots['2026-10-18']!.length).toBe(1)
  })
  it('不在本週的事件被忽略', () => {
    // 每週只處理與自己相交的事件
    const l = layoutWeek(W1, [multi('x', '2026-11-03', '2026-11-05'), ev({ key: 'y', startDate: '2026-11-03', endDate: '2026-11-03' })])
    expect(l.bars).toEqual([])
    expect(l.dots).toEqual({})
  })
})
