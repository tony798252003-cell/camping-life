import { describe, it, expect } from 'vitest'
import { textSearch, placeDetails } from './places.js'

type Call = { url: string; init: RequestInit }
function mockFetch(body: unknown, calls: Call[] = [], ok = true): typeof fetch {
  return (async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), init })
    return { ok, status: ok ? 200 : 403, json: async () => body, text: async () => JSON.stringify(body) }
  }) as unknown as typeof fetch
}
const headersOf = (c: Call) => c.init.headers as Record<string, string>

const raw = {
  id: 'p1',
  displayName: { text: '山中營地' },
  formattedAddress: '苗栗縣泰安鄉',
  location: { latitude: 24.5, longitude: 121.1 },
}

describe('textSearch', () => {
  // 為什麼：key 放 URL 會進 Vercel/Google 的 access log；只能放 header
  it('key 只在 X-Goog-Api-Key header，URL 沒有 key=', async () => {
    process.env.GOOGLE_PLACES_SERVER_KEY = 'secret-k'
    const calls: Call[] = []
    await textSearch('山中營地', {}, mockFetch({ places: [raw] }, calls))
    expect(headersOf(calls[0]!)['X-Goog-Api-Key']).toBe('secret-k')
    expect(calls[0]!.url).not.toContain('key=')
    expect(calls[0]!.url).not.toContain('secret-k')
  })

  // 為什麼：field mask 決定計費 SKU，必須與規格 §7.2 逐字一致，不能偷加欄位
  it('field mask 與規格 §7.2 完全相同，並帶 zh-TW / TW', async () => {
    const calls: Call[] = []
    await textSearch('x', {}, mockFetch({ places: [] }, calls))
    expect(headersOf(calls[0]!)['X-Goog-FieldMask']).toBe(
      'places.id,places.displayName,places.formattedAddress,places.location',
    )
    const body = JSON.parse(calls[0]!.init.body as string)
    expect(body.languageCode).toBe('zh-TW')
    expect(body.regionCode).toBe('TW')
    expect(body.textQuery).toBe('x')
  })

  // 為什麼：discover 才需要評分/類型/狀態，一般名稱搜尋不該多付 SKU 費用
  it('forDiscover 才加 discover 欄位與 nextPageToken，並可帶 bias、pageToken、pageSize', async () => {
    const calls: Call[] = []
    const r = await textSearch(
      'x',
      { forDiscover: true, pageToken: 'tok', pageSize: 20, bias: { lat: 1, lng: 2, radiusM: 3000 } },
      mockFetch(
        {
          places: [
            {
              ...raw,
              googleMapsUri: 'https://maps.google.com/?cid=1',
              businessStatus: 'OPERATIONAL',
              primaryTypeDisplayName: { text: '露營地' },
              rating: 4.5,
              userRatingCount: 10,
            },
          ],
          nextPageToken: 'n2',
        },
        calls,
      ),
    )
    const mask = headersOf(calls[0]!)['X-Goog-FieldMask']!
    expect(mask).toContain('nextPageToken')
    expect(mask).toContain('places.googleMapsUri')
    expect(mask).toContain('places.rating')
    const body = JSON.parse(calls[0]!.init.body as string)
    expect(body.pageToken).toBe('tok')
    expect(body.pageSize).toBe(20)
    expect(body.locationBias.circle).toEqual({ center: { latitude: 1, longitude: 2 }, radius: 3000 })
    expect(r.nextPageToken).toBe('n2')
    expect(r.places[0]).toMatchObject({
      placeId: 'p1',
      name: '山中營地',
      address: '苗栗縣泰安鄉',
      lat: 24.5,
      lng: 121.1,
      rating: 4.5,
      ratingCount: 10,
      mapsUrl: 'https://maps.google.com/?cid=1',
      businessStatus: 'OPERATIONAL',
      typeLabel: '露營地',
    })
  })

  // 為什麼：Google 沒有結果時省略 places 欄位，不能 crash
  it('沒有結果時回空陣列', async () => {
    expect((await textSearch('x', {}, mockFetch({}))).places).toEqual([])
  })

  // 為什麼：上游失敗要讓呼叫端知道（轉 502），不能默默回空結果
  it('上游非 2xx 時丟錯', async () => {
    await expect(textSearch('x', {}, mockFetch({ error: 'no' }, [], false))).rejects.toThrow()
  })
})

describe('placeDetails', () => {
  // 為什麼：Details 的 field mask 同樣決定 SKU，且 key 不能進 URL
  it('GET places/{id}，mask 照規格、key 在 header', async () => {
    process.env.GOOGLE_PLACES_SERVER_KEY = 'secret-k'
    const calls: Call[] = []
    const d = await placeDetails(
      'p1',
      mockFetch(
        {
          ...raw,
          addressComponents: [{ longText: '苗栗縣', types: ['administrative_area_level_1'] }],
          googleMapsUri: 'https://maps.google.com/?cid=1',
          businessStatus: 'OPERATIONAL',
          nationalPhoneNumber: '037-123456',
          websiteUri: 'https://x.tw',
        },
        calls,
      ),
    )
    expect(calls[0]!.url).toBe('https://places.googleapis.com/v1/places/p1?languageCode=zh-TW&regionCode=TW')
    expect(headersOf(calls[0]!)['X-Goog-Api-Key']).toBe('secret-k')
    expect(headersOf(calls[0]!)['X-Goog-FieldMask']).toBe(
      'id,displayName,formattedAddress,location,addressComponents,googleMapsUri,businessStatus,nationalPhoneNumber,websiteUri',
    )
    expect(d).toMatchObject({
      placeId: 'p1',
      name: '山中營地',
      phone: '037-123456',
      website: 'https://x.tw',
      mapsUrl: 'https://maps.google.com/?cid=1',
      addressComponents: [{ longText: '苗栗縣', types: ['administrative_area_level_1'] }],
    })
  })

  // 為什麼：placeId 來自使用者輸入，不能讓 ../ 之類跳出 places/ 路徑
  it('placeId 會 encode', async () => {
    const calls: Call[] = []
    await placeDetails('a/../b', mockFetch({ ...raw, googleMapsUri: 'u' }, calls))
    expect(calls[0]!.url).toContain('places/a%2F..%2Fb?')
  })
})
