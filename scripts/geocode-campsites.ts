/**
 * 批次為缺少 GPS 座標的營地補上經緯度
 * 使用 Google Maps Places API (server-side, 無 referrer 限制)
 *
 * 使用方式:
 *   npx tsx scripts/geocode-campsites.ts
 *
 * 選項:
 *   --dry-run   只印出結果，不寫入資料庫
 *   --limit N   最多處理 N 筆
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env' })
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const GOOGLE_API_KEY = (process.env.GOOGLE_PLACES_SERVER_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY)!
const isDryRun = process.argv.includes('--dry-run')
const limitArg = process.argv.indexOf('--limit')
const limit = limitArg !== -1 ? parseInt(process.argv[limitArg + 1]) : Infinity

async function findPlace(name: string): Promise<{ lat: number; lng: number } | null> {
  const query = encodeURIComponent(`${name} 台灣露營`)
  const fields = 'geometry'
  const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${query}&inputtype=textquery&fields=${fields}&locationbias=circle%3A500000%4023.5%2C121&key=${GOOGLE_API_KEY}`

  const res = await fetch(url)
  const data = await res.json() as any

  if (data.status === 'OK' && data.candidates?.length > 0) {
    const loc = data.candidates[0].geometry.location
    return { lat: loc.lat, lng: loc.lng }
  }
  return null
}

async function main() {
  console.log(`模式: ${isDryRun ? 'Dry Run（不寫入）' : '寫入資料庫'}`)

  // 找出缺座標的營地
  const { data: nullCoords } = await supabase.from('campsites').select('id, name').is('latitude', null)
  const { data: zeroCoords } = await supabase.from('campsites').select('id, name').eq('latitude', 0)
  const targets = [...(nullCoords ?? []), ...(zeroCoords ?? [])]
    .filter((v, i, a) => a.findIndex(t => t.id === v.id) === i)
    .slice(0, limit)

  console.log(`找到 ${targets.length} 筆需要更新`)

  let success = 0
  let failed = 0

  for (const [i, site] of targets.entries()) {
    process.stdout.write(`[${i + 1}/${targets.length}] ${site.name} ... `)

    const coords = await findPlace(site.name)
    if (!coords) {
      console.log(`❌ 找不到`)
      failed++
    } else {
      console.log(`✅ (${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)})`)
      if (!isDryRun) {
        const { error } = await supabase
          .from('campsites')
          .update({ latitude: coords.lat, longitude: coords.lng })
          .eq('id', site.id)
        if (error) console.error(`   寫入失敗: ${error.message}`)
      }
      success++
    }

    // 避免打爆 rate limit（每秒最多 10 QPS）
    await new Promise(r => setTimeout(r, 150))
  }

  console.log(`\n完成：成功 ${success} 筆，失敗 ${failed} 筆`)
}

main().catch(console.error)
