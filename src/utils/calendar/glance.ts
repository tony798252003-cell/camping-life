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

// 格子底色取「當天第一個事件」的分類色（淡色底 + 底部色條）；沒事件或不是 #rrggbb 就不上色
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

// 賽程標題帶 ⚾ 前綴（資料層規格），畫面上不用 emoji 當圖示
export const displayTitle = (e: ViewEvent) => e.title.replace(/^⚾\s*/, '')
