/**
 * 比對（預設 dry-run）或還原備份
 *
 * 使用方式:
 *   npx tsx scripts/backup/restore.ts <備份目錄> --tables a,b,c [--apply]
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { buildInsertSql, diffRows, RESTORE_ORDER, type Row } from './restoreCore'

dotenv.config({ path: '.env' })
dotenv.config({ path: '.env.local' })

const PAGE = 1000
const BATCH = 500

const args = process.argv.slice(2)
const dirArg = args.find(a => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--tables')
const tIdx = args.indexOf('--tables')
const apply = args.includes('--apply')

if (!dirArg || tIdx === -1 || !args[tIdx + 1]) {
  console.error('用法：restore.ts <備份目錄> --tables a,b,c [--apply]')
  process.exit(2)
}
const wanted = args[tIdx + 1].split(',').map(s => s.trim()).filter(Boolean)
const unknown = wanted.filter(t => !RESTORE_ORDER.includes(t))
if (unknown.length) {
  console.error(`未知的表：${unknown.join(', ')}`)
  process.exit(2)
}
const tables = RESTORE_ORDER.filter(t => wanted.includes(t))
const dir = path.resolve(dirArg)

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('缺少 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY（.env.local）')
  process.exit(1)
}
const supabase = createClient(url, key)

async function fetchAll(table: string): Promise<Row[]> {
  const rows: Row[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select('*').order('id').range(from, from + PAGE - 1)
    if (error) throw new Error(`${table}: ${error.message}`)
    rows.push(...(data as Row[]))
    if (data.length < PAGE) break
  }
  return rows
}

const ids = (rows: Row[]) => rows.slice(0, 20).map(r => String(r.id)).join(', ')

async function main() {
  let remaining = 0
  const sqlFile = new Map<string, string>()
  for (const table of tables) {
    const backup: Row[] = JSON.parse(fs.readFileSync(path.join(dir, `${table}.json`), 'utf8'))
    const { changed, missing } = diffRows(backup, await fetchAll(table))
    console.log(`[${table}] changed ${changed.length}${changed.length ? `（${ids(changed)}）` : ''}, missing ${missing.length}${missing.length ? `（${ids(missing)}）` : ''}`)

    if (apply && (changed.length || missing.length)) {
      // changed：逐筆 update（不帶 id，id 為 identity 欄位時也能運作）
      for (let i = 0; i < changed.length; i++) {
        const { id, ...rest } = changed[i]
        const { error } = await supabase.from(table).update(rest).eq('id', id as string | number)
        if (error) throw new Error(`${table} update id=${String(id)}: ${error.message}`)
        if ((i + 1) % 50 === 0 || i + 1 === changed.length) console.log(`[${table}] update ${i + 1}/${changed.length}`)
      }
      // missing：批次 upsert；遇 identity 欄位錯誤（428C9）改產生 SQL 檔
      for (let i = 0; i < missing.length && !sqlFile.has(table); i += BATCH) {
        const { error } = await supabase.from(table).upsert(missing.slice(i, i + BATCH), { onConflict: 'id' })
        if (error) {
          if (error.code === '428C9' || /GENERATED ALWAYS/i.test(error.message)) {
            const rows = missing.slice(i) // 之前的批次已寫入
            const file = path.join(dir, `restore-${table}-missing.sql`)
            fs.writeFileSync(file, buildInsertSql(table, rows) + '\n')
            sqlFile.set(table, file)
            console.error(`[${table}] id 是 GENERATED ALWAYS，無法由 API 寫回 ${rows.length} 筆遺失列。`)
            console.error(`  已產生 ${file}`)
            console.error('  請把檔案內容貼到 Supabase SQL Editor 執行，再重跑 dry-run 確認差異為 0。')
          } else throw new Error(`${table} upsert: ${error.message}`)
        }
      }
      const after = diffRows(backup, await fetchAll(table))
      const n = after.changed.length + after.missing.length
      console.log(`[${table}] 還原後差異：${n}`)
      remaining += n
    }
  }
  if (!apply) console.log('dry-run：未寫入任何資料。加 --apply 才會還原。')
  else if (sqlFile.size > 0) process.exit(3)
  else if (remaining > 0) process.exit(1)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
