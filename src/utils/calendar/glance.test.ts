import { describe, it, expect } from 'vitest'
import type { ViewEvent } from './viewEvent'
import { cellTint, dayAgenda, displayTitle, timeLabel, weekRow } from './glance'

const ev = (o: Partial<ViewEvent> & { key: string }): ViewEvent => ({
  source: 'event', sourceId: o.key, title: o.key, color: '#10b981', categoryId: null,
  allDay: true, startDate: '2026-10-21', endDate: '2026-10-21', past: false, ...o,
})

describe('weekRow', () => {
  it('以週一開頭、週日結尾', () => {
    // 首頁速覽的欄位標頭是「一…日」，第一格不是週一整週都會錯位
    expect(weekRow('2026-10-21')).toEqual(['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'])
  })
  it('週日屬於該週最後一天，且能跨月', () => {
    // 週日 weekday 算成 0 的話會跳到下一週；10/31 是週六，週一在 10/26，週日落在 11/1
    expect(weekRow('2026-11-01')[0]).toBe('2026-10-26')
    expect(weekRow('2026-10-31')[6]).toBe('2026-11-01')
  })
})

describe('cellTint', () => {
  it('取當天第一個事件的顏色', () => {
    // 格子只能有一個底色，規格定為 feed 順序的第一個，否則同一天每次渲染顏色可能不同
    const t = cellTint('2026-10-21', [ev({ key: 'a', color: '#9d1c32' }), ev({ key: 'b', color: '#8b5cf6' })])
    expect(t).toEqual({ color: '#9d1c32', bg: '#9d1c3222' })
  })
  it('多天事件涵蓋的每一天都上色', () => {
    // 露營兩天，兩格都要有色條，不能只有開始日
    const e = ev({ key: 'c', startDate: '2026-10-24', endDate: '2026-10-25' })
    expect(cellTint('2026-10-25', [e])).not.toBeNull()
  })
  it('沒事件或顏色格式未知就不上色', () => {
    // 加 alpha 後綴只對 #rrggbb 有效；其他格式拼出來是壞 CSS
    expect(cellTint('2026-10-22', [ev({ key: 'a' })])).toBeNull()
    expect(cellTint('2026-10-21', [ev({ key: 'a', color: 'red' })])).toBeNull()
  })
})

describe('dayAgenda / timeLabel', () => {
  it('全天在前、timed 依開始時間排序，並限制筆數', () => {
    // 首頁只放 3 筆；早上的事不能被晚上的比賽擠掉
    const night = ev({ key: 'night', allDay: false, startMin: 19 * 60 + 5 })
    const morning = ev({ key: 'morning', allDay: false, startMin: 9 * 60 })
    const all = ev({ key: 'all' })
    const extra = ev({ key: 'extra', allDay: false, startMin: 23 * 60 })
    expect(dayAgenda('2026-10-21', [night, morning, all, extra], 3).map((e) => e.key)).toEqual(['all', 'morning', 'night'])
  })
  it('多天 timed 事件在非開始日顯示全天', () => {
    // startMin 只對開始那天有意義，後續日顯示 19:05 會誤導
    const e = ev({ key: 'x', allDay: false, startMin: 1145, startDate: '2026-10-20', endDate: '2026-10-22' })
    expect(timeLabel(e, '2026-10-20')).toBe('19:05')
    expect(timeLabel(e, '2026-10-21')).toBe('全天')
  })
})

describe('displayTitle', () => {
  it('去掉賽程標題的 ⚾ 前綴，其他標題不動', () => {
    expect(displayTitle(ev({ key: 'g', title: '⚾ 樂天桃猿 vs 統一獅' }))).toBe('樂天桃猿 vs 統一獅')
    expect(displayTitle(ev({ key: 'g', title: '瑜珈課' }))).toBe('瑜珈課')
  })
})
