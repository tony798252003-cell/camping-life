type FetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

// 只替 Supabase Auth（/auth/v1/）的請求加逾時，原因見 authFetchTimeout.test.ts 開頭
export function withAuthTimeout(fetchFn: FetchFn, ms: number): FetchFn {
  return (input, init = {}) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (!url.includes('/auth/v1/')) return fetchFn(input, init)

    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(new Error(`Supabase auth request timeout after ${ms}ms`)), ms)
    const outer = init.signal
    if (outer) {
      if (outer.aborted) ac.abort(outer.reason)
      else outer.addEventListener('abort', () => ac.abort(outer.reason), { once: true })
    }
    return fetchFn(input, { ...init, signal: ac.signal }).finally(() => clearTimeout(timer))
  }
}
