import { describe, expect, it, vi } from 'vitest'
import { withAuthTimeout } from './authFetchTimeout'

// supabase-js 的 token 更新會拿著 auth 鎖等 fetch；手機從背景回來時 fetch 可能永遠不結束，
// 之後所有 getSession／資料請求都跟著卡住。只對 /auth/v1/ 加逾時，讓它失敗後由 supabase-js 重試。
describe('withAuthTimeout', () => {
  const hanging = vi.fn((_url: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((_res, rej) => init?.signal?.addEventListener('abort', () => rej(init.signal!.reason))))

  it('auth 請求卡住會在逾時後丟錯，而不是永遠等', async () => {
    vi.useFakeTimers()
    const f = withAuthTimeout(hanging, 15000)
    const p = f('https://x.supabase.co/auth/v1/token?grant_type=refresh_token', {})
    const assertion = expect(p).rejects.toThrow(/timeout/i)
    await vi.advanceTimersByTimeAsync(15000)
    await assertion
    vi.useRealTimers()
  })

  it('非 auth 請求不加逾時（例如資料查詢、上傳可以比較慢）', async () => {
    const ok = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response('{}'))
    const f = withAuthTimeout(ok, 15000)
    await f('https://x.supabase.co/rest/v1/camping_trips', {})
    expect(ok.mock.calls[0]![1]).toEqual({})
  })

  it('呼叫端自己的 abort 仍然有效', async () => {
    const f = withAuthTimeout(hanging, 15000)
    const ac = new AbortController()
    const p = f('https://x.supabase.co/auth/v1/user', { signal: ac.signal })
    ac.abort(new Error('caller aborted'))
    await expect(p).rejects.toThrow('caller aborted')
  })

  it('auth 請求正常回應時照常回傳', async () => {
    const ok = vi.fn(async () => new Response('{"ok":true}'))
    const r = await withAuthTimeout(ok, 15000)('https://x.supabase.co/auth/v1/token', {})
    expect(await r.json()).toEqual({ ok: true })
  })
})
