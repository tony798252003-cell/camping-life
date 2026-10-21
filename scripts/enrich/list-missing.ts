/**
 * 列出還缺資料的營區，給 Claude Code 上網補（流程見 scripts/enrich/README.md）。唯讀。
 *
 * 使用方式:
 *   npx tsx scripts/enrich/list-missing.ts [--limit 20] [--city 苗栗縣] [--visited] [--json]
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { ENRICHABLE_FIELDS, selectMissing, type CampsiteRow } from './missing'

dotenv.config({ path: '.env' })
dotenv.config({ path: '.env.local' })

const args = process.argv.slice(2)
const val = (name: string) => {
  const i = args.indexOf(name)
  return i === -1 ? undefined : args[i + 1]
}
const limit = Number(val('--limit') ?? 20)
if (!Number.isInteger(limit) || limit < 1) {
  console.error('用法：list-missing.ts [--limit N] [--city 縣市] [--visited] [--json]')
  process.exit(2)
}
const city = val('--city')
const visited = args.includes('--visited')
const asJson = args.includes('--json')

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('缺少 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY（.env.local）')
  process.exit(2)
}
const supabase = createClient(url, key)
const PAGE = 1000

async function fetchAll<T>(table: string, columns: string, filter?: (q: any) => any): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    let q: any = supabase.from(table).select(columns).order('id').range(from, from + PAGE - 1)
    if (filter) q = filter(q)
    const { data, error } = await q
    if (error) throw new Error(`${table}: ${error.message}`)
    out.push(...(data as T[]))
    if (data.length < PAGE) return out
  }
}

const campsites = await fetchAll<CampsiteRow>(
  'campsites',
  ['id', 'name', 'city', 'district', 'google_maps_url', 'created_at', 'merged_into_id', 'field_sources', ...ENRICHABLE_FIELDS].join(','),
  (q) => q.is('merged_into_id', null),
)
const trips = await fetchAll<{ id: number; campsite_id: number | null }>('camping_trips', 'id,campsite_id')
const counts = new Map<number, number>()
for (const t of trips) if (t.campsite_id !== null) counts.set(t.campsite_id, (counts.get(t.campsite_id) ?? 0) + 1)

const items = selectMissing(campsites, counts, { limit, city, visited })

if (asJson) {
  console.log(JSON.stringify(items, null, 2))
} else {
  for (const i of items) {
    console.log(`#${i.id} ${i.name}（${[i.city, i.district].filter(Boolean).join(' ')}）去過 ${i.tripCount} 次`)
    console.log(`  地圖：${i.google_maps_url ?? '-'}`)
    console.log(`  缺：${i.missing.join(', ')}`)
    console.log(`  field_sources：${i.fieldSourceKeys.join(', ') || '-'}`)
  }
  console.error(`共 ${items.length} 間`)
}
