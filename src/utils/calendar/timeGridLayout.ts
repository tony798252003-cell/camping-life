// 週 / 日檢視的時間格排版：重疊分欄與全天列篩選（規格 §5.5）。
import type { ViewEvent } from './viewEvent'

export interface PositionedEvent {
  event: ViewEvent
  top: number // 分鐘 0–1440
  bottom: number
  col: number
  cols: number
}

const covers = (e: ViewEvent, ymd: string) => e.startDate <= ymd && ymd <= e.endDate

export function allDayFor(ymd: string, events: ViewEvent[]): ViewEvent[] {
  return events.filter((e) => e.allDay && covers(e, ymd))
}

export function layoutDay(ymd: string, events: ViewEvent[]): PositionedEvent[] {
  const items = events
    .filter((e) => !e.allDay && covers(e, ymd))
    .map((event) => {
      const top = event.startDate === ymd ? (event.startMin ?? 0) : 0
      const rawBottom = event.endDate === ymd ? (event.endMin ?? Math.min(top + 60, 1440)) : 1440
      return { event, top, bottom: Math.max(top, rawBottom), col: 0, cols: 1 }
    })
    .sort((a, b) => a.top - b.top || a.bottom - b.bottom)

  let group: typeof items = []
  let groupBottom = -1
  const flush = () => {
    const colBottoms: number[] = []
    for (const it of group) {
      let c = colBottoms.findIndex((b) => b <= it.top)
      if (c === -1) c = colBottoms.length
      colBottoms[c] = it.bottom
      it.col = c
    }
    for (const it of group) it.cols = colBottoms.length
    group = []
  }
  for (const it of items) {
    if (group.length && it.top >= groupBottom) flush()
    if (!group.length) groupBottom = it.bottom
    else groupBottom = Math.max(groupBottom, it.bottom)
    group.push(it)
  }
  flush()
  return items
}
