import { describe, it, expect, vi } from 'vitest'
import {
  CONCURRENCY,
  MAX_PER_RUN,
  runRatingsRefresh,
  selectStale,
  toRatingUpdate,
  type RatingCandidate,
  type RatingsDeps,
} from './ratings.js'

const NOW = new Date('2026-11-01T19:00:00Z')
const row = (id: number, at: string | null, place: string | null = `p${id}`): RatingCandidate => ({
  id,
  google_place_id: place,
  google_rating_at: at,
})

describe('selectStale', () => {
  it('從未抓過與超過 30 天的要刷新，剛抓過的不重複花錢', () => {
    const rows = [row(1, '2026-10-30T00:00:00Z'), row(2, null), row(3, '2026-09-01T00:00:00Z')]
    expect(selectStale(rows, NOW).map((r) => r.id)).toEqual([2, 3])
  })
  it('剛好 30 天整不算過期（嚴格大於 30 天才刷新）', () => {
    expect(selectStale([row(1, '2026-10-02T19:00:00Z')], NOW)).toEqual([])
    expect(selectStale([row(1, '2026-10-02T18:59:59Z')], NOW)).toHaveLength(1)
  })
  it('沒有 place_id 的營區（自己新增）無法查，直接略過', () => {
    expect(selectStale([row(1, null, null), row(2, null, '')], NOW)).toEqual([])
  })
  it('超過上限時從未抓過的優先、再來最舊的，其餘留給下次', () => {
    const rows = [row(1, '2026-08-01T00:00:00Z'), row(2, '2026-07-01T00:00:00Z'), row(3, null)]
    expect(selectStale(rows, NOW, 2).map((r) => r.id)).toEqual([3, 2])
  })
  it('預設單次上限 600，避免 API 費用失控', () => {
    const rows = Array.from({ length: 700 }, (_, i) => row(i + 1, null))
    expect(selectStale(rows, NOW)).toHaveLength(MAX_PER_RUN)
    expect(MAX_PER_RUN).toBe(600)
  })
})

describe('toRatingUpdate', () => {
  it('正常回應原樣對應並蓋上更新時間', () => {
    expect(toRatingUpdate({ rating: 4.6, userRatingCount: 612, businessStatus: 'OPERATIONAL' }, NOW)).toEqual({
      google_rating: 4.6,
      google_rating_count: 612,
      google_rating_at: NOW.toISOString(),
      google_business_status: 'OPERATIONAL',
    })
  })
  it('新店沒有評分時 rating 寫 null、評論數記 0，才不會被當成「沒抓過」', () => {
    const u = toRatingUpdate({ businessStatus: 'OPERATIONAL' }, NOW)
    expect(u.google_rating).toBeNull()
    expect(u.google_rating_count).toBe(0)
  })
  it('未知營業狀態或超出 DB check 範圍的評分寫 null，避免整筆更新被拒', () => {
    const u = toRatingUpdate({ rating: 0, userRatingCount: 3, businessStatus: 'BUSINESS_STATUS_UNSPECIFIED' }, NOW)
    expect(u.google_rating).toBeNull()
    expect(u.google_business_status).toBeNull()
  })
  it('評分四捨五入到一位小數（numeric(2,1)）', () => {
    expect(toRatingUpdate({ rating: 4.55, userRatingCount: 1 }, NOW).google_rating).toBe(4.6)
  })
})

describe('runRatingsRefresh', () => {
  const deps = (over: Partial<RatingsDeps>): RatingsDeps => ({
    listCandidates: async () => [],
    fetchRating: async () => ({ kind: 'ok', raw: { rating: 4.5, userRatingCount: 50 } }),
    update: async () => {},
    now: () => NOW,
    log: () => {},
    ...over,
  })

  it('404 不更新（保留舊資料）只記 log，其他筆照常更新，單筆失敗不拖垮整批', async () => {
    const update = vi.fn(async (_id: number, _patch: unknown) => {})
    const log = vi.fn()
    const summary = await runRatingsRefresh(
      deps({
        listCandidates: async () => [row(1, null), row(2, null), row(3, null)],
        fetchRating: async (p) => {
          if (p === 'p1') return { kind: 'not_found' }
          if (p === 'p2') throw new Error('Places details failed: 500')
          return { kind: 'ok', raw: { rating: 4.1, userRatingCount: 30 } }
        },
        update,
        log,
      }),
    )
    expect(summary).toEqual({ candidates: 3, selected: 3, updated: 1, notFound: 1, failed: 1 })
    expect(update).toHaveBeenCalledTimes(1)
    expect(update.mock.calls[0]![0]).toBe(3)
    expect(log).toHaveBeenCalledTimes(2)
  })

  it(`同時最多 ${CONCURRENCY} 個請求，避免觸發 Google 配額`, async () => {
    let running = 0
    let peak = 0
    await runRatingsRefresh(
      deps({
        listCandidates: async () => Array.from({ length: 10 }, (_, i) => row(i + 1, null)),
        fetchRating: async () => {
          running++
          peak = Math.max(peak, running)
          await new Promise((r) => setTimeout(r, 5))
          running--
          return { kind: 'ok', raw: { rating: 4, userRatingCount: 20 } }
        },
      }),
    )
    expect(peak).toBe(CONCURRENCY)
  })
})
