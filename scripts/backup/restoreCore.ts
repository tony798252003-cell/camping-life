export type Row = Record<string, unknown> & { id: unknown }

/** 父表在前；還原時依此順序逐表處理 */
export const RESTORE_ORDER = [
  'campsites',
  'camping_trips',
  'trip_photos',
  'camping_gear',
  'profiles',
  'system_assets',
  'calendar_events',
  'cpbl_schedule',
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
