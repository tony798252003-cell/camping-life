/**
 * 備份所有表到 <out>/<YYYYMMDD-HHmm>/<table>.json，並自我驗證
 *
 * 使用方式:
 *   npx tsx scripts/backup/backup-all.ts [--out ~/camping-life-backups]
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { RESTORE_ORDER } from './restoreCore'

dotenv.config({ path: '.env' })
dotenv.config({ path: '.env.local' })

const PAGE = 1000
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

const outIdx = process.argv.indexOf('--out')
const outArg = outIdx !== -1 ? process.argv[outIdx + 1] : '~/camping-life-backups'
const outBase = path.resolve(outArg.replace(/^~(?=$|\/)/, os.homedir()))

const rel = path.relative(repoRoot, outBase)
if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) {
  console.error(`拒絕執行：輸出路徑 ${outBase} 位於 repo 內（備份含個資，不可放進 repo）`)
  process.exit(2)
}

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('缺少 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY（.env.local）')
  process.exit(1)
}
const supabase = createClient(url, key)

const pad = (n: number) => String(n).padStart(2, '0')
const d = new Date()
const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
const dir = path.join(outBase, stamp)

async function fetchAll(table: string): Promise<unknown[]> {
  const rows: unknown[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select('*').order('id').range(from, from + PAGE - 1)
    if (error) throw new Error(`${table}: ${error.message}`)
    rows.push(...data)
    if (data.length < PAGE) break
  }
  return rows
}

async function liveCount(table: string): Promise<number> {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
  if (error) throw new Error(`${table}: ${error.message}`)
  return count ?? 0
}

async function main() {
  fs.mkdirSync(dir, { recursive: true })
  fs.chmodSync(outBase, 0o700)
  fs.chmodSync(dir, 0o700)

  const counts: Record<string, number> = {}
  for (const table of RESTORE_ORDER) {
    const rows = await fetchAll(table)
    fs.writeFileSync(path.join(dir, `${table}.json`), JSON.stringify(rows, null, 2), { mode: 0o600 })
    counts[table] = rows.length
    console.log(`${table}: ${rows.length}`)
  }
  fs.writeFileSync(path.join(dir, 'counts.json'), JSON.stringify(counts, null, 2), { mode: 0o600 })

  // 自我驗證：重新讀回、parse、筆數對線上
  let ok = true
  for (const table of RESTORE_ORDER) {
    try {
      const parsed = JSON.parse(fs.readFileSync(path.join(dir, `${table}.json`), 'utf8'))
      const live = await liveCount(table)
      if (!Array.isArray(parsed) || parsed.length !== live) {
        ok = false
        console.error(`不符：${table} 檔案 ${Array.isArray(parsed) ? parsed.length : '非陣列'} 筆，線上 ${live} 筆`)
      }
    } catch (e) {
      ok = false
      console.error(`不符：${table} 讀回失敗 ${(e as Error).message}`)
    }
  }
  if (!ok) process.exit(1)
  console.log(`備份完成並驗證通過：${dir}`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
