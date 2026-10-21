import { supabase } from '../../lib/supabase'
import type { Tables, TablesInsert, TablesUpdate } from '../../types/supabase'

export const gearQueries = {
  // 使用者的裝備（可限定 type），依建立時間排序
  async listByUser(userId: string, type?: string): Promise<Tables<'camping_gear'>[]> {
    let q = supabase.from('camping_gear').select('*').eq('user_id', userId)
    if (type) q = q.eq('type', type)
    const { data, error } = await q.order('created_at', { ascending: true })
    if (error) throw error
    return data ?? []
  },

  // RLS 放行的裝備（自己的 + 同家庭成員的），行程編輯的帳篷選單用
  async listVisible(type?: string): Promise<Tables<'camping_gear'>[]> {
    let q = supabase.from('camping_gear').select('*')
    if (type) q = q.eq('type', type)
    const { data, error } = await q.order('created_at', { ascending: true })
    if (error) throw error
    return data ?? []
  },

  async insert(payload: TablesInsert<'camping_gear'>): Promise<Tables<'camping_gear'> | null> {
    const { data, error } = await supabase.from('camping_gear').insert([payload]).select().single()
    if (error) throw error
    return data
  },

  async insertMany(payloads: TablesInsert<'camping_gear'>[]): Promise<Tables<'camping_gear'>[] | null> {
    const { data, error } = await supabase.from('camping_gear').insert(payloads).select()
    if (error) throw error
    return data
  },

  async update(id: number, patch: TablesUpdate<'camping_gear'>): Promise<void> {
    const { error } = await supabase.from('camping_gear').update(patch).eq('id', id)
    if (error) throw error
  },

  async remove(id: number): Promise<void> {
    const { error } = await supabase.from('camping_gear').delete().eq('id', id)
    if (error) throw error
  },

  async removeMany(ids: number[]): Promise<void> {
    const { error } = await supabase.from('camping_gear').delete().in('id', ids)
    if (error) throw error
  },

  // 管理員維護的系統帳篷圖庫；失敗時回空陣列（沿用原行為：不拋錯）
  async listSystemImages(): Promise<Tables<'system_assets'>[]> {
    const { data } = await supabase
      .from('system_assets')
      .select('*')
      .eq('type', 'tent_image')
      .order('created_at', { ascending: false })
    return data ?? []
  },
}
