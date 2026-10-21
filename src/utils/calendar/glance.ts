// 首頁「行事曆速覽」與「今天」清單用的純函式（無 DOM、無 composable）。
import { addDays, weekdayMon0 } from '../dateRange'
import { eventsOnDay } from './agendaRange'
import type { ViewEvent } from './viewEvent'

// 週一到週日七天，含 ymd 那天
export function weekRow(ymd: string): string[] {
  const mon = addDays(ymd, -weekdayMon0(ymd))
  return Array.from({ length: 7 }, (_, i) => addDays(mon, i))
}

const HEX = /^#[0-9a-fA-F]{6}$/

// 格子底色取「當天第一個事件」的顏色（全家／我）（淡色底 + 底部色條）；沒事件或不是 #rrggbb 就不上色
export function cellTint(ymd: string, events: ViewEvent[]): { color: string; bg: string } | null {
  const color = eventsOnDay(ymd, events)[0]?.color
  return color && HEX.test(color) ? { color, bg: `${color}22` } : null
}

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

// 清單時間：只有「開始那天」的 timed 事件顯示時間，其餘（全天、多天的中間日）都算全天
export function timeLabel(e: ViewEvent, day: string): string {
  return e.allDay || e.startMin == null || e.startDate !== day ? '全天' : hhmm(e.startMin)
}

// 當天事件：順序與月列表相同（eventsOnDay）；最多 limit 筆
export const dayAgenda = (day: string, events: ViewEvent[], limit = 3): ViewEvent[] => eventsOnDay(day, events).slice(0, limit)

// 清單副標：「{lead} · 分類 · {建立者}新增」，沒有的部分略過
export const subtitle = (e: ViewEvent, lead: string) =>
  [lead, e.categoryName, e.creatorName && `${e.creatorName}新增`].filter(Boolean).join(' · ')

// 賽程標題帶 ⚾ 前綴（資料層規格），畫面上不用 emoji 當圖示
export const displayTitle = (e: ViewEvent) => e.title.replace(/^⚾\s*/, '')

// 本週行程：週一到週日逐日分組，只留有事件的日子；每天順序與月列表相同（eventsOnDay），不截斷
export function weekAgenda(today: string, events: ViewEvent[]): { day: string; items: ViewEvent[] }[] {
  return weekRow(today)
    .map((day) => ({ day, items: eventsOnDay(day, events) }))
    .filter((s) => s.items.length > 0)
}

const WEEK = ['一', '二', '三', '四', '五', '六', '日']
// 日標題：「10/21（三）今天・國慶日」
export function dayLabel(day: string, today: string, holidayName?: string | null): string {
  const base = `${Number(day.slice(5, 7))}/${Number(day.slice(8))}（${WEEK[weekdayMon0(day)]}）`
  return `${base}${day === today ? '今天' : ''}${holidayName ? `・${holidayName}` : ''}`
}
