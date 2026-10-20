// 營區比對（規格 §6.5）。會被 api/ import，必須是純 TS。

export interface MatchableCampsite {
  id: number
  name: string
  district: string | null
  latitude: number | null
  longitude: number | null
  google_place_id?: string | null
  phone?: string | null
  merged_into_id?: number | null
}
export type MatchLevel = 'same_place' | 'likely' | 'nearby'
export interface CampsiteMatch {
  campsite: MatchableCampsite
  level: MatchLevel
  distanceM: number | null
}

const GENERIC_WORDS = [
  '露營區', '露營場', '露營', '營地', '營區', '營場', '農場', '休閒', '園區', '山莊', '莊園', 'camping', 'camp',
].sort((a, b) => b.length - a.length)

const NEAR_M = 300
const SAME_NAME_MAX_M = 2000

export function normalizeCampsiteName(name: string): string {
  let s = name
    .replace(/[\s　]+/g, '')
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/台/g, '臺')
    .replace(/[(（][^)）]*[)）]/g, '')
  for (const w of GENERIC_WORDS) s = s.replace(new RegExp(w, 'gi'), '')
  return s.toLowerCase()
}

export function bracketContent(name: string): string | null {
  const m = name.match(/[(（]([^)）]*)[)）]/)
  return m ? (m[1] ?? null) : null
}

export function editDistance(a: string, b: string): number {
  const x = [...a]
  const y = [...b]
  let prev = Array.from({ length: y.length + 1 }, (_, j) => j)
  for (let i = 1; i <= x.length; i++) {
    const cur: number[] = [i]
    for (let j = 1; j <= y.length; j++) {
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (x[i - 1] === y[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[y.length]!
}

export function isNameSimilar(a: string, b: string): boolean {
  const na = normalizeCampsiteName(a)
  const nb = normalizeCampsiteName(b)
  if (!na || !nb) return false
  return na.includes(nb) || nb.includes(na) || editDistance(na, nb) <= 2
}

export function distanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 6371000
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.latitude - a.latitude)
  const dLon = rad(b.longitude - a.longitude)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

const LEVEL_ORDER: Record<MatchLevel, number> = { same_place: 0, likely: 1, nearby: 2 }

export function matchCampsite(
  candidate: Omit<MatchableCampsite, 'id'>,
  existing: MatchableCampsite[],
  opts: { bracketAware?: boolean } = {},
): CampsiteMatch[] {
  const nameC = normalizeCampsiteName(candidate.name)
  const hasCoord = candidate.latitude != null && candidate.longitude != null
  const results: CampsiteMatch[] = []

  for (const e of existing) {
    if (e.merged_into_id != null) continue
    const eHasCoord = e.latitude != null && e.longitude != null
    const distanceM =
      hasCoord && eHasCoord
        ? distanceMeters(
            { latitude: candidate.latitude as number, longitude: candidate.longitude as number },
            { latitude: e.latitude as number, longitude: e.longitude as number },
          )
        : null

    if (candidate.google_place_id && candidate.google_place_id === e.google_place_id) {
      results.push({ campsite: e, level: 'same_place', distanceM })
      continue
    }

    const nameE = normalizeCampsiteName(e.name)
    const sameName = nameC !== '' && nameC === nameE
    let level: MatchLevel | null = null

    if (distanceM != null) {
      if (distanceM < NEAR_M) level = isNameSimilar(candidate.name, e.name) ? 'likely' : 'nearby'
      else if (distanceM <= SAME_NAME_MAX_M && sameName) level = 'likely'
    } else if (sameName && candidate.district != null && candidate.district === e.district) {
      level = 'likely'
    }
    if (!level) continue

    if (level === 'likely' && opts.bracketAware) {
      const bc = bracketContent(candidate.name)
      const be = bracketContent(e.name)
      if (bc != null && be != null && bc !== be) level = 'nearby'
    }
    results.push({ campsite: e, level, distanceM })
  }

  return results.sort(
    (a, b) =>
      LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] ||
      (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity),
  )
}
