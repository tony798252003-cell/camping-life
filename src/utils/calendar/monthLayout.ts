// 月格排版：週一起始的週陣列，以及每週的多天橫條 / 單日圓點配置（規格 §5.4）。
import { addDays, diffDays, eachDay, weekdayMon0 } from '../dateRange'
import type { ViewEvent } from './viewEvent'

export interface WeekBar {
  event: ViewEvent
  row: number
  startCol: number
  span: number
  continuesBefore: boolean
  continuesAfter: boolean
}
export interface WeekLayout {
  bars: WeekBar[]
  dots: Record<string, ViewEvent[]>
  cpblDays: Set<string>
  tripDays: Set<string> // 露營日（含夜衝那晚），月格右上角畫帳篷
}

const pad = (n: number) => String(n).padStart(2, '0')

export function buildMonthWeeks(year: number, month: number): string[][] {
  const first = `${year}-${pad(month)}-01`
  const last = addDays(`${month === 12 ? year + 1 : year}-${pad(month === 12 ? 1 : month + 1)}-01`, -1)
  const start = addDays(first, -weekdayMon0(first))
  const end = addDays(last, 6 - weekdayMon0(last))
  const days = eachDay(start, end)
  const weeks: string[][] = []
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7))
  return weeks
}

const isBar = (e: ViewEvent) => e.allDay && e.endDate > e.startDate

function pushDot(dots: Record<string, ViewEvent[]>, day: string, e: ViewEvent) {
  ;(dots[day] ??= []).push(e)
}

export function layoutWeek(week: string[], events: ViewEvent[], maxBars = 2): WeekLayout {
  const first = week[0]!
  const last = week[week.length - 1]!
  const inWeek = events.filter((e) => e.startDate <= last && e.endDate >= first)
  const dots: Record<string, ViewEvent[]> = {}
  const cpblDays = new Set<string>()
  const tripDays = new Set<string>()
  const bars: WeekBar[] = []

  const barEvents: ViewEvent[] = []
  for (const e of inWeek) {
    if (e.source === 'trip') {
      for (const d of eachDay(e.startDate < first ? first : e.startDate, e.endDate > last ? last : e.endDate)) tripDays.add(d)
    }
    if (e.source === 'cpbl') {
      for (const d of eachDay(e.startDate < first ? first : e.startDate, e.endDate > last ? last : e.endDate)) cpblDays.add(d)
    } else if (isBar(e)) barEvents.push(e)
    else {
      for (const d of eachDay(e.startDate < first ? first : e.startDate, e.endDate > last ? last : e.endDate)) pushDot(dots, d, e)
    }
  }

  barEvents.sort((a, b) =>
    a.startDate.localeCompare(b.startDate) ||
    diffDays(b.startDate, b.endDate) - diffDays(a.startDate, a.endDate) ||
    a.key.localeCompare(b.key))

  const rows: boolean[][] = [] // rows[row][col] 是否已佔用
  for (const e of barEvents) {
    const startCol = Math.max(0, diffDays(first, e.startDate))
    const endCol = Math.min(week.length - 1, diffDays(first, e.endDate))
    let row = 0
    while (rows[row]?.slice(startCol, endCol + 1).some(Boolean)) row++
    if (row >= maxBars) {
      for (let c = startCol; c <= endCol; c++) pushDot(dots, week[c]!, e)
      continue
    }
    const occ = (rows[row] ??= [])
    for (let c = startCol; c <= endCol; c++) occ[c] = true
    bars.push({
      event: e, row, startCol, span: endCol - startCol + 1,
      continuesBefore: e.startDate < first, continuesAfter: e.endDate > last,
    })
  }
  return { bars, dots, cpblDays, tripDays }
}
