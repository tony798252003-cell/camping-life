import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env' })
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const { error } = await (supabase as any).rpc('exec_sql', {
  sql: 'ALTER TABLE campsites ADD COLUMN IF NOT EXISTS total_capacity integer'
})
if (error) {
  // 嘗試直接 update 看看欄位是否已存在
  const { error: e2 } = await supabase.from('campsites').update({ total_capacity: 0 } as any).eq('id', -1)
  if (e2 && e2.message.includes('total_capacity')) {
    console.error('欄位不存在，請在 Supabase Dashboard 執行: ALTER TABLE campsites ADD COLUMN total_capacity integer')
  } else {
    console.log('欄位已存在或已建立')
  }
} else {
  console.log('欄位建立成功')
}
