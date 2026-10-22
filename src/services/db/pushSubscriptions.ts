import { supabase } from '../../lib/supabase'

export interface PushSubscriptionKeys {
  endpoint: string
  p256dh: string
  auth: string
}

export const pushSubscriptionQueries = {
  // 走 security definer RPC：endpoint 全域唯一，同一支瀏覽器換帳號時要把既有列改歸目前使用者，
  // 否則舊帳號的提醒會繼續送到這支裝置（RLS 不允許直接 update／讀別人的列）
  async save(sub: PushSubscriptionKeys): Promise<void> {
    const { error } = await supabase.rpc('claim_push_subscription', {
      p_endpoint: sub.endpoint,
      p_p256dh: sub.p256dh,
      p_auth: sub.auth,
    })
    if (error) throw error
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

  // 登出前呼叫（要趁還有登入身分時刪列）：刪掉這支裝置的訂閱並取消瀏覽器訂閱。
  // best-effort：任何失敗或逾時都吞掉，不能擋住登出；漏刪也有 claim 認領兜底。
  async releaseThisDevice(timeoutMs = 3000): Promise<void> {
    if (!('serviceWorker' in navigator)) return
    const work = (async () => {
      // 用 getRegistration 而不是 ready：沒註冊 SW 時 ready 永遠不會 resolve
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = await reg?.pushManager.getSubscription()
      if (!sub) return
      await pushSubscriptionQueries.remove(sub.endpoint).catch((e) => console.warn('[push] remove on logout failed:', e))
      await sub.unsubscribe().catch(() => {})
    })()
    await Promise.race([work, new Promise<void>((r) => setTimeout(r, timeoutMs))]).catch((e) => console.warn('[push] release failed:', e))
  },
}
