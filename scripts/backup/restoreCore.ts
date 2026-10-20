export type Row = Record<string, unknown> & { id: unknown }

/** 父表在前；還原時依此順序逐表處理 */
export const RESTORE_ORDER = [
  'campsites',
  'camping_trips',
  'trip_photos',
  'camping_gear',
  'profiles',
  'system_assets',
  'event_categories',
  'cpbl_schedule',
  'calendar_events',
  'families',
]

// 遞迴排序物件鍵，讓 jsonb 鍵順序不同的值序列化後相同
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    return `{${Object.keys(o).sort().map(k => `${JSON.stringify(k)}:${canonical(o[k])}`).join(',')}}`
  }
  return JSON.stringify(v) ?? 'undefined'
}

/** 以 id 對齊。線上有、備份沒有的列（備份後新增）不列入。 */
export function diffRows(backup: Row[], live: Row[]): { changed: Row[]; missing: Row[] } {
  const liveById = new Map(live.map(r => [String(r.id), r]))
  const changed: Row[] = []
  const missing: Row[] = []
  for (const b of backup) {
    const l = liveById.get(String(b.id))
    if (!l) missing.push(b)
    else if (canonical(b) !== canonical(l)) changed.push(b)
  }
  return { changed, missing }
}

export function sqlLiteral(v: unknown): string {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  const esc = (s: string) => s.replace(/'/g, "''")
  if (typeof v === 'object') return `'${esc(JSON.stringify(v))}'::jsonb`
  return `'${esc(String(v))}'`
}

/** 產生可貼進 Supabase SQL Editor 的 INSERT（用於 id 為 GENERATED ALWAYS 的表） */
export function buildInsertSql(table: string, rows: Row[]): string {
  const cols: string[] = []
  for (const r of rows) for (const k of Object.keys(r)) if (!cols.includes(k)) cols.push(k)
  const values = rows.map(r => `(${cols.map(c => sqlLiteral(r[c])).join(', ')})`).join(',\n')
  return `INSERT INTO public.${table} (${cols.map(c => `"${c}"`).join(', ')}) OVERRIDING SYSTEM VALUE VALUES\n${values};`
}
