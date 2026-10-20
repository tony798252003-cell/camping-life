// 重複營區／行程分群與保留建議（規格 §8 步驟 2）。純函式，不連資料庫。
import {
  distanceMeters,
  matchCampsite,
  normalizeCampsiteName,
  type MatchableCampsite,
} from '../../src/utils/campsiteMatch'

export interface CampsiteStats {
  tripCount: number
  photoCount: number
  filledFields: number
}
export type Confidence = 'high' | 'medium' | 'low'
export type CampsiteRow = MatchableCampsite & CampsiteStats
export interface DuplicateGroup {
  groupId: number
  confidence: Confidence
  members: CampsiteRow[]
  suggestedKeepId: number
  samePark: boolean
}
export interface MergeDecision {
  groupId: number
  action: 'merge' | 'not_duplicate' | 'later'
  keepId: number
  dropIds: number[]
}
export interface Decisions {
  campsites: MergeDecision[]
  trips: MergeDecision[]
}

const NEAR_M = 300
const SAME_PARK_M = 500
const CONF_RANK: Record<Confidence, number> = { low: 0, medium: 1, high: 2 }

// 不算「資料欄位」的 meta 欄位（規格 §8 步驟 4 的不補值清單，另加 id）
const META_FIELDS = new Set([
  'id', 'created_at', 'created_by', 'updated_at', 'is_verified', 'merged_into_id', 'google_place_id', 'field_sources',
])

export function countFilledFields(row: Record<string, unknown>): number {
  let n = 0
  for (const [k, v] of Object.entries(row)) {
    if (META_FIELDS.has(k) || v == null) continue
    if (typeof v === 'string' && v.trim() === '') continue
    if (Array.isArray(v) && v.length === 0) continue
    if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) continue
    n++
  }
  return n
}

const hasCoord = (c: MatchableCampsite) => c.latitude != null && c.longitude != null

export function pickKeeper(
  members: Array<MatchableCampsite & CampsiteStats & { created_at?: string }>,
): number {
  const sorted = [...members].sort(
    (a, b) =>
      b.tripCount - a.tripCount ||
      Number(b.photoCount > 0) - Number(a.photoCount > 0) ||
      Number(hasCoord(b)) - Number(hasCoord(a)) ||
      b.filledFields - a.filledFields ||
      a.id - b.id,
  )
  return sorted[0]!.id
}

export function nameStem(name: string): string {
  const s = name
    .replace(/[(（][^)）]*[)）]/g, '')
    .trim()
    .replace(/[A-Za-z0-9一二三四五六七八九十]+區$/, '')
  return normalizeCampsiteName(s)
}

function normPhone(p: string | null | undefined): string {
  return (p ?? '').replace(/[-\s　]/g, '')
}

// 一對營區之間的關聯強度；null = 不相關
function pairConfidence(a: MatchableCampsite, b: MatchableCampsite): Confidence | null {
  let best: Confidence | null = null
  const bump = (c: Confidence) => {
    if (best == null || CONF_RANK[c] > CONF_RANK[best]) best = c
  }
  const hit = matchCampsite(a, [b])[0]
  if (hit) {
    if (hit.level === 'same_place') bump('high')
    else if (hit.level === 'likely') bump(hit.distanceM != null && hit.distanceM < NEAR_M ? 'high' : 'medium')
    else bump('low') // nearby：300 m 內但名稱不像，只列不建議
  }
  const pa = normPhone(a.phone)
  if (pa !== '' && pa === normPhone(b.phone)) bump('low')
  const na = normalizeCampsiteName(a.name)
  if (na !== '' && na === normalizeCampsiteName(b.name) && a.district != null && a.district === b.district) {
    bump('low') // 同名同鄉鎮不論距離；距離 ≤ 2 km 者上面已升級
  }
  return best
}

