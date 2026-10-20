import { describe, it, expect } from 'vitest'
import { placeToDraft, fetchElevations, resolveMapsUrl, handleCampsiteDraft } from './draft.js'
import type { PlaceDetail } from './places.js'
import { HttpError } from './http.js'

process.env.GOOGLE_PLACES_SERVER_KEY = 'test-key'

const detail = (over: Partial<PlaceDetail> = {}): PlaceDetail => ({
  placeId: 'pid1',
  name: '雲頂露營區｜山林景觀',
  address: '新竹縣尖石鄉某路 1 號',
  lat: 24.6,
  lng: 121.2,
  mapsUrl: 'https://maps.google.com/?cid=1',
  phone: '03 123 4567',
  businessStatus: 'OPERATIONAL',
  addressComponents: [
    { longText: '新竹縣', types: ['administrative_area_level_1'] },
    { longText: '尖石鄉', types: ['administrative_area_level_2'] },
  ],
  ...over,
})

describe('placeToDraft', () => {
  it('Places 來源欄位標 places/high/免檢查 — 這些是 Google 的結構化資料，使用者不必逐欄確認', () => {
    const d = placeToDraft(detail(), 1200)
    for (const k of ['address', 'latitude', 'longitude', 'phone', 'google_maps_url', 'city', 'district'] as const) {
      expect(d.fields[k]).toMatchObject({ source: 'places', confidence: 'high', needsReview: false })
    }
    expect(d.fields.latitude.value).toBe(24.6)
    expect(d.fields.city.value).toBe('新竹縣')
    expect(d.fields.district.value).toBe('尖石鄉')
  })

  it('altitude 來源是 elevation；取不到時 value 為 null 且要使用者檢查 — 不能默默填 0', () => {
    expect(placeToDraft(detail(), 1200).fields.altitude).toMatchObject({ value: 1200, source: 'elevation', needsReview: false })
    expect(placeToDraft(detail(), null).fields.altitude).toMatchObject({ value: null, source: 'elevation', needsReview: true })
  })

  it('name 預設用清理後的名稱，rawName 保留 Google 原文 — 使用者要能看到被去掉的部分', () => {
    const d = placeToDraft(detail(), null)
    expect(d.fields.name.value).toBe('雲頂露營區')
    expect(d.rawName).toBe('雲頂露營區｜山林景觀')
    expect(d.placeId).toBe('pid1')
  })

  it('營業狀態對應：CLOSED_PERMANENTLY → closed、CLOSED_TEMPORARILY → temporarily_closed — 已歇業的營區不能被當成營業中', () => {
    expect(placeToDraft(detail({ businessStatus: 'CLOSED_PERMANENTLY' }), null).fields.business_status.value).toBe('closed')
    expect(placeToDraft(detail({ businessStatus: 'CLOSED_TEMPORARILY' }), null).fields.business_status.value).toBe('temporarily_closed')
    expect(placeToDraft(detail({ businessStatus: 'OPERATIONAL' }), null).fields.business_status.value).toBe('open')
  })

  it('「台」字地址也能解析出 city/district — Google 可能回「台中市」，但常數表用「臺」', () => {
    const d = placeToDraft(
      detail({
        addressComponents: [
          { longText: '台中市', types: ['administrative_area_level_1'] },
          { longText: '和平區', types: ['administrative_area_level_3'] },
        ],
      }),
      null,
    )
    expect(d.fields.city.value).toBe('臺中市')
    expect(d.fields.district.value).toBe('和平區')
  })

  it('解析不出縣市時 value 為 null 且需檢查 — 不能猜', () => {
    const d = placeToDraft(detail({ addressComponents: [] }), null)
    expect(d.fields.city).toMatchObject({ value: null, needsReview: true })
  })
})

describe('fetchElevations', () => {
  it('3 個點只發一次 request — 省 API 呼叫與延遲', async () => {
    let calls = 0
    let url = ''
    const f = (async (u: string) => {
      calls++
      url = u
      return { ok: true, status: 200, json: async () => ({ elevation: [10, 20, 30] }) }
    }) as unknown as typeof fetch
    const r = await fetchElevations([{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }, { lat: 5, lng: 6 }], f)
    expect(calls).toBe(1)
    expect(url).toContain('latitude=1,3,5')
    expect(url).toContain('longitude=2,4,6')
    expect(r).toEqual([10, 20, 30])
  })

  it('失敗時回 null 而不是丟錯 — 海拔只是輔助欄位，不能讓整份草稿失敗', async () => {
    const f = (async () => ({ ok: false, status: 500 })) as unknown as typeof fetch
    expect(await fetchElevations([{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }], f)).toEqual([null, null])
    const boom = (async () => { throw new Error('net') }) as unknown as typeof fetch
    expect(await fetchElevations([{ lat: 1, lng: 2 }], boom)).toEqual([null])
  })
})

