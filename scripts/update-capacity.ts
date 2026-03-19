/**
 * 解析 Excel 的帳數欄位並更新到 DB
 * 格式: N(M) = N帳×M區, N 單獨 = N帳×1區, + 分隔加總
 * 例: 2(2)+3+4 → [{tents:2,count:2},{tents:3,count:1},{tents:4,count:1}] 共 7帳
 *    6(5) → [{tents:6,count:5}] 共 30帳
 *
 * 使用方式:
 *   npx tsx scripts/update-capacity.ts [--dry-run]
 */

import XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import type { CapacityZone } from '../src/types/database'

dotenv.config({ path: '.env' })
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const isDryRun = process.argv.includes('--dry-run')

type ZoneType = CapacityZone['type']

// 解析單一欄位的帳數字串，展開成 CapacityZone 陣列
function parseZones(cell: any, type: ZoneType): CapacityZone[] {
  if (!cell && cell !== 0) return []
  const str = String(cell).trim()
  if (!str) return []

  const zones: CapacityZone[] = []
  const parts = str.split('+')

  for (const part of parts) {
    const trimmed = part.trim()
    // 匹配 N(M) 格式：N帳 × M區
    const match = trimmed.match(/^(\d+(?:\.\d+)?)\((\d+(?:\.\d+)?)\)/)
    if (match) {
      const tents = Math.round(parseFloat(match[1]))
      const count = Math.round(parseFloat(match[2]))
      for (let i = 0; i < count; i++) {
        zones.push({ name: '', type, tents })
      }
    } else {
      const n = parseFloat(trimmed)
      if (!isNaN(n) && n > 0) {
        zones.push({ name: '', type, tents: Math.round(n) })
      }
    }
  }
  return zones
}

async function main() {
  console.log(`模式: ${isDryRun ? 'Dry Run（不寫入）' : '寫入資料庫'}`)

  const workbook = XLSX.readFile('/Users/tonywang/Downloads/campsites.xlsx')
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 })

  // 欄位: B=名稱(1), H=草地(7), I=碎石(8), J=雨棚(9), K=棧板(10)
  const dataRows = rows.slice(1).filter((r: any[]) => r[1])

  console.log(`Excel 共 ${dataRows.length} 筆`)

  // DB 撈 name → id
  const { data: campsites } = await supabase.from('campsites').select('id, name')
  const nameToId: Record<string, number> = {}
  for (const c of campsites ?? []) nameToId[c.name.trim()] = c.id

  let matched = 0, notFound = 0, updated = 0

  for (const row of dataRows) {
    const name = String(row[1] ?? '').trim()
    if (!name) continue

    const zones: CapacityZone[] = [
      ...parseZones(row[7], '草地'),
      ...parseZones(row[8], '碎石'),
      ...parseZones(row[9], '雨棚'),
      ...parseZones(row[10], '棧板'),
    ]
    const total = zones.reduce((sum, z) => sum + z.tents, 0)

    const id = nameToId[name]
    if (!id) {
      notFound++
      if (isDryRun) console.log(`  ❌ 找不到: ${name}`)
      continue
    }

    matched++
    const summary = zones.length
      ? zones.map(z => `${z.type}${z.tents}帳`).join(' / ')
      : '無資料'
    console.log(`  ✅ ${name} → 共${total}帳 [${summary}]`)

    if (!isDryRun) {
      const { error } = await supabase
        .from('campsites')
        .update({ total_capacity: total || null, capacity_zones: zones } as any)
        .eq('id', id)
      if (error) console.error(`    寫入失敗: ${error.message}`)
      else updated++
    }
  }

  console.log(`\n完成：配對 ${matched} 筆，找不到 ${notFound} 筆，寫入 ${updated} 筆`)
}

main().catch(console.error)
