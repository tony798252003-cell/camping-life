// 月檢視列表範圍與「點某一天」的唯一規則（規格 §5.3）。
import { addDays } from '../dateRange'
import type { ViewEvent } from './viewEvent'

export interface YmdRange {
  from: string
  to: string
}

const pad = (n: number) => String(n).padStart(2, '0')

// 當月從今天開始列，其他月份列整個月
export function agendaRange(year: number, month: number, today: string): YmdRange {
  const first = `${year}-${pad(month)}-01`
  const next = `${month === 12 ? year + 1 : year}-${pad(month === 12 ? 1 : month + 1)}-01`
  const last = addDays(next, -1)
  const from = today >= first && today <= last ? today : first
  return { from, to: last }
}

export function eventsOnDay(ymd: string, events: ViewEvent[]): ViewEvent[] {
  return events.filter((e) => e.startDate <= ymd && e.endDate >= ymd)
}

export function dayClickAction(ymd: string, range: YmdRange, events: ViewEvent[]): 'scroll' | 'sheet' {
  const inRange = ymd >= range.from && ymd <= range.to
  return inRange && eventsOnDay(ymd, events).length > 0 ? 'scroll' : 'sheet'
}
