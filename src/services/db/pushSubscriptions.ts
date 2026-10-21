import { supabase } from '../../lib/supabase'

export interface PushSubscriptionKeys {
  endpoint: string
  p256dh: string
  auth: string
}

export const pushSubscriptionQueries = {
  // user_id 由 DB default auth.uid() 帶入。RLS 沒有 update 權限，所以不用 upsert：
  // 同一支裝置已訂閱（endpoint 唯一鍵衝突 23505）視為成功
  async save(sub: PushSubscriptionKeys): Promise<void> {
    const { error } = await supabase.from('push_subscriptions').insert(sub)
    if (error && error.code !== '23505') throw error
  },

  async remove(endpoint: string): Promise<void> {
    const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
    if (error) throw error
  },

  async exists(endpoint: string): Promise<boolean> {
    const { data, error } = await supabase.from('push_subscriptions').select('id').eq('endpoint', endpoint).maybeSingle()
    if (error) throw error
    return !!data
  },
}
