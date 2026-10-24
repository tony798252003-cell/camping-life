// Google Places API (New) 伺服器端包裝。key 只放 X-Goog-Api-Key header（規格 §7.2）。
import { HttpError } from './http.js'
import type { BusinessStatus, PlaceLite } from '../../src/types/campsiteDraft.js'

export type { BusinessStatus, PlaceLite }

export interface PlaceDetail extends PlaceLite {
  addressComponents: Array<{ longText: string; types: string[] }>
  phone?: string
  website?: string
  businessStatus?: BusinessStatus
  mapsUrl: string
}

const BASE = 'https://places.googleapis.com/v1'

// 規格 §7.2 原文
const SEARCH_MASK = 'places.id,places.displayName,places.formattedAddress,places.location'
// 刻意不含 places.rating / places.userRatingCount：這兩個欄位的計價等級未確認（規格 §7.3，成本優先），
// 確認前不要加回來。includedType 也刻意不設，避免改變結果集與計價。
const DISCOVER_MASK =
  SEARCH_MASK +
  ',places.googleMapsUri,places.businessStatus,places.primaryTypeDisplayName,nextPageToken'
const DETAILS_MASK =
  'id,displayName,formattedAddress,location,addressComponents,googleMapsUri,businessStatus,nationalPhoneNumber,websiteUri'

interface RawPlace {
  id: string
  displayName?: { text?: string }
  formattedAddress?: string
  location?: { latitude: number; longitude: number }
  googleMapsUri?: string
  businessStatus?: BusinessStatus
  primaryTypeDisplayName?: { text?: string }
  addressComponents?: Array<{ longText?: string; types?: string[] }>
  nationalPhoneNumber?: string
  websiteUri?: string
}

export function headers(mask: string): Record<string, string> {
  const key = process.env.GOOGLE_PLACES_SERVER_KEY
  if (!key) throw new Error('GOOGLE_PLACES_SERVER_KEY is not set')
  return {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': key,
    'X-Goog-FieldMask': mask,
  }
}

function toLite(p: RawPlace): PlaceLite {
  const lite: PlaceLite = {
    placeId: p.id,
    name: p.displayName?.text ?? '',
    address: p.formattedAddress ?? '',
    lat: p.location?.latitude ?? 0,
    lng: p.location?.longitude ?? 0,
  }
  if (p.googleMapsUri) lite.mapsUrl = p.googleMapsUri
  if (p.businessStatus) lite.businessStatus = p.businessStatus
  if (p.primaryTypeDisplayName?.text) lite.typeLabel = p.primaryTypeDisplayName.text
  return lite
}

const TIMEOUT_MS = 8_000

async function call(fetchImpl: typeof fetch, url: string, init: RequestInit, what: string): Promise<unknown> {
  let res: Response
  try {
    res = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) })
  } catch (e) {
    throw new HttpError(502, `${what} failed: ${e instanceof Error ? e.name : 'network error'}`)
  }
  if (!res.ok) throw new HttpError(502, `${what} failed: ${res.status}`)
  try {
    return await res.json()
  } catch {
    throw new HttpError(502, `${what} failed: invalid JSON`)
  }
}

export async function textSearch(
  query: string,
  opts: {
    bias?: { lat: number; lng: number; radiusM: number }
    pageToken?: string
    pageSize?: number
    forDiscover?: boolean
  } = {},
  fetchImpl: typeof fetch = fetch,
): Promise<{ places: PlaceLite[]; nextPageToken?: string }> {
  const body: Record<string, unknown> = { textQuery: query, languageCode: 'zh-TW', regionCode: 'TW' }
  if (opts.pageToken) body.pageToken = opts.pageToken
  if (opts.pageSize) body.pageSize = opts.pageSize
  if (opts.bias) {
    body.locationBias = {
      circle: { center: { latitude: opts.bias.lat, longitude: opts.bias.lng }, radius: opts.bias.radiusM },
    }
  }
  const data = (await call(
    fetchImpl,
    `${BASE}/places:searchText`,
    { method: 'POST', headers: headers(opts.forDiscover ? DISCOVER_MASK : SEARCH_MASK), body: JSON.stringify(body) },
    'Places text search',
  )) as { places?: RawPlace[]; nextPageToken?: string }
  // 沒有座標的結果直接丟掉，不要變成 (0,0)
  const out: { places: PlaceLite[]; nextPageToken?: string } = {
    places: (data.places ?? []).filter((p) => p.location).map(toLite),
  }
  if (data.nextPageToken) out.nextPageToken = data.nextPageToken
  return out
}

export async function placeDetails(placeId: string, fetchImpl: typeof fetch = fetch): Promise<PlaceDetail> {
  const p = (await call(
    fetchImpl,
    `${BASE}/places/${encodeURIComponent(placeId)}?languageCode=zh-TW&regionCode=TW`,
    { method: 'GET', headers: headers(DETAILS_MASK) },
    'Places details',
  )) as RawPlace
  const detail: PlaceDetail = {
    ...toLite(p),
    mapsUrl: p.googleMapsUri ?? '',
    addressComponents: (p.addressComponents ?? []).map((c) => ({ longText: c.longText ?? '', types: c.types ?? [] })),
  }
  if (p.nationalPhoneNumber) detail.phone = p.nationalPhoneNumber
  if (p.websiteUri) detail.website = p.websiteUri
  return detail
}
