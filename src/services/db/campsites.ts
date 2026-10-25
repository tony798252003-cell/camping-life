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
  async listTripVisitRefs(): Promise<Pick<Tables<'camping_trips'>, 'campsite_id' | 'campsite_name' | 'status' | 'trip_date'>[] | null> {
    const { data, error } = await supabase
      .from('camping_trips')
      .select('campsite_id, campsite_name, status, trip_date')
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

  // 新增營區（AddCampsiteFlow）：帶入登入者為 created_by，回傳新列；錯誤原樣丟出（呼叫端依 error.code 判斷重複）
  async insertWithCreator(payload: Record<string, unknown>): Promise<Tables<'campsites'>> {
    const { data: { session } } = await supabase.auth.getSession()
    const insert = { ...payload, ...(session ? { created_by: session.user.id } : {}) }
    const { data, error } = await (supabase.from('campsites') as any).insert(insert).select().single()
    if (error) throw error
    return data as Tables<'campsites'>
  },

  // 以 id 或 google_place_id 抓單一營區；place id 查詢排除已合併的列（它們已被併入另一筆）
  async findOne(filter: { id: number } | { googlePlaceId: string }): Promise<Tables<'campsites'> | null> {
    const q = supabase.from('campsites').select('*')
    const { data, error } = await ('id' in filter ? q.eq('id', filter.id) : q.eq('google_place_id', filter.googlePlaceId).is('merged_into_id', null)).limit(1).maybeSingle()
    if (error) throw error
    return data
  },

  // 新增營區前的重複檢查用；失敗回 null（呼叫端顯示警告但流程照走）
  async listForMatching(): Promise<Pick<Tables<'campsites'>, 'id' | 'name' | 'district' | 'latitude' | 'longitude' | 'google_place_id' | 'phone' | 'merged_into_id'>[] | null> {
    const { data, error } = await supabase
      .from('campsites')
      .select('id,name,district,latitude,longitude,google_place_id,phone,merged_into_id')
      .is('merged_into_id', null)
      .limit(5000)
    return error ? null : data
  },
}
