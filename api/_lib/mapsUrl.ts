import { HttpError } from './http.js'

export const ALLOWED_MAPS_HOSTS = [
  'maps.app.goo.gl',
  'goo.gl',
  'google.com',
  'www.google.com',
  'maps.google.com',
  'google.com.tw',
  'www.google.com.tw',
  'maps.google.com.tw',
] as const

const MAX_REDIRECTS = 5

export function isAllowedMapsHost(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && (ALLOWED_MAPS_HOSTS as readonly string[]).includes(u.hostname)
  } catch {
    return false
  }
}

export interface ParsedMapsUrl {
  name?: string
  lat?: number
  lng?: number
  query?: string
  cid?: string
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s.replace(/\+/g, ' '))
  } catch {
    return s
  }
}

export function parseMapsUrl(url: string): ParsedMapsUrl | null {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }
  const result: ParsedMapsUrl = {}

  const place = u.pathname.match(/\/place\/([^/]+)/)
  if (place) result.name = safeDecode(place[1])

  // !3d/!4d 是店家點位，比 @（地圖中心）精確
  const full = safeDecode(u.pathname + u.search)
  const pin = full.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/)
  const at = u.pathname.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/)
  const m = pin ?? at
  if (m) {
    result.lat = Number(m[1])
    result.lng = Number(m[2])
  }

  const q = u.searchParams.get('q') ?? u.searchParams.get('query')
  if (q) result.query = q
  const cid = u.searchParams.get('cid')
  if (cid) result.cid = cid

  return Object.keys(result).length > 0 ? result : null
}

export async function resolveShortUrl(url: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  let current = url
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!isAllowedMapsHost(current)) throw new HttpError(400, '請貼上 Google 地圖的連結')
    let res: Response
    try {
      res = await fetchImpl(current, { redirect: 'manual', signal: AbortSignal.timeout(8_000) })
    } catch (e) {
      throw new HttpError(502, `resolve maps url failed: ${e instanceof Error ? e.name : 'network error'}`)
    }
    await res.body?.cancel().catch(() => {})
    const location = res.headers.get('location')
    if (res.status < 300 || res.status >= 400 || !location) return current
    current = new URL(location, current).toString()
  }
  throw new HttpError(400, '連結轉址次數過多')
}
