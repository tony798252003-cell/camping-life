import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | undefined

function getClient(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    }
    client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  }
  return client
}

// 延遲建立：沒有環境變數時 import 不會爆，只有真的呼叫時才丟錯
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get: (_t, prop) => Reflect.get(getClient(), prop),
})
