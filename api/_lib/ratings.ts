// 每月刷新營區 Google 評分（Google 條款只允許長期保存 place_id，評分等內容需定期重抓）
import { headers } from './places.js'

export const STALE_DAYS = 30
export const MAX_PER_RUN = 250
export const CONCURRENCY = 3
export const RATING_MASK = 'id,rating,userRatingCount,businessStatus'

const BASE = 'https://places.googleapis.com/v1'
const TIMEOUT_MS = 8_000
const STATUSES = ['OPERATIONAL', 'CLOSED_TEMPORARILY', 'CLOSED_PERMANENTLY']

export interface RatingCandidate {
  id: number
  google_place_id: string | null
  google_rating_at: string | null
}

export interface RatingUpdate {
  google_rating: number | null
  google_rating_count: number | null
  google_rating_at: string
  google_business_status: string | null
}

export interface RawRating {
  rating?: number
  userRatingCount?: number
  businessStatus?: string
}

// 沒評分時間（從未抓過）優先，其餘舊的先；超過 cap 的留給下個月，避免單次呼叫量失控
export function selectStale(rows: RatingCandidate[], now: Date, cap = MAX_PER_RUN): RatingCandidate[] {
  const cutoff = now.getTime() - STALE_DAYS * 86_400_000
  const at = (r: RatingCandidate) => (r.google_rating_at ? Date.parse(r.google_rating_at) : -Infinity)
  return rows
    .filter((r) => !!r.google_place_id && at(r) < cutoff)
    .sort((a, b) => (at(a) === at(b) ? a.id - b.id : at(a) < at(b) ? -1 : 1))
    .slice(0, cap)
}

// DB 有 check 約束（評分 1–5、狀態三選一），超出範圍的值寫 null 而不是讓整筆更新失敗
export function toRatingUpdate(raw: RawRating, now: Date): RatingUpdate {
  const rating =
    typeof raw.rating === 'number' && raw.rating >= 1 && raw.rating <= 5 ? Math.round(raw.rating * 10) / 10 : null
  const count = typeof raw.userRatingCount === 'number' && raw.userRatingCount >= 0 ? raw.userRatingCount : null
  return {
    google_rating: rating,
    // 有評分才可能有評論數；沒評論的新店 Google 不回 rating，count 以 0 記錄
    google_rating_count: count ?? (rating === null ? 0 : null),
    google_rating_at: now.toISOString(),
    google_business_status: raw.businessStatus && STATUSES.includes(raw.businessStatus) ? raw.businessStatus : null,
  }
}

export type FetchRatingResult = { kind: 'ok'; raw: RawRating } | { kind: 'not_found' }

export async function fetchRating(placeId: string, fetchImpl: typeof fetch = fetch): Promise<FetchRatingResult> {
  const res = await fetchImpl(`${BASE}/places/${encodeURIComponent(placeId)}`, {
    method: 'GET',
    headers: headers(RATING_MASK),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (res.status === 404) return { kind: 'not_found' }
  if (!res.ok) throw new Error(`Places details failed: ${res.status}`)
  return { kind: 'ok', raw: (await res.json()) as RawRating }
}

export interface RatingsDeps {
  listCandidates: () => Promise<RatingCandidate[]>
  fetchRating: (placeId: string) => Promise<FetchRatingResult>
  update: (id: number, patch: RatingUpdate) => Promise<void>
  now: () => Date
  log: (msg: string) => void
}

export interface RatingsSummary {
  candidates: number
  selected: number
  updated: number
  notFound: number
  failed: number
}

export async function runRatingsRefresh(deps: RatingsDeps): Promise<RatingsSummary> {
  const all = await deps.listCandidates()
  const picked = selectStale(all, deps.now())
  const summary: RatingsSummary = { candidates: all.length, selected: picked.length, updated: 0, notFound: 0, failed: 0 }
  let next = 0
  const worker = async () => {
    while (next < picked.length) {
      const row = picked[next++]!
      try {
        const res = await deps.fetchRating(row.google_place_id!)
        if (res.kind === 'not_found') {
          // 地點被移除或 place_id 失效：保留舊資料，留給人工處理
          summary.notFound++
          deps.log(`ratings: place not found, campsite ${row.id}`)
          continue
        }
        await deps.update(row.id, toRatingUpdate(res.raw, deps.now()))
        summary.updated++
      } catch (e) {
        summary.failed++
        deps.log(`ratings: campsite ${row.id} failed: ${e instanceof Error ? e.message : 'unknown'}`)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, picked.length) }, worker))
  return summary
}
