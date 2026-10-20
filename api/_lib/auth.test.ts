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
