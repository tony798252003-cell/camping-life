import { supabase } from '../../lib/supabase'

// 營區最愛（全家共用）；RLS 只回傳自己家庭的列，所以列表不必再 filter family_id
export const campsiteFavoriteQueries = {
  async listIds(): Promise<number[]> {
    const { data, error } = await supabase.from('campsite_favorites').select('campsite_id')
    if (error) throw error
    return (data ?? []).map(r => r.campsite_id)
  },

  // upsert + ignoreDuplicates：家人同時按也只會有一列（primary key (family_id, campsite_id)）
  async add(familyId: string, campsiteId: number): Promise<void> {
    const { error } = await supabase
      .from('campsite_favorites')
      .upsert({ family_id: familyId, campsite_id: campsiteId }, { onConflict: 'family_id,campsite_id', ignoreDuplicates: true })
    if (error) throw error
  },

  async remove(familyId: string, campsiteId: number): Promise<void> {
    const { error } = await supabase
      .from('campsite_favorites')
      .delete()
      .eq('family_id', familyId)
      .eq('campsite_id', campsiteId)
    if (error) throw error
  },
}
