// 找新營區（規格 §5.8）。邏輯放這裡，endpoint 只做薄層。
import { HttpError, json } from './http.js'
import { textSearch, type PlaceLite } from './places.js'
import { fetchElevations } from './draft.js'
import { supabaseAdmin } from './supabaseAdmin.js'
import { matchCampsite, type MatchableCampsite } from '../../src/utils/campsiteMatch.js'

export type DiscoverResult = PlaceLite & { altitude: number | null; nearbyName?: string }

export interface DiscoverDeps {
  fetchImpl?: typeof fetch
  textSearchImpl?: typeof textSearch
  elevationsImpl?: typeof fetchElevations
  loadCampsites?: () => Promise<MatchableCampsite[]>
}

const MAX_KEYWORDS = 8
const MAX_QUERY = 120
const PAGE_SIZE = 20

async function loadAllCampsites(): Promise<MatchableCampsite[]> {
  const { data, error } = await supabaseAdmin
    .from('campsites')
    .select('id,name,district,latitude,longitude,google_place_id,phone,merged_into_id')
    .is('merged_into_id', null)
  if (error) throw new Error(`load campsites failed: ${error.message}`)
  return (data ?? []) as MatchableCampsite[]
}

export async function handleCampsiteDiscover(req: Request, deps: DiscoverDeps = {}): Promise<Response> {
  const body = (await req.json().catch(() => null)) as {
    city?: unknown
    district?: unknown
    altitudeMin?: unknown
    keywords?: unknown
    freeText?: unknown
    pageToken?: unknown
  } | null

  const city = typeof body?.city === 'string' ? body.city.trim() : ''
  if (!city) throw new HttpError(400, 'city is required')
  const keywords = body?.keywords === undefined ? [] : body.keywords
  if (!Array.isArray(keywords) || keywords.length > MAX_KEYWORDS || keywords.some((k) => typeof k !== 'string')) {
    throw new HttpError(400, `keywords must be at most ${MAX_KEYWORDS} strings`)
  }
  const district = typeof body?.district === 'string' ? body.district.trim() : ''
  const freeText = typeof body?.freeText === 'string' ? body.freeText.trim() : ''
  const altitudeMin = typeof body?.altitudeMin === 'number' && Number.isFinite(body.altitudeMin) ? body.altitudeMin : undefined
  const pageToken = typeof body?.pageToken === 'string' && body.pageToken ? body.pageToken : undefined

  const query = `露營 ${city}${district} ${(keywords as string[]).join(' ')} ${freeText}`.trim().slice(0, MAX_QUERY)

  const search = deps.textSearchImpl ?? textSearch
  const { places, nextPageToken } = await search(
    query,
    { forDiscover: true, pageSize: PAGE_SIZE, ...(pageToken ? { pageToken } : {}) },
    deps.fetchImpl,
  )

  const existing = await (deps.loadCampsites ?? loadAllCampsites)()
  let closedCount = 0
  let excludedCount = 0
  let kept: DiscoverResult[] = []
  for (const p of places.slice(0, PAGE_SIZE)) {
    if (p.businessStatus === 'CLOSED_PERMANENTLY') {
      closedCount++
      continue
    }
    const matches = matchCampsite(
      { name: p.name, district: null, latitude: p.lat, longitude: p.lng, google_place_id: p.placeId },
      existing,
    )
    if (matches.some((m) => m.level === 'same_place' || m.level === 'likely')) {
      excludedCount++
      continue
    }
    const nearby = matches.find((m) => m.level === 'nearby')
    kept.push({ ...p, altitude: null, ...(nearby ? { nearbyName: nearby.campsite.name } : {}) })
  }

  // 結果卡要顯示海拔，所以不論有沒有門檻都一次查全部（合併成一次呼叫）
  if (kept.length > 0) {
    const alts = await (deps.elevationsImpl ?? fetchElevations)(
      kept.map((r) => ({ lat: r.lat, lng: r.lng })),
      deps.fetchImpl,
    )
    kept = kept.map((r, i) => ({ ...r, altitude: alts[i] ?? null }))
    // 查不到海拔（null）的保留
    if (altitudeMin !== undefined) kept = kept.filter((r) => r.altitude === null || r.altitude >= altitudeMin)
  }

  return json(200, { results: kept, excludedCount, closedCount, ...(nextPageToken ? { nextPageToken } : {}) })
}
