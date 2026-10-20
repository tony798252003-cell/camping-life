import { describe, it, expect } from 'vitest'
import { mergeGemini, researchCampsite, HIGH_RISK_FIELDS } from './gemini.js'
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

// 為什麼：營位類型和訂位規則一旦錯了，要到現場才會發現（規格 §5.7）
describe('mergeGemini', () => {
  const base = () => placeToDraft(detail(), 1200)
  const hi = (value: unknown, sources = ['https://x']) => ({ value, confidence: 'high' as const, sources })

  it('高風險欄位即使 high 且有來源也要 needsReview — AI 錯了到現場才發現', () => {
    const d = mergeGemini(base(), { spot_types: hi(['雨棚']) })
    expect(d.fields.spot_types).toMatchObject({ value: ['雨棚'], source: 'gemini', needsReview: true, urls: ['https://x'] })
  })

  it('check_in_time 即使 high 且有來源也 needsReview — 平日假日常不同', () => {
    expect(mergeGemini(base(), { check_in_time: hi('14:00') }).fields.check_in_time.needsReview).toBe(true)
    expect(HIGH_RISK_FIELDS).toContain('amenities')
  })

  it('一般欄位 high＋有來源才免檢查；沒來源就 needsReview — 無法查證的 AI 內容不能當事實', () => {
    expect(mergeGemini(base(), { water_features: hi(['溪流']) }).fields.water_features.needsReview).toBe(false)
    expect(mergeGemini(base(), { water_features: hi(['溪流'], []) }).fields.water_features.needsReview).toBe(true)
  })

  it('不在選項清單的標籤被濾掉 — 否則篩選器會出現無法選取的值', () => {
    const d = mergeGemini(base(), { scenery_features: hi(['雲海', '超美夕陽']) })
    expect(d.fields.scenery_features.value).toEqual(['雲海'])
  })

  it('濾完變空陣列視為查無資料 — 不能把「不知道」存成「沒有」', () => {
    const f = mergeGemini(base(), { scenery_features: hi(['超美夕陽']) }).fields.scenery_features
    expect(f).toMatchObject({ value: null, confidence: 'none', needsReview: true })
  })

  it('Places 已有 phone 時 Gemini 的 phone 不覆蓋 — Google 結構化資料較可信', () => {
    const d = mergeGemini(base(), { phone: hi('0999') })
    expect(d.fields.phone).toMatchObject({ value: '03 123 4567', source: 'places' })
  })

  it('confidence none → value null、needsReview true', () => {
    const d = mergeGemini(base(), { night_rush_time: { value: '21:00', confidence: 'none', sources: [] } })
    expect(d.fields.night_rush_time).toMatchObject({ value: null, needsReview: true })
  })

  it('ai_summary 寫進 campsite_notes 且一律 needsReview — 規格 §5.7', () => {
    const d = mergeGemini(base(), { ai_summary: hi('- 山路：查無資料') })
    expect(d.fields.campsite_notes).toMatchObject({ value: '- 山路：查無資料', needsReview: true })
  })

  it('amenities 只保留布林欄位 — 防止模型塞入未知結構', () => {
    const d = mergeGemini(base(), { amenities: hi({ has_fridge: true, has_pool: true, has_freezer: 'yes' }) })
    expect(d.fields.amenities.value).toEqual({ has_fridge: true })
  })
})

describe('Gemini 來源網址 scheme', () => {
  // 為什麼：來源網址會被前端渲染成 <a href>，javascript: 會變成 XSS
  it('只保留 http(s) 絕對網址，擋 javascript:、data:、相對路徑', async () => {
    process.env.GEMINI_MODEL = 'm'
    process.env.GEMINI_API_KEY = 'k'
    const text = JSON.stringify({
      water_features: {
        value: ['溪流'],
        confidence: 'high',
        sources: ['javascript:alert(1)', 'data:text/html,x', '/relative', 'https://ok.example/a', 'http://ok.example/b'],
      },
    })
    const f = (async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: { parts: [{ text }] },
            groundingMetadata: { groundingChunks: [{ web: { uri: 'javascript:1' } }, { web: { uri: 'https://g.example/c' } }] },
          },
        ],
      }),
    })) as unknown as typeof fetch
    const r = await researchCampsite({ name: 'n', address: 'a', mapsUrl: 'https://maps.google.com/?cid=1' }, f)
    expect(r.water_features!.sources).toEqual(['https://ok.example/a', 'http://ok.example/b', 'https://g.example/c'])
  })

  it('網路錯誤轉成 HttpError 502 — 不洩漏底層訊息', async () => {
    process.env.GEMINI_MODEL = 'm'
    process.env.GEMINI_API_KEY = 'k'
    const f = (async () => { throw new TypeError('secret') }) as unknown as typeof fetch
    await expect(researchCampsite({ name: 'n', address: 'a', mapsUrl: 'u' }, f)).rejects.toMatchObject({ status: 502 })
  })

  it('mergeGemini 忽略直接回傳的 campsite_notes 鍵 — 只有 ai_summary 可寫入摘要', () => {
    const d = mergeGemini(placeToDraft(detail(), 1), { campsite_notes: { value: 'x', confidence: 'high', sources: [] } })
    expect(d.fields.campsite_notes).toBeUndefined()
  })
})

