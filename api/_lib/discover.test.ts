import { describe, it, expect, vi } from 'vitest'
import { handleCampsiteDiscover } from './discover.js'
import { HttpError } from './http.js'
import type { PlaceLite } from './places.js'
import type { MatchableCampsite } from '../../src/utils/campsiteMatch.js'

const place = (over: Partial<PlaceLite> & { placeId: string }): PlaceLite => ({
  name: '某某露營區',
  address: 'a',
  lat: 24.5,
  lng: 121.0,
  ...over,
})
const camp = (over: Partial<MatchableCampsite> & { id: number }): MatchableCampsite => ({
  name: '完全不同的營地',
  district: null,
  latitude: 10,
  longitude: 10,
  ...over,
})
const post = (body: unknown) => new Request('http://x/api/campsite-discover', { method: 'POST', body: JSON.stringify(body) })

function run(body: unknown, places: PlaceLite[], existing: MatchableCampsite[] = [], alts: Array<number | null> = []) {
  const textSearchImpl = vi.fn(async () => ({ places, nextPageToken: 'next' }))
  const elevationsImpl = vi.fn(async () => alts)
  return {
    textSearchImpl,
    elevationsImpl,
    res: handleCampsiteDiscover(post(body), { textSearchImpl, elevationsImpl, loadCampsites: async () => existing }),
  }
}
async function out(p: Promise<Response>) {
  return (await p).json() as Promise<{
    results: Array<PlaceLite & { altitude: number | null; nearbyName?: string }>
    excludedCount: number
    closedCount: number
    nextPageToken?: string
  }>
}
async function statusOf(p: Promise<unknown>) {
  try {
    await p
  } catch (e) {
    if (e instanceof HttpError) return e.status
    throw e
  }
  return 200
}

describe('handleCampsiteDiscover', () => {
  // 為什麼：已收錄的營區不該再出現在「找新營區」，否則使用者會重複建立
  it('已收錄的 place_id 被排除，excludedCount 為 1', async () => {
    const { res } = run({ city: '新竹縣' }, [place({ placeId: 'A' }), place({ placeId: 'B', name: '別間', lat: 25 })], [
      camp({ id: 1, google_place_id: 'A' }),
    ])
    const r = await out(res)
    expect(r.results.map((p) => p.placeId)).toEqual(['B'])
    expect(r.excludedCount).toBe(1)
  })

  // 為什麼：全台有很多同名農場，距離 5 km 以上不能判成重複（審查重點 4）
  it('同名但距離 5 km 的不排除', async () => {
    const { res } = run({ city: '苗栗縣' }, [place({ placeId: 'A', name: '快樂農場', lat: 24.5, lng: 121.0 })], [
      camp({ id: 1, name: '快樂農場', latitude: 24.5, longitude: 121.05 }),
    ])
    const r = await out(res)
    expect(r.results).toHaveLength(1)
    expect(r.excludedCount).toBe(0)
  })

  // 為什麼：附近有別的營區只是提醒，不能排除；要帶 nearbyName 讓前端顯示
  it('nearby 的保留並帶 nearbyName', async () => {
    const { res } = run({ city: '苗栗縣' }, [place({ placeId: 'A', name: '雲海星空營地' })], [
      camp({ id: 1, name: '溪畔楓林山莊', latitude: 24.5005, longitude: 121.0 }),
    ])
    const r = await out(res)
    expect(r.results[0]?.nearbyName).toBe('溪畔楓林山莊')
  })

  // 為什麼：永久歇業的營區推薦了也不能去；暫停營業則保留讓前端加註
  it('永久歇業排除並計入 closedCount，暫停營業保留', async () => {
    const { res } = run({ city: '新竹縣' }, [
      place({ placeId: 'A', businessStatus: 'CLOSED_PERMANENTLY' }),
      place({ placeId: 'B', name: '乙', lat: 25, businessStatus: 'CLOSED_TEMPORARILY' }),
    ])
    const r = await out(res)
    expect(r.closedCount).toBe(1)
    expect(r.results.map((p) => p.placeId)).toEqual(['B'])
  })

  // 為什麼：海拔 API 有呼叫成本，必須批次一次查完；查不到的不能因此被誤排除
  it('altitudeMin 1000：800 m 排除、null 保留，海拔只呼叫一次', async () => {
    const { res, elevationsImpl } = run(
      { city: '南投縣', altitudeMin: 1000 },
      [
        place({ placeId: 'A', name: '甲', lat: 23 }),
        place({ placeId: 'B', name: '乙', lat: 24 }),
        place({ placeId: 'C', name: '丙', lat: 25 }),
      ],
      [],
      [800, null, 1500],
    )
    const r = await out(res)
    expect(elevationsImpl).toHaveBeenCalledTimes(1)
    expect(r.results.map((p) => [p.placeId, p.altitude])).toEqual([['B', null], ['C', 1500]])
  })

  // 為什麼：query 格式是規格 §5.8 的決定（「露營」不是「露營區」），且要限制長度與頁數
  it('query 格式、單頁 20 筆、帶回 nextPageToken', async () => {
    const { res, textSearchImpl } = run(
      { city: '新竹縣', district: '尖石鄉', keywords: ['溪流', '雨棚'], freeText: '親子' },
      [],
    )
    const r = await out(res)
    expect(textSearchImpl).toHaveBeenCalledWith(
      '露營 新竹縣尖石鄉 溪流 雨棚 親子',
      expect.objectContaining({ forDiscover: true, pageSize: 20 }),
      undefined,
    )
    expect(r.nextPageToken).toBe('next')
  })

  // 為什麼：缺縣市或關鍵字過多的請求不該去打 Google（會扣額度）
  it('缺 city 或 keywords 超過 8 個回 400，且不呼叫搜尋', async () => {
    const a = run({ keywords: [] }, [])
    expect(await statusOf(a.res)).toBe(400)
    const b = run({ city: '新竹縣', keywords: Array(9).fill('x') }, [])
    expect(await statusOf(b.res)).toBe(400)
    expect(a.textSearchImpl).not.toHaveBeenCalled()
    expect(b.textSearchImpl).not.toHaveBeenCalled()
  })
})
