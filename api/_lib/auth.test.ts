import { describe, it, expect } from 'vitest'
import { requireUser } from './auth.js'
import { HttpError } from './http.js'

const req = (authorization?: string) =>
  new Request('http://x/api/y', {
    method: 'POST',
    headers: authorization ? { Authorization: authorization } : {},
  })

async function statusOf(p: Promise<unknown>) {
  try {
    await p
  } catch (e) {
    if (e instanceof HttpError) return e.status
    throw e
  }
  return 200
}

// 為什麼：這是防止外人用光 Places/Gemini 額度的唯一防線
describe('requireUser', () => {
  it('沒帶 Authorization 回 401', async () => {
    expect(await statusOf(requireUser(req(), { getUser: async () => ({ id: 'u1' }) }))).toBe(401)
  })
  it('Authorization 不是 Bearer 格式回 401', async () => {
    expect(await statusOf(requireUser(req('Basic abc'), { getUser: async () => ({ id: 'u1' }) }))).toBe(401)
  })
  // 為什麼：RFC 7235 規定 scheme 不分大小寫；原本 'bearer x' 會被誤擋成 401，空 token 也不能放行
  it('scheme 大小寫不拘、多空白可接受；空 token 仍 401', async () => {
    const getUser = async (t: string) => ({ id: `u-${t}` })
    await expect(requireUser(req('bearer tok'), { getUser })).resolves.toEqual({ userId: 'u-tok' })
    await expect(requireUser(req('BEARER   tok'), { getUser })).resolves.toEqual({ userId: 'u-tok' })
    expect(await statusOf(requireUser(req('Bearer '), { getUser }))).toBe(401)
    expect(await statusOf(requireUser(req('Bearer a b'), { getUser }))).toBe(401)
  })
  it('token 無效（getUser 回 null）回 401', async () => {
    expect(await statusOf(requireUser(req('Bearer t'), { getUser: async () => null }))).toBe(401)
  })
  it('getUser 丟例外時回 401，不是 500', async () => {
    const getUser = async () => { throw new Error('network') }
    expect(await statusOf(requireUser(req('Bearer t'), { getUser }))).toBe(401)
  })
  it('合法 token 回 userId', async () => {
    await expect(requireUser(req('Bearer t'), { getUser: async () => ({ id: 'u1' }) })).resolves.toEqual({ userId: 'u1' })
  })
})
