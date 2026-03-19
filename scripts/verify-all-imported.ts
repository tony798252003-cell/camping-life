import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env' })
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  const { error, count } = await supabase.from('campsites').update({ is_verified: true }, { count: 'exact' }).eq('is_verified', false)
  if (error) console.error('Error:', error.message)
  else console.log(`Updated ${count} rows to verified`)
}

main().catch(console.error)
