/**
 * 依 decisions.json 合併重複營區／行程（預設 dry-run，規格 §8 步驟 4、5）
 *
 * 使用方式:
 *   npx tsx scripts/dedupe/apply.ts <decisions.json>
 *   npx tsx scripts/dedupe/apply.ts <decisions.json> --apply --backup <備份目錄>
 *
 * --apply 由使用者本人執行；不刪除任何列，只改外鍵、補空欄位、設 merged_into_id。
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fillEmptyFields, type Decisions, type FieldFill, type MergeDecision } from './plan'

dotenv.config({ path: '.env' })
dotenv.config({ path: '.env.local' })

const PAGE = 1000

// 參照 campsites.id 的外鍵（Task 1.1 由 pg_constraint 查出）：[表, 欄位]
const CAMPSITE_FKS: Array<[string, string]> = [['camping_trips', 'campsite_id']]
// 參照 camping_trips.id 的外鍵（Task 1.1）
const TRIP_FKS: Array<[string, string]> = [['trip_photos', 'trip_id']]
// 補值時不碰的欄位（規格 §8 步驟 4）
const FILL_EXCLUDED: ReadonlySet<string> = new Set([
  'id', 'created_at', 'created_by', 'updated_at', 'is_verified', 'merged_into_id', 'google_place_id', 'field_sources',
])
// 合併會動到的表（還原指令與結尾驗證筆數用）
const TABLES = ['campsites', 'camping_trips', 'trip_photos']

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const bIdx = args.indexOf('--backup')
const backupArg = bIdx !== -1 ? args[bIdx + 1] : undefined
const decisionsArg = args.find((a, i) => !a.startsWith('--') && (bIdx === -1 || i !== bIdx + 1))

if (!decisionsArg) {
  console.error('用法：apply.ts <decisions.json> [--apply --backup <備份目錄>]')
  process.exit(2)
}
if (apply && (!backupArg || backupArg.startsWith('--') || !fs.existsSync(backupArg) || !fs.statSync(backupArg).isDirectory())) {
  console.error('--apply 必須同時給 --backup <存在的備份目錄>，已拒絕執行')
  process.exit(2)
}

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('缺少 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY（.env.local）')
  process.exit(1)
}
const supabase = createClient(url, key)

type Row = Record<string, unknown>

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

async function countRows(table: string): Promise<number> {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
  if (error) throw new Error(`${table} count: ${error.message}`)
  return count ?? 0
}

const restoreCmd = () =>
  `npx tsx scripts/backup/restore.ts ${backupArg ?? '<備份目錄>'} --tables ${TABLES.join(',')} --apply`

function validate(kind: string, list: MergeDecision[], rows: Map<number, Row>): MergeDecision[] {
  const merges = list.filter(d => d.action === 'merge')
  const seen = new Set<number>()
  for (const d of merges) {
    const ids = [d.keepId, ...d.dropIds]
    if (d.dropIds.length === 0) throw new Error(`${kind} 群 ${d.groupId}：dropIds 是空的`)
    if (d.dropIds.includes(d.keepId)) throw new Error(`${kind} 群 ${d.groupId}：keepId 不能同時是 dropId`)
    for (const id of ids) {
      const r = rows.get(id)
      if (!r) throw new Error(`${kind} 群 ${d.groupId}：id ${id} 不存在`)
      if (r.merged_into_id != null) throw new Error(`${kind} 群 ${d.groupId}：id ${id} 已被合併過`)
      if (seen.has(id)) throw new Error(`${kind} 群 ${d.groupId}：id ${id} 出現在多個群組`)
      seen.add(id)
    }
  }
  return merges
}

const fmtFill = (f: Record<string, FieldFill>) =>
  Object.entries(f).map(([k, v]) => `${k}=${JSON.stringify(v.value)}（來自 #${String(v.fromId)}）`)

async function main() {
  const decisions: Decisions = JSON.parse(fs.readFileSync(path.resolve(decisionsArg!), 'utf8'))
  const [campsites, trips] = await Promise.all([fetchAll('campsites'), fetchAll('camping_trips')])
  const campsiteById = new Map(campsites.map(r => [r.id as number, r]))
  const tripById = new Map(trips.map(r => [r.id as number, r]))
  const campsiteMerges = validate('營區', decisions.campsites, campsiteById)
  const tripMerges = validate('行程', decisions.trips, tripById)

  const before: Record<string, number> = {}
  for (const t of TABLES) before[t] = await countRows(t)

  // 會被改指向的外鍵列（dry-run 顯示；apply 也沿用同一份計算）
  async function referencing(fks: Array<[string, string]>, dropIds: number[]) {
    const out: Array<{ table: string; column: string; ids: unknown[] }> = []
    for (const [table, column] of fks) {
      const { data, error } = await supabase.from(table).select('id').in(column, dropIds)
      if (error) throw new Error(`${table}.${column}: ${error.message}`)
      out.push({ table, column, ids: (data ?? []).map(r => (r as Row).id) })
    }
    return out
  }

  console.log(`模式：${apply ? 'APPLY（會寫入）' : 'dry-run（不寫入）'}；營區群 ${campsiteMerges.length}、行程群 ${tripMerges.length}`)
  if (apply) console.log(`\n萬一失敗，用這個指令還原：\n  ${restoreCmd()}\n`)

  const done: string[] = []
  try {
    for (const [kind, merges, byId, fks, fillable] of [
      ['營區', campsiteMerges, campsiteById, CAMPSITE_FKS, true],
      ['行程', tripMerges, tripById, TRIP_FKS, false],
    ] as const) {
      const parent = kind === '營區' ? 'campsites' : 'camping_trips'
      for (const d of merges) {
        const label = `${kind}群 ${d.groupId}（保留 #${d.keepId}，合併 ${d.dropIds.map(i => '#' + i).join(', ')}）`
        console.log(`\n== ${label}`)
        const refs = await referencing(fks, d.dropIds)
        for (const r of refs) {
          console.log(`  ${r.table}.${r.column}：${r.ids.length} 筆改指向 #${d.keepId}${r.ids.length ? `（id ${r.ids.join(', ')}）` : ''}`)
        }
        const fill = fillable
          ? fillEmptyFields(byId.get(d.keepId)!, d.dropIds.map(i => byId.get(i)!), FILL_EXCLUDED)
          : {}
        if (fillable) console.log(`  補值：${Object.keys(fill).length ? fmtFill(fill).join('；') : '無'}`)
        console.log(`  ${parent}：${d.dropIds.map(i => '#' + i).join(', ')} 設 merged_into_id = ${d.keepId}`)

        if (!apply) continue
        for (const [table, column] of fks) {
          const { error } = await supabase.from(table).update({ [column]: d.keepId }).in(column, d.dropIds)
          if (error) throw new Error(`${label} ${table}.${column}: ${error.message}`)
        }
        if (Object.keys(fill).length) {
          const patch = Object.fromEntries(Object.entries(fill).map(([k, v]) => [k, v.value]))
          const { error } = await supabase.from(parent).update(patch).eq('id', d.keepId)
          if (error) throw new Error(`${label} 補值: ${error.message}`)
        }
        const { error } = await supabase.from(parent).update({ merged_into_id: d.keepId }).in('id', d.dropIds)
        if (error) throw new Error(`${label} merged_into_id: ${error.message}`)
        done.push(label)
      }
    }
  } catch (e) {
    console.error(`\n失敗，已停止：${(e as Error).message}`)
    console.error(`已完成的群組：${done.length ? '\n  ' + done.join('\n  ') : '（無）'}`)
    console.error(`還原指令：\n  ${restoreCmd()}`)
    process.exit(1)
  }

  if (!apply) {
    console.log('\ndry-run 結束，未寫入任何資料。')
    return
  }

  // 結尾驗證（規格 §8 步驟 5）
  const problems: string[] = []
  for (const t of TABLES) {
    const after = await countRows(t)
    if (after !== before[t]) problems.push(`${t} 筆數改變：${before[t]} → ${after}`)
  }
  const [tripsAfter, campsitesAfter, photosAfter] = await Promise.all([
    fetchAll('camping_trips'), fetchAll('campsites'), fetchAll('trip_photos'),
  ])
  const merged = new Set(campsitesAfter.filter(c => c.merged_into_id != null).map(c => c.id))
  const bad = tripsAfter.filter(t => t.campsite_id != null && merged.has(t.campsite_id))
  if (bad.length) problems.push(`${bad.length} 筆行程仍指向已合併營區（id ${bad.map(t => t.id).join(', ')}）`)
  const mergedTrips = new Set(tripsAfter.filter(t => t.merged_into_id != null).map(t => t.id))
  const badPhotos = photosAfter.filter(p => mergedTrips.has(p.trip_id))
  if (badPhotos.length) problems.push(`trip_photos 指向已合併行程 = ${badPhotos.length}（應為 0）`)

  if (problems.length) {
    console.error(`\n驗證失敗：\n  ${problems.join('\n  ')}\n還原指令：\n  ${restoreCmd()}`)
    process.exit(1)
  }
  console.log('\n驗證通過：各表筆數不變、沒有行程指向已合併營區、trip_photos 指向已合併行程 = 0、照片總數不變。')
}

main().catch(e => {
  console.error(`\n失敗：${(e as Error).message}\n還原指令（若已有寫入）：\n  ${restoreCmd()}`)
  process.exit(1)
})
