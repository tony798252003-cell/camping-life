// 新增營區草稿（規格 §5.7、§7.2）。Gemini 在 Task 4.4 加入，這裡先接 Places＋海拔。
import { cleanCampsiteName } from '../../src/utils/campsiteName.js'
import { distanceMeters, isNameSimilar } from '../../src/utils/campsiteMatch.js'
import { parseTaiwanLocation } from '../../src/utils/googleMaps.js'
import type { FieldSource } from '../../src/types/database.js'
import { HttpError, json } from './http.js'
import { isAllowedMapsHost, parseMapsUrl, resolveShortUrl } from './mapsUrl.js'
import { placeDetails, textSearch, type PlaceDetail, type PlaceLite } from './places.js'

export interface DraftField<T> {
  value: T | null
  source: FieldSource['source']
  confidence: FieldSource['confidence']
  urls: string[]
  needsReview: boolean
}

type BusinessStatusValue = 'open' | 'temporarily_closed' | 'closed'

export interface CampsiteDraft {
  placeId: string
  rawName: string
  fields: {
    name: DraftField<string>
    city: DraftField<string>
    district: DraftField<string>
    address: DraftField<string>
    latitude: DraftField<number>
    longitude: DraftField<number>
    altitude: DraftField<number>
    phone: DraftField<string>
    google_maps_url: DraftField<string>
    business_status: DraftField<BusinessStatusValue>
  }
  warnings: string[]
}

const STATUS_MAP: Record<NonNullable<PlaceDetail['businessStatus']>, BusinessStatusValue> = {
  OPERATIONAL: 'open',
  CLOSED_TEMPORARILY: 'temporarily_closed',
  CLOSED_PERMANENTLY: 'closed',
}

// 有值 → high/免檢查；沒值 → none/要檢查
function field<T>(source: FieldSource['source'], value: T | null | undefined): DraftField<T> {
  const has = value !== null && value !== undefined && value !== ''
  return {
    value: has ? (value as T) : null,
    source,
    confidence: has ? 'high' : 'none',
    urls: [],
    needsReview: !has,
  }
}

// Places (New) 的 addressComponents 是 longText；parseTaiwanLocation 吃 long_name。
// 同時把「台」統一成常數表使用的「臺」。
function parseLocation(components: PlaceDetail['addressComponents']) {
  return parseTaiwanLocation(
    components.map((c) => {
      const name = c.longText.replace(/台/g, '臺')
      return { long_name: name, short_name: name, types: c.types }
    }),
  )
}

export function placeToDraft(d: PlaceDetail, altitude: number | null): CampsiteDraft {
  const loc = parseLocation(d.addressComponents)
  return {
    placeId: d.placeId,
    rawName: d.name,
    fields: {
      name: field('places', cleanCampsiteName(d.name)),
      city: field('places', loc.cityId),
      district: field('places', loc.districtId),
      address: field('places', d.address),
      latitude: field('places', d.lat),
      longitude: field('places', d.lng),
      altitude: field('elevation', altitude),
      phone: field('places', d.phone),
      google_maps_url: field('places', d.mapsUrl),
      business_status: field('places', d.businessStatus ? STATUS_MAP[d.businessStatus] : null),
    },
    warnings: [],
  }
}

export async function fetchElevations(
  points: Array<{ lat: number; lng: number }>,
  fetchImpl: typeof fetch = fetch,
): Promise<Array<number | null>> {
  const nulls = points.map(() => null)
  if (points.length === 0) return nulls
  const lat = points.map((p) => p.lat).join(',')
  const lng = points.map((p) => p.lng).join(',')
  try {
    const res = await fetchImpl(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`)
    if (!res.ok) return nulls
    const { elevation } = (await res.json()) as { elevation?: unknown }
    if (!Array.isArray(elevation)) return nulls
    return points.map((_, i) => (typeof elevation[i] === 'number' ? (elevation[i] as number) : null))
  } catch {
    return nulls
  }
}

export class CannotResolveError extends HttpError {
  hint = '請改用名稱搜尋'
  constructor() {
    super(422, 'cannot_resolve')
  }
}

const NEAR_M = 300
const BIAS_RADIUS_M = 500

export async function resolveMapsUrl(
  mapsUrl: string,
  deps: { fetchImpl?: typeof fetch } = {},
): Promise<{ candidates: PlaceLite[]; preselectId?: string }> {
  // resolveShortUrl 會先檢查 host（SSRF）再逐跳檢查轉址
  const finalUrl = await resolveShortUrl(mapsUrl, deps.fetchImpl)
  if (!isAllowedMapsHost(finalUrl)) throw new HttpError(400, '請貼上 Google 地圖的連結')
  const parsed = parseMapsUrl(finalUrl)
  const hasCoord = parsed?.lat !== undefined && parsed?.lng !== undefined

  if (parsed?.name && hasCoord) {
    const { places } = await textSearch(
      parsed.name,
      { bias: { lat: parsed.lat as number, lng: parsed.lng as number, radiusM: BIAS_RADIUS_M } },
      deps.fetchImpl,
    )
    const candidates = places.slice(0, 5)
    const first = candidates[0]
    if (
      first &&
      distanceMeters(
        { latitude: parsed.lat as number, longitude: parsed.lng as number },
        { latitude: first.lat, longitude: first.lng },
      ) < NEAR_M &&
      isNameSimilar(parsed.name, cleanCampsiteName(first.name))
    ) {
      return { candidates, preselectId: first.placeId }
    }
    return { candidates }
  }

  // 只有名稱或 query：不確定是哪一間，一律不預選
  const query = parsed?.query ?? parsed?.name
  if (query) {
    const { places } = await textSearch(query, {}, deps.fetchImpl)
    return { candidates: places.slice(0, 5) }
  }
  throw new CannotResolveError()
}

export async function handleCampsiteDraft(req: Request, deps: { fetchImpl?: typeof fetch } = {}): Promise<Response> {
  const body = (await req.json().catch(() => null)) as {
    mapsUrl?: unknown
    resolveOnly?: unknown
    placeId?: unknown
    skipAi?: unknown
  } | null

  if (body?.resolveOnly === true) {
    if (typeof body.mapsUrl !== 'string' || body.mapsUrl.length === 0 || body.mapsUrl.length > 2000) {
      throw new HttpError(400, 'mapsUrl is required')
    }
    try {
      return json(200, await resolveMapsUrl(body.mapsUrl.trim(), deps))
    } catch (e) {
      if (e instanceof CannotResolveError) return json(422, { error: e.message, hint: e.hint })
      throw e
    }
  }

  if (typeof body?.placeId !== 'string' || body.placeId.length === 0 || body.placeId.length > 300) {
    throw new HttpError(400, 'placeId is required')
  }
  const detail = await placeDetails(body.placeId, deps.fetchImpl)
  const [altitude] = await fetchElevations([{ lat: detail.lat, lng: detail.lng }], deps.fetchImpl)
  return json(200, placeToDraft(detail, altitude ?? null))
}
