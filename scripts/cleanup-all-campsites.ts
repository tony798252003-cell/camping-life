import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env' })
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  // Get campsite IDs that are used in camping_trips
  const { data: trips } = await supabase.from('camping_trips').select('campsite_id')
  const usedIds = [...new Set((trips ?? []).map((t: any) => t.campsite_id).filter(Boolean))]
  console.log('Used campsite IDs (skipping):', usedIds)

  // Delete all campsites NOT in usedIds
  let query = supabase.from('campsites').delete({ count: 'exact' })
  if (usedIds.length > 0) {
    query = (query as any).not('id', 'in', `(${usedIds.join(',')})`)
  }
  const { error, count } = await query
  if (error) console.error('Error:', error.message)
  else console.log(`Deleted ${count} rows`)
}

main().catch(console.error)
