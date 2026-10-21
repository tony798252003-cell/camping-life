import { supabase } from '../../lib/supabase'
import type { Tables, TablesInsert, TablesUpdate } from '../../types/supabase'

export const campsiteQueries = {
  // 營區搜尋（行程選營區下拉），排除已合併的列
  async search(query: string, limit = 5): Promise<Tables<'campsites'>[] | null> {
    const { data } = await supabase
      .from('campsites')
      .select('*')
      .is('merged_into_id', null)
      .ilike('name', `%${query}%`)
      .limit(limit)
    return data
  },

  async listActive(): Promise<Tables<'campsites'>[] | null> {
    const { data, error } = await supabase
      .from('campsites')
      .select('*')
      .is('merged_into_id', null)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data
  },

  // 營區庫「去過／已訂」標記用；失敗回 null（不影響營區列表）
  async listTripVisitRefs(): Promise<Pick<Tables<'camping_trips'>, 'campsite_id' | 'campsite_name' | 'status'>[] | null> {
    const { data, error } = await supabase
      .from('camping_trips')
      .select('campsite_id, campsite_name, status')
      .is('merged_into_id', null)
    return error ? null : data
  },

  async insert(payload: TablesInsert<'campsites'>): Promise<Tables<'campsites'>[]> {
    const { data, error } = await supabase.from('campsites').insert(payload).select()
    if (error) throw error
    return data ?? []
  },

  async update(id: number, patch: TablesUpdate<'campsites'>): Promise<Tables<'campsites'>[]> {
    const { data, error } = await supabase.from('campsites').update(patch).eq('id', id).select()
    if (error) throw error
    return data ?? []
  },
}
