import { supabase } from '../../lib/supabase'
import type { Tables, TablesInsert } from '../../types/supabase'

export const profileQueries = {
  async setShowCpbl(userId: string, v: boolean): Promise<void> {
    const { error } = await supabase.from('profiles').update({ show_cpbl: v }).eq('id', userId)
    if (error) throw error
  },

  async get(userId: string): Promise<Tables<'profiles'> | null> {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    return data
  },

  async getIsAdmin(userId: string): Promise<boolean | null> {
    const { data } = await supabase.from('profiles').select('is_admin').eq('id', userId).single()
    return data ? data.is_admin || false : null
  },

  async getCampsiteQuickChips(userId: string): Promise<string[] | null> {
    const { data } = await supabase.from('profiles').select('campsite_quick_chips').eq('id', userId).single()
    return data?.campsite_quick_chips ?? null
  },

  async setCampsiteQuickChips(userId: string, chips: string[]): Promise<void> {
    await supabase.from('profiles').update({ campsite_quick_chips: chips }).eq('id', userId)
  },

  // 登入後確保有 profiles 列：只送 {id}、衝突就忽略（ON CONFLICT DO NOTHING），不覆蓋既有欄位
  async ensure(userId: string): Promise<void> {
    const { error } = await supabase.from('profiles').upsert({ id: userId }, { onConflict: 'id', ignoreDuplicates: true })
    if (error) throw error
  },

  async upsert(row: TablesInsert<'profiles'>): Promise<void> {
    const { error } = await supabase.from('profiles').upsert(row)
    if (error) throw error
  },
}
