import { supabase } from '../../lib/supabase'

export const profileQueries = {
  async setShowCpbl(userId: string, v: boolean): Promise<void> {
    const { error } = await supabase.from('profiles').update({ show_cpbl: v }).eq('id', userId)
    if (error) throw error
  },
}
