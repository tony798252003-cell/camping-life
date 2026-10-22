import { supabase } from '../../lib/supabase'
import type { FamilyList, FamilyListItem } from '../../types/database'
import { todoListRow } from '../../utils/familyLists'

export const listQueries = {
  async listLists(): Promise<FamilyList[]> {
    const { data, error } = await supabase
      .from('family_lists')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
    if (error) throw error
    return data ?? []
  },

  // 一次抓全部項目（資料量小），首頁算未完成數、清單頁分組都用它
  async listItems(): Promise<FamilyListItem[]> {
    const { data, error } = await supabase.from('family_list_items').select('*')
    if (error) throw error
    return data ?? []
  },

  // upsert + ignoreDuplicates：兩支手機同時載入時，靠 (family_id, title) 唯一鍵只會建一份
  async createTodoList(familyId: string): Promise<void> {
    const { error } = await supabase
      .from('family_lists')
      .upsert(todoListRow(familyId), { onConflict: 'family_id,title', ignoreDuplicates: true })
    if (error) throw error
  },

  async addItem(listId: string, text: string, sortOrder: number): Promise<FamilyListItem> {
    const { data, error } = await supabase
      .from('family_list_items')
      .insert({ list_id: listId, text, sort_order: sortOrder })
      .select()
      .single()
    if (error) throw error
    return data
  },

  async setDone(id: string, done: boolean, userId: string | null): Promise<void> {
    const { error } = await supabase
      .from('family_list_items')
      .update(done ? { done: true, done_by: userId, done_at: new Date().toISOString() } : { done: false, done_by: null, done_at: null })
      .eq('id', id)
    if (error) throw error
  },

  async removeItem(id: string): Promise<void> {
    const { error } = await supabase.from('family_list_items').delete().eq('id', id)
    if (error) throw error
  },

  async clearDone(listId: string): Promise<void> {
    const { error } = await supabase.from('family_list_items').delete().eq('list_id', listId).eq('done', true)
    if (error) throw error
  },
}