describe('handleCampsiteDraft baseDraft', () => {
  // 為什麼：第二段只該跑 Gemini，Place Details 重打一次是多花一次 Google 費用
  it('帶相符的 baseDraft 時不再呼叫 Places', async () => {
    process.env.GEMINI_MODEL = 'm'
    process.env.GEMINI_API_KEY = 'k'
    const base = placeToDraft(detail(), 1200)
    const urls: string[] = []
    const f = (async (u: string) => {
      urls.push(String(u))
      return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: '{}' }] } }] }) }
    }) as unknown as typeof fetch
    const res = await handleCampsiteDraft(
      new Request('http://x/api/campsite-draft', { method: 'POST', body: JSON.stringify({ placeId: base.placeId, baseDraft: base }) }),
      { fetchImpl: f },
    )
    expect(res.status).toBe(200)
    expect(urls.some((u) => u.includes('places.googleapis.com'))).toBe(false)
    expect(urls.some((u) => u.includes('generativelanguage'))).toBe(true)
  })
})

describe('researchCampsite', () => {
  const input = { name: '雲頂', address: 'a', mapsUrl: 'https://maps.google.com/?cid=1' }
  const okFetch = (text: string, uris: string[] = []) =>
    (async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          { content: { parts: [{ text }] }, groundingMetadata: { groundingChunks: uris.map((uri) => ({ web: { uri } })) } },
        ],
      }),
    })) as unknown as typeof fetch

  it('沒設 GEMINI_MODEL 直接 throw — 不寫死模型名，設定錯誤要大聲失敗', async () => {
    delete process.env.GEMINI_MODEL
    process.env.GEMINI_API_KEY = 'k'
    await expect(researchCampsite(input, okFetch('{}'))).rejects.toThrow('GEMINI_MODEL')
  })

  it('key 放 header、啟用 google_search、grounding 來源合併進有值欄位 — key 不能出現在網址', async () => {
    process.env.GEMINI_MODEL = 'm1'
    process.env.GEMINI_API_KEY = 'secret'
    let seen: { url: string; init: RequestInit } | undefined
    const f = (async (url: string, init: RequestInit) => {
      seen = { url, init }
      return okFetch('```json\n{"water_features":{"value":["溪流"],"confidence":"high","sources":["https://a"]},"spot_types":{"value":null,"confidence":"none","sources":[]}}\n```', ['https://g'])('')
    }) as unknown as typeof fetch
    const r = await researchCampsite(input, f)
    expect(seen?.url).toContain('/m1:generateContent')
    expect(seen?.url).not.toContain('secret')
    expect((seen?.init.headers as Record<string, string>)['x-goog-api-key']).toBe('secret')
    expect(JSON.parse(String(seen?.init.body)).tools).toEqual([{ google_search: {} }])
    expect(r.water_features.sources).toEqual(['https://a', 'https://g'])
    expect(r.spot_types.sources).toEqual([])
  })

  it('回傳不是 JSON 時 throw — 交給呼叫端降級成 Places 草稿', async () => {
    process.env.GEMINI_MODEL = 'm1'
    await expect(researchCampsite(input, okFetch('抱歉查不到'))).rejects.toThrow()
  })
})

describe('handleCampsiteDraft + Gemini', () => {
  const post = (b: unknown) => new Request('http://x/api/campsite-draft', { method: 'POST', body: JSON.stringify(b) })
  const rawDetail = {
    id: 'pid1',
    displayName: { text: '雲頂露營區' },
    formattedAddress: 'a',
    location: { latitude: 24.6, longitude: 121.2 },
    addressComponents: [],
    googleMapsUri: 'https://maps.google.com/?cid=1',
  }
  const mk = (gemini: () => Promise<unknown>) =>
    (async (u: string) => {
      if (String(u).includes('generativelanguage')) return gemini()
      if (String(u).includes('open-meteo')) return { ok: true, status: 200, json: async () => ({ elevation: [100] }) }
      return { ok: true, status: 200, json: async () => rawDetail }
    }) as unknown as typeof fetch

  it('Gemini 失敗仍回 200 且 warnings 含 gemini_failed — Places 資料不能因 AI 掛掉而丟失', async () => {
    process.env.GEMINI_MODEL = 'm1'
    process.env.GEMINI_API_KEY = 'k'
    const res = await handleCampsiteDraft(post({ placeId: 'pid1' }), {
      fetchImpl: mk(async () => { throw new Error('timeout') }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { warnings: string[]; fields: { altitude: { value: number } } }
    expect(body.warnings).toContain('gemini_failed')
    expect(body.fields.altitude.value).toBe(100)
  })

  it('skipAi 完全不呼叫 Gemini — 山上訊號差時要能先存基本資料', async () => {
    let called = false
    const res = await handleCampsiteDraft(post({ placeId: 'pid1', skipAi: true }), {
      fetchImpl: mk(async () => { called = true; return {} }),
    })
    expect(res.status).toBe(200)
    expect(called).toBe(false)
  })
})
