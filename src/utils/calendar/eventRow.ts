import type { CalendarEventRow } from '../../types/database'
import type { TablesInsert } from '../../types/supabase'
import { addDays, taipeiIso, taipeiMinutes, taipeiYmd } from '../dateRange'

export interface EventInput {
  title: string
  description: string | null
  categoryId: string
  allDay: boolean
  startDate: string
  endDate: string
  startTime?: string // HH:mm
  endTime?: string
  cpblGameId?: string | null
}

// 結束日剛好是開始日隔天、且結束時間早於開始時間 = 目前仍是「跨午夜」的自動隔天
export const isBumpedRange = (startDate: string, endDate: string, startTime: string, endTime: string) =>
  endDate === addDays(startDate, 1) && endTime < startTime

type EventRowInsert = Pick<
  TablesInsert<'calendar_events'>,
  'title' | 'description' | 'category_id' | 'is_all_day' | 'start_date' | 'end_date' | 'start_time' | 'end_time' | 'cpbl_game_id' | 'visibility'
>

// 有時段事件的結束日自動調整：
// - 同一天結束時間早於開始時間（例如 22:00–02:00）：結束日改成隔天（bumped）
// - 之前是自動改成隔天、現在時間又合理了：還原成同一天；使用者手動改過結束日（不再等於隔天）就不動
export function normalizeTimedRange(
  startDate: string,
  endDate: string,
  startTime: string,
  endTime: string,
  bumped = false,
): { endDate: string; bumped: boolean } {
  if (bumped) {
    if (endDate !== addDays(startDate, 1)) return { endDate, bumped: false }
    if (endTime >= startTime) return { endDate: startDate, bumped: false }
    return { endDate, bumped: true }
  }
  if (startDate === endDate && endTime < startTime) return { endDate: addDays(startDate, 1), bumped: true }
  return { endDate, bumped: false }
}

export function toEventRow(i: EventInput): EventRowInsert {
  const base = {
    title: i.title,
    description: i.description,
    category_id: i.categoryId || null,
    is_all_day: i.allDay,
    cpbl_game_id: i.cpblGameId ?? null,
    visibility: 'private',
  }
  if (i.allDay) {
    // start_time/end_time 是 NOT NULL 舊欄位，寫台北 00:00，台北日期必須等於 start_date/end_date
    return {
      ...base,
      start_date: i.startDate,
      end_date: i.endDate,
      start_time: taipeiIso(i.startDate, '00:00'),
      end_time: taipeiIso(i.endDate, '00:00'),
    }
  }
  return {
    ...base,
    start_date: null,
    end_date: null,
    start_time: taipeiIso(i.startDate, i.startTime ?? '00:00'),
    end_time: taipeiIso(i.endDate, i.endTime ?? '00:00'),
  }
}

const hhmm = (iso: string) => {
  const m = taipeiMinutes(iso)
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

export function fromEventRow(e: CalendarEventRow): EventInput {
  const common = {
    title: e.title,
    description: e.description,
    categoryId: e.category_id ?? '',
    cpblGameId: e.cpbl_game_id,
  }
  if (e.is_all_day) {
    return {
      ...common,
      allDay: true,
      startDate: e.start_date ?? taipeiYmd(e.start_time),
      endDate: e.end_date ?? taipeiYmd(e.end_time),
    }
  }
  return {
    ...common,
    allDay: false,
    startDate: taipeiYmd(e.start_time),
    endDate: taipeiYmd(e.end_time),
    startTime: hhmm(e.start_time),
    endTime: hhmm(e.end_time),
  }
}
