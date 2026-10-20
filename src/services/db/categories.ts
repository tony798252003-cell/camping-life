import { supabase } from '../../lib/supabase'
import type { EventCategory } from '../../types/database'

// 預設分類（規格 §6.2）；露營、棒球由 migration 回填且不可刪，這裡只服務「完全沒有分類」的新帳號
const DEFAULTS = [
  { name: '露營', color: '#10b981', system_key: 'camping', sort_order: 0 },
  { name: '棒球', color: '#9d1c32', system_key: 'baseball', sort_order: 1 },
  { name: '工作', color: '#3b82f6', system_key: 'work', sort_order: 2 },
  { name: '家庭', color: '#f59e0b', system_key: 'family', sort_order: 3 },
  { name: '個人', color: '#8b5cf6', system_key: 'personal', sort_order: 4 },
]

export const categoryQueries = {
  async list(): Promise<EventCategory[]> {
    const { data, error } = await supabase
      .from('event_categories')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
    if (error) throw error
    return data ?? []
  },

  // PM 決定（審查）：只有使用者完全沒有任何分類時才建立預設；否則什麼都不做，
  // 避免把使用者刪掉的分類加回來或撞 unique(owner_id,name)（規格 §17 S6、D27）
  async ensureDefaults(): Promise<void> {
    const existing = await this.list()
    if (existing.length > 0) return
    const { error } = await supabase.from('event_categories').insert(DEFAULTS)
    if (error) throw error
  },

  async create(name: string, color: string): Promise<EventCategory> {
    const { data, error } = await supabase
      .from('event_categories')
      .insert({ name, color })
      .select()
      .single()
    if (error) throw error
    return data
  },

  async update(id: string, patch: { name?: string; color?: string; sort_order?: number }): Promise<void> {
    const { error } = await supabase.from('event_categories').update(patch).eq('id', id)
    if (error) throw error
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('event_categories').delete().eq('id', id)
    if (error) throw error
  },
}
