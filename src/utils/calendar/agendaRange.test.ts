import { describe, it, expect } from 'vitest'
import type { ViewEvent } from './viewEvent'
import { dayAgenda } from './glance'
import { agendaRange, eventsOnDay, dayClickAction } from './agendaRange'

const ev = (o: Partial<ViewEvent> & { key: string }): ViewEvent => ({
  source: 'event', sourceId: o.key, title: o.key, color: '#000', categoryId: null,
  allDay: true, startDate: '2026-10-20', endDate: '2026-10-20', past: false, ...o,
})

describe('agendaRange', () => {
  it('當月從今天開始列到月底', () => {
    // 規格 §5.3：當月過去的日期不列在列表，否則使用者每次開啟都要先捲過一堆已過去的事
    expect(agendaRange(2026, 10, '2026-10-17')).toEqual({ from: '2026-10-17', to: '2026-10-31' })
  })
  it('其他月份列整個月（含 2 月與 12 月邊界）', () => {
    // 閏年／跨年邊界算錯會讓月底事件從列表消失
    expect(agendaRange(2028, 2, '2026-10-17')).toEqual({ from: '2028-02-01', to: '2028-02-29' })
    expect(agendaRange(2026, 12, '2026-10-17')).toEqual({ from: '2026-12-01', to: '2026-12-31' })
  })
})

describe('eventsOnDay', () => {
  it('多天事件涵蓋的每一天都算有事件', () => {
    // 點月曆上露營中間那天要能捲到列表；只比對 startDate 會讓中間日期被誤判為沒事件
    const e = ev({ key: 'trip', startDate: '2026-10-23', endDate: '2026-10-25' })
    expect(eventsOnDay('2026-10-24', [e])).toEqual([e])
    expect(eventsOnDay('2026-10-26', [e])).toEqual([])
  })
})

describe('dayClickAction（規格 §5.3 唯一規則）', () => {
  const range = { from: '2026-10-17', to: '2026-10-31' }
  const events = [ev({ key: 'a', startDate: '2026-10-20', endDate: '2026-10-20' }), ev({ key: 'old', startDate: '2026-10-05', endDate: '2026-10-05' })]
  it('範圍內且有事件 → 捲到列表', () => {
    expect(dayClickAction('2026-10-20', range, events)).toBe('scroll')
  })
  it('範圍內但沒事件 → 開當日 sheet（顯示空狀態與新增）', () => {
    expect(dayClickAction('2026-10-21', range, events)).toBe('sheet')
  })
  it('範圍外（當月過去日）即使有事件 → 開當日 sheet', () => {
    // 列表沒有那一天的群組，捲動會無處可去
    expect(dayClickAction('2026-10-05', range, events)).toBe('sheet')
  })
  // 為什麼：首頁「今天」清單與月列表必須同序，否則同一天兩處看到的順序不一致
  it('全天在前、timed 依時間；首頁 dayAgenda 與列表同序', () => {
    const night = ev({ key: 'night', allDay: false, startMin: 1145 })
    const morning = ev({ key: 'morning', allDay: false, startMin: 540 })
    const a = ev({ key: 'a' })
    const b = ev({ key: 'b' })
    const list = [night, a, morning, b]
    expect(eventsOnDay('2026-10-20', list).map((e) => e.key)).toEqual(['a', 'b', 'morning', 'night'])
    expect(dayAgenda('2026-10-20', list, 10)).toEqual(eventsOnDay('2026-10-20', list))
  })
})
