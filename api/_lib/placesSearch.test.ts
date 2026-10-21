import { describe, it, expect, beforeEach } from 'vitest'
import { placesSearch } from './placesSearch.js'
import { requireUser } from './auth.js'
import { HttpError } from './http.js'

const post = (body: unknown, auth?: string) =>
  new Request('http://x/api/places-search', {
    method: 'POST',
    headers: auth ? { Authorization: auth } : {},
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })

const six = Array.from({ length: 6 }, (_, i) => ({
  id: `p${i}`,
  displayName: { text: `n${i}` },
  formattedAddress: 'a',
  location: { latitude: 1, longitude: 2 },
}))
const fetchOk = (async () => ({ ok: true, status: 200, json: async () => ({ places: six }) })) as unknown as typeof fetch

async function statusOf(p: Promise<unknown>) {
  try {
    await p
  } catch (e) {
    if (e instanceof HttpError) return e.status
    throw e
  }
  return 200
}

describe('placesSearch', () => {
  beforeEach(() => {
    process.env.GOOGLE_PLACES_SERVER_KEY = 'k'
  })
  // 為什麼：空字串送去 Google 會白白扣額度
  it('query 為空或只有空白回 400', async () => {
    expect(await statusOf(placesSearch(post({ query: '' }), fetchOk))).toBe(400)
    expect(await statusOf(placesSearch(post({ query: '   ' }), fetchOk))).toBe(400)
  })
  // 為什麼：限制長度避免被拿來塞超長字串
  it('query 超過 100 字回 400，剛好 100 字可以', async () => {
    expect(await statusOf(placesSearch(post({ query: 'a'.repeat(101) }), fetchOk))).toBe(400)
    expect(await statusOf(placesSearch(post({ query: 'a'.repeat(100) }), fetchOk))).toBe(200)
  })
  // 為什麼：body 不是 JSON 或 query 不是字串時也要是 400，不是 500
  it('body 壞掉或 query 非字串回 400', async () => {
    expect(await statusOf(placesSearch(post('not json'), fetchOk))).toBe(400)
    expect(await statusOf(placesSearch(post({ query: 5 }), fetchOk))).toBe(400)
  })
  // 為什麼：規格 §7.2 規定最多 5 個候選（Google 預設可能回更多）
  it('最多回 5 筆候選', async () => {
    const res = await placesSearch(post({ query: '營地' }), fetchOk)
    const body = (await res.json()) as { candidates: unknown[] }
    expect(res.status).toBe(200)
    expect(body.candidates).toHaveLength(5)
  })
  // 為什麼：endpoint 是 requireUser → placesSearch；沒有 auth 一定要先被擋下，不能打到 Google
  it('沒有 Authorization 時 requireUser 回 401（endpoint 的第一道）', async () => {
    expect(await statusOf(requireUser(post({ query: 'x' }), { getUser: async () => ({ id: 'u' }) }))).toBe(401)
  })
})
