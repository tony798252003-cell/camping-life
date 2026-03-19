import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env' })
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  const { data } = await supabase.from('campsites').select('name, city, district').in('city', ['臺東縣', '宜蘭縣']).limit(10)
  console.table(data)
}

main().catch(console.error)