// 為什麼：共識要求「不自動猜」，選錯營區使用者不會發現
describe('resolveMapsUrl', () => {
  const raw = (id: string, name: string, lat: number, lng: number) => ({
    id,
    displayName: { text: name },
    formattedAddress: 'a',
    location: { latitude: lat, longitude: lng },
  })
  const fetchWith = (places: unknown[]) =>
    (async (u: string) => {
      if (String(u).includes('places:searchText')) return { ok: true, status: 200, json: async () => ({ places }) }
      return { ok: true, status: 200, headers: new Headers(), json: async () => ({}) }
    }) as unknown as typeof fetch

  it('?q= 連結：有候選、沒有 preselectId — 只有字串無法確定是哪一間', async () => {
    const r = await resolveMapsUrl('https://maps.google.com/?q=雲頂露營區', {
      fetchImpl: fetchWith([raw('a', '雲頂露營區', 24.6, 121.2)]),
    })
    expect(r.candidates).toHaveLength(1)
    expect(r.preselectId).toBeUndefined()
  })

  it('有座標、第 1 筆 120m 內且名稱相似：preselectId = 第 1 筆', async () => {
    // 緯度差 0.001 約 111m
    const r = await resolveMapsUrl('https://www.google.com/maps/place/雲頂露營區/@24.6,121.2,15z', {
      fetchImpl: fetchWith([raw('a', '雲頂露營區', 24.601, 121.2), raw('b', '別間', 24.7, 121.2)]),
    })
    expect(r.preselectId).toBe('a')
    expect(r.candidates).toHaveLength(2)
  })

  it('有座標但第 1 筆在 800m：沒有 preselectId — 距離太遠不能預選', async () => {
    const r = await resolveMapsUrl('https://www.google.com/maps/place/雲頂露營區/@24.6,121.2,15z', {
      fetchImpl: fetchWith([raw('a', '雲頂露營區', 24.6072, 121.2)]),
    })
    expect(r.candidates).toHaveLength(1)
    expect(r.preselectId).toBeUndefined()
  })

  it('距離近但名稱不相似：沒有 preselectId — 同一個點位可能是別間店', async () => {
    const r = await resolveMapsUrl('https://www.google.com/maps/place/雲頂露營區/@24.6,121.2,15z', {
      fetchImpl: fetchWith([raw('a', '完全不同的商店', 24.6, 121.2)]),
    })
    expect(r.preselectId).toBeUndefined()
  })

  it('只有 cid 或解析不出東西：422 cannot_resolve — 請使用者改用名稱搜尋', async () => {
    for (const u of ['https://maps.google.com/?cid=123', 'https://www.google.com/maps']) {
      await expect(resolveMapsUrl(u, { fetchImpl: fetchWith([]) })).rejects.toMatchObject({ status: 422 })
    }
  })

  it('非 Google 網域直接 400 — 伺服器不能去抓任意網址（SSRF）', async () => {
    let called = false
    const f = (async () => { called = true; return new Response('') }) as unknown as typeof fetch
    await expect(resolveMapsUrl('https://evil.example.com/x', { fetchImpl: f })).rejects.toBeInstanceOf(HttpError)
    expect(called).toBe(false)
  })
})

describe('handleCampsiteDraft', () => {
  const post = (body: unknown) => new Request('http://x/api/campsite-draft', { method: 'POST', body: JSON.stringify(body) })

  it('cannot_resolve 回 422 並帶 hint — 前端據此引導改用名稱搜尋', async () => {
    const res = await handleCampsiteDraft(post({ mapsUrl: 'https://maps.google.com/?cid=1', resolveOnly: true }), {
      fetchImpl: (async () => new Response('', { status: 200 })) as unknown as typeof fetch,
    })
    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({ error: 'cannot_resolve', hint: '請改用名稱搜尋' })
  })

  it('placeId 回草稿；缺 placeId 與 mapsUrl 回 400', async () => {
    const f = (async (u: string) =>
      String(u).includes('open-meteo')
        ? { ok: true, status: 200, json: async () => ({ elevation: [850] }) }
        : {
            ok: true,
            status: 200,
            json: async () => ({
              id: 'pid1',
              displayName: { text: '雲頂露營區' },
              formattedAddress: 'x',
              location: { latitude: 24.6, longitude: 121.2 },
              googleMapsUri: 'https://maps.google.com/?cid=1',
              addressComponents: [],
            }),
          }) as unknown as typeof fetch
    const res = await handleCampsiteDraft(post({ placeId: 'pid1', skipAi: true }), { fetchImpl: f })
    const body = (await res.json()) as { placeId: string; fields: { altitude: { value: number } } }
    expect(body.placeId).toBe('pid1')
    expect(body.fields.altitude.value).toBe(850)
    await expect(handleCampsiteDraft(post({}), { fetchImpl: f })).rejects.toMatchObject({ status: 400 })
  })
})
