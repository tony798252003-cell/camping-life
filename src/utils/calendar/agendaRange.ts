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

// 當天事件的唯一排序（月列表、日清單、首頁共用）：全天與跨天的中間日在前，再依開始時間；同順位維持 feed 順序
export function eventsOnDay(ymd: string, events: ViewEvent[]): ViewEvent[] {
  const start = (e: ViewEvent) => (e.allDay || e.startMin == null || e.startDate !== ymd ? -1 : e.startMin)
  return events
    .filter((e) => e.startDate <= ymd && e.endDate >= ymd)
    .map((e, i) => ({ e, i }))
    .sort((a, b) => start(a.e) - start(b.e) || a.i - b.i)
    .map((x) => x.e)
}

export function dayClickAction(ymd: string, range: YmdRange, events: ViewEvent[]): 'scroll' | 'sheet' {
  const inRange = ymd >= range.from && ymd <= range.to
  return inRange && eventsOnDay(ymd, events).length > 0 ? 'scroll' : 'sheet'
}
