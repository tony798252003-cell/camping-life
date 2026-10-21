/**
 * 重複營區／行程報告（唯讀，只做 select）
 *
 * 使用方式:
 *   npx tsx scripts/dedupe/report.ts --out <dir>
 * 產出 <dir>/report.html（手機可讀）與 <dir>/decisions.json（每群預設 later）
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as fs from 'node:fs'
import * as path from 'node:path'
import {
  countFilledFields, findNearbyPairs, groupDuplicates, groupDuplicateTrips,
  type CampsiteRow, type Decisions, type DuplicateGroup, type TripDuplicateGroup, type TripRow,
} from './plan'

dotenv.config({ path: '.env' })
dotenv.config({ path: '.env.local' })

const PAGE = 1000
// M0 停止 TripModal 自動建營區的日期；早於此且未審核者視為舊版自動建立
const AUTO_CREATED_CUTOFF = '2026-10-18T00:00:00+08:00'

const outIdx = process.argv.indexOf('--out')
const outArg = outIdx !== -1 ? process.argv[outIdx + 1] : undefined
if (!outArg || outArg.startsWith('--')) {
  console.error('用法：report.ts --out <目錄>')
  process.exit(2)
}
const outDir = path.resolve(outArg)

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

const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const show = (v: unknown) =>
  v == null || v === '' ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)

function table(rowsData: Row[], suggestedKeepId: number, hideFields: Set<string>): string {
  const fields = Object.keys(rowsData[0] ?? {}).filter(f => !hideFields.has(f))
  const differs = (f: string) => new Set(rowsData.map(r => JSON.stringify(r[f] ?? null))).size > 1
  const head = rowsData
    .map(r => `<th class="${r.id === suggestedKeepId ? 'keep' : ''}">#${esc(r.id)}${r.id === suggestedKeepId ? ' 建議保留' : ''}</th>`)
    .join('')
  const body = fields
    .map(f => {
      const diff = differs(f)
      return `<tr class="${diff ? 'diff' : ''}"><td class="f">${esc(f)}${diff ? ' ●' : ''}</td>${rowsData
        .map(r => `<td>${esc(show(r[f]))}</td>`)
        .join('')}</tr>`
    })
    .join('')
  return `<div class="scroll"><table><thead><tr><th></th>${head}</tr></thead><tbody>${body}</tbody></table></div>`
}

function campsiteCard(g: DuplicateGroup, raw: Map<number, Row>): string {
  const rows = g.members.map(m => ({ ...raw.get(m.id)!, tripCount: m.tripCount, photoCount: m.photoCount, filledFields: m.filledFields }))
  return `<section class="card ${g.confidence}">
  <h3>群 ${g.groupId} <span class="badge ${g.confidence}">${g.confidence}</span>${g.samePark ? ' <span class="warn">可能是同園區不同營區，建議不合併</span>' : ''}</h3>
  <p>建議保留 #${g.suggestedKeepId}；其餘 ${g.members.filter(m => m.id !== g.suggestedKeepId).map(m => '#' + m.id).join('、')}</p>
  ${table(rows, g.suggestedKeepId, new Set(['field_sources']))}
</section>`
}

function tripCard(g: TripDuplicateGroup, raw: Map<number, Row>): string {
  const rows = g.members.map(m => ({ ...raw.get(m.id)!, photoCount: m.photoCount, filledFields: m.filledFields }))
  return `<section class="card">
  <h3>行程群 ${g.groupId}（${esc(g.members[0]!.trip_date)}）</h3>
  <p>建議保留 #${g.suggestedKeepId}</p>
  ${table(rows, g.suggestedKeepId, new Set())}
</section>`
}

async function main() {
  const [campsitesRaw, tripsRaw, photosRaw] = await Promise.all([
    fetchAll('campsites'), fetchAll('camping_trips'), fetchAll('trip_photos'),
  ])

  const liveTrips = tripsRaw.filter(t => t.merged_into_id == null)
  const photosByTrip = new Map<number, number>()
  for (const p of photosRaw) photosByTrip.set(p.trip_id as number, (photosByTrip.get(p.trip_id as number) ?? 0) + 1)

  const tripCount = new Map<number, number>()
  const photoCount = new Map<number, number>()
  for (const t of liveTrips) {
    const cid = t.campsite_id as number | null
    if (cid == null) continue
    tripCount.set(cid, (tripCount.get(cid) ?? 0) + 1)
    photoCount.set(cid, (photoCount.get(cid) ?? 0) + (photosByTrip.get(t.id as number) ?? 0))
  }

  const campsites: CampsiteRow[] = campsitesRaw.map(c => ({
    ...(c as unknown as CampsiteRow),
    tripCount: tripCount.get(c.id as number) ?? 0,
    photoCount: photoCount.get(c.id as number) ?? 0,
    filledFields: countFilledFields(c),
  }))
  const cGroups = groupDuplicates(campsites)
  const nearbyPairs = findNearbyPairs(campsites)

  const trips: TripRow[] = tripsRaw.map(t => ({
    id: t.id as number,
    trip_date: t.trip_date as string,
    campsite_id: t.campsite_id as number | null,
    campsite_name: t.campsite_name as string | null,
    user_id: t.user_id as string | null,
    merged_into_id: t.merged_into_id as number | null,
    photoCount: photosByTrip.get(t.id as number) ?? 0,
    filledFields: countFilledFields(t),
  }))
  const tGroups = groupDuplicateTrips(trips)

  const cRaw = new Map(campsitesRaw.map(c => [c.id as number, c]))
  const tRaw = new Map(tripsRaw.map(t => [t.id as number, t]))

  // 舊版 TripModal 自動建立：未審核 且 建立時間早於 M0（不能只看 is_verified=false）
  const cutoff = Date.parse(AUTO_CREATED_CUTOFF)
  const autoCreated = campsites.filter(
    c => c.merged_into_id == null && (cRaw.get(c.id)!.is_verified === false) &&
      Date.parse(String(cRaw.get(c.id)!.created_at ?? '')) < cutoff,
  )

  const decisions: Decisions = {
    campsites: cGroups.map(g => ({
      groupId: g.groupId, action: 'later', keepId: g.suggestedKeepId,
      dropIds: g.members.map(m => m.id).filter(id => id !== g.suggestedKeepId),
    })),
    trips: tGroups.map(g => ({
      groupId: g.groupId, action: 'later', keepId: g.suggestedKeepId,
      dropIds: g.members.map(m => m.id).filter(id => id !== g.suggestedKeepId),
    })),
  }

  const autoRows = autoCreated
    .map(c => `<tr><td>#${c.id}</td><td>${esc(c.name)}</td><td>${esc(c.district)}</td><td>${c.tripCount}</td><td>${c.filledFields}</td><td>${esc(cRaw.get(c.id)!.created_at)}</td></tr>`)
    .join('')

  const nearbyRows = nearbyPairs
    .map(p => `<tr><td>#${p.a.id} ${esc(p.a.name)}</td><td>#${p.b.id} ${esc(p.b.name)}</td><td>${p.distanceM == null ? '' : Math.round(p.distanceM) + ' m'}</td></tr>`)
    .join('')

  const html = `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>重複清理報告</title>
<style>
body{font-family:system-ui,sans-serif;margin:0;padding:12px;background:#f8fafc;color:#0f172a;font-size:14px}
h1{font-size:20px}h2{font-size:17px;margin-top:28px}h3{font-size:15px;margin:0 0 6px}
.card{background:#fff;border-radius:10px;padding:12px;margin:12px 0;border-left:5px solid #94a3b8;box-shadow:0 1px 2px #0002}
.card.high{border-color:#ef4444}.card.medium{border-color:#f59e0b}.card.low{border-color:#94a3b8}
.badge{font-size:12px;padding:1px 8px;border-radius:99px;background:#e2e8f0}
.badge.high{background:#fee2e2}.badge.medium{background:#fef3c7}
.warn{color:#b45309;font-size:12px;font-weight:600}
.scroll{overflow-x:auto}table{border-collapse:collapse;font-size:12px}
th,td{border:1px solid #e2e8f0;padding:3px 6px;text-align:left;vertical-align:top;max-width:220px;word-break:break-all}
th.keep{background:#dcfce7}td.f{background:#f1f5f9;white-space:nowrap}tr.diff td{background:#fffbeb}tr.diff td.f{background:#fde68a}
</style></head><body>
<h1>重複清理報告</h1>
<p>營區重複 ${cGroups.length} 群、行程重複 ${tGroups.length} 群、舊版自動建立疑似空白營區 ${autoCreated.length} 筆。● 表示該欄位各筆不同。</p>
<h2>重複營區</h2>
${cGroups.map(g => campsiteCard(g, cRaw)).join('') || '<p>沒有</p>'}
<h2>鄰近但名稱不同（不建議合併）</h2>
<p>相距 300 m 內但名稱不像，共 ${nearbyPairs.length} 組，僅供參考，不會出現在 decisions.json。</p>
<div class="scroll"><table><thead><tr><th>營區 A</th><th>營區 B</th><th>距離</th></tr></thead><tbody>${nearbyRows || '<tr><td colspan="3">沒有</td></tr>'}</tbody></table></div>
<h2>重複行程</h2>
${tGroups.map(g => tripCard(g, tRaw)).join('') || '<p>沒有</p>'}
<h2>舊版 TripModal 自動建立的疑似空白營區（未審核，建立於 2026-10-18 前）</h2>
<div class="scroll"><table><thead><tr><th>id</th><th>名稱</th><th>鄉鎮</th><th>行程數</th><th>非空欄位</th><th>建立時間</th></tr></thead><tbody>${autoRows}</tbody></table></div>
</body></html>`

  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, 'report.html'), html)
  fs.writeFileSync(path.join(outDir, 'decisions.json'), JSON.stringify(decisions, null, 2))
  console.log(`營區 ${campsites.length} 筆 → ${cGroups.length} 群；行程 ${trips.length} 筆 → ${tGroups.length} 群；自動建立疑似 ${autoCreated.length} 筆`)
  console.log(`已輸出：${path.join(outDir, 'report.html')}、${path.join(outDir, 'decisions.json')}`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
