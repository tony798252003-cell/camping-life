import { supabase } from '../../lib/supabase'
import type { CalendarEventRow, NewCalendarEvent } from '../../types/database'
import { toEventRow, type EventInput } from '../../utils/calendar/eventRow'

// 單一使用者、資料量小：listAll 不做範圍查詢（Rule 2）
export const eventQueries = {
  async listAll(): Promise<CalendarEventRow[]> {
    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .order('start_time', { ascending: true })
    if (error) throw error
    return data ?? []
  },

  async create(i: EventInput): Promise<CalendarEventRow> {
    const { data, error } = await supabase
      .from('calendar_events')
      .insert(toEventRow(i))
      .select()
      .single()
    if (error) throw error
    return data
  },

  async update(id: string, i: EventInput): Promise<void> {
    const { error } = await supabase.from('calendar_events').update(toEventRow(i)).eq('id', id)
    if (error) throw error
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('calendar_events').delete().eq('id', id)
    if (error) throw error
  },

  // 過渡用：舊 CalendarView.vue 仍直接送原始欄位，M3 新畫面接上後移除
  async createRaw(row: NewCalendarEvent): Promise<CalendarEventRow> {
    const { data, error } = await supabase.from('calendar_events').insert(row).select().single()
    if (error) throw error
    return data
  },

  async updateRaw(id: string, row: Partial<NewCalendarEvent>): Promise<CalendarEventRow> {
    const { data, error } = await supabase.from('calendar_events').update(row).eq('id', id).select().single()
    if (error) throw error
    return data
  },
}
