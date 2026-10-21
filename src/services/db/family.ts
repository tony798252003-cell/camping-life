import { supabase } from '../../lib/supabase'

export interface FamilyMember {
  id: string
  name: string
  email: string
  is_head: boolean
}

export interface FamilyInfo {
  id: string
  name: string
  invite_code: string
}

export const familyQueries = {
  async listMembers(): Promise<FamilyMember[]> {
    const { data, error } = await supabase.rpc('get_family_members')
    if (error) throw error
    return data ?? []
  },

  // RLS 只讓自己看到自己所屬的家庭
  async getFamily(familyId: string): Promise<FamilyInfo | null> {
    const { data, error } = await supabase
      .from('families')
      .select('id, name, invite_code')
      .eq('id', familyId)
      .maybeSingle()
    if (error) throw error
    return data
  },

  // 邀請碼不正確時 DB 丟 P0002
  async join(code: string): Promise<void> {
    const { error } = await supabase.rpc('join_family_by_code', { code_input: code })
    if (error) throw error
  },
}
