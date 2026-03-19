import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env' })
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  // Get count of all non-verified campsites
  const { count: total } = await supabase.from('campsites').select('*', { count: 'exact', head: true }).eq('is_verified', false)
  console.log(`Total non-verified: ${total}`)

  // Delete ALL non-verified campsites (they were all from import)
  const { error, count } = await supabase.from('campsites').delete({ count: 'exact' }).eq('is_verified', false)
  if (error) console.error('Error:', error.message)
  else console.log(`Deleted ${count} rows`)
}

main().catch(console.error)