function isSamePark(members: CampsiteRow[]): boolean {
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const a = members[i]!
      const b = members[j]!
      const stem = nameStem(a.name)
      if (stem === '' || stem !== nameStem(b.name)) continue
      if (normalizeCampsiteName(a.name) === normalizeCampsiteName(b.name)) continue
      if (
        hasCoord(a) && hasCoord(b) &&
        distanceMeters(
          { latitude: a.latitude!, longitude: a.longitude! },
          { latitude: b.latitude!, longitude: b.longitude! },
        ) < SAME_PARK_M
      ) return true
    }
  }
  return false
}

export function groupDuplicates(all: CampsiteRow[]): DuplicateGroup[] {
  const rows = all.filter(c => c.merged_into_id == null).sort((a, b) => a.id - b.id)
  const parent = rows.map((_, i) => i)
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)))
  const edges: Array<[number, number, Confidence]> = []

  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const c = pairConfidence(rows[i]!, rows[j]!)
      if (c) {
        edges.push([i, j, c])
        parent[find(i)] = find(j)
      }
    }
  }

  const byRoot = new Map<number, number[]>()
  rows.forEach((_, i) => {
    const r = find(i)
    byRoot.set(r, [...(byRoot.get(r) ?? []), i])
  })
  const groups: DuplicateGroup[] = []
  for (const idxs of byRoot.values()) {
    if (idxs.length < 2) continue
    const set = new Set(idxs)
    let confidence: Confidence = 'low'
    for (const [i, j, c] of edges) {
      if (set.has(i) && set.has(j) && CONF_RANK[c] > CONF_RANK[confidence]) confidence = c
    }
    const members = idxs.map(i => rows[i]!)
    groups.push({ groupId: 0, confidence, members, suggestedKeepId: pickKeeper(members), samePark: isSamePark(members) })
  }
  groups.sort((a, b) => a.members[0]!.id - b.members[0]!.id)
  groups.forEach((g, i) => (g.groupId = i + 1))
  return groups
}

// ---- 重複行程（規格 §8 步驟 2）：trip_date 相同，且 campsite_id 或正規化營區名稱相同 ----
export interface TripRow {
  id: number
  trip_date: string
  campsite_id: number | null
  campsite_name: string | null
  user_id?: string | null
  merged_into_id?: number | null
  photoCount: number
  filledFields: number
}
export interface TripDuplicateGroup {
  groupId: number
  members: TripRow[]
  suggestedKeepId: number
}

export function pickTripKeeper(members: TripRow[]): number {
  return [...members].sort(
    (a, b) =>
      Number(b.photoCount > 0) - Number(a.photoCount > 0) ||
      b.filledFields - a.filledFields ||
      a.id - b.id,
  )[0]!.id
}

export function groupDuplicateTrips(all: TripRow[]): TripDuplicateGroup[] {
  const rows = all.filter(t => t.merged_into_id == null).sort((a, b) => a.id - b.id)
  const parent = rows.map((_, i) => i)
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)))
  const nameOf = (t: TripRow) => normalizeCampsiteName(t.campsite_name ?? '')
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i]!
      const b = rows[j]!
      if (a.trip_date !== b.trip_date) continue
      const sameId = a.campsite_id != null && a.campsite_id === b.campsite_id
      const sameName = nameOf(a) !== '' && nameOf(a) === nameOf(b)
      if (sameId || sameName) parent[find(i)] = find(j)
    }
  }
  const byRoot = new Map<number, TripRow[]>()
  rows.forEach((t, i) => {
    const r = find(i)
    byRoot.set(r, [...(byRoot.get(r) ?? []), t])
  })
  const groups: TripDuplicateGroup[] = []
  for (const members of byRoot.values()) {
    if (members.length < 2) continue
    groups.push({ groupId: 0, members, suggestedKeepId: pickTripKeeper(members) })
  }
  groups.sort((a, b) => a.members[0]!.id - b.members[0]!.id)
  groups.forEach((g, i) => (g.groupId = i + 1))
  return groups
}
