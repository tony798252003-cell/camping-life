import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { isOwnRow, tripScopeFilter, buildInviteLink, normalizeJoinCode, savePendingJoinCode, takePendingJoinCode, PENDING_TTL_MS } from './familyJourney'

describe('isOwnRow', () => {
  // RLS 只允許刪自己的列；顯示刪除鈕會讓家人按了卻靜默刪 0 筆
  it('只有擁有者為 true，缺值一律 false', () => {
    expect(isOwnRow('a', 'a')).toBe(true)
    expect(isOwnRow('a', 'b')).toBe(false)
    expect(isOwnRow(null, 'b')).toBe(false)
    expect(isOwnRow('a', undefined)).toBe(false)
  })
})

describe('tripScopeFilter', () => {
  // 只用 family_id 會漏掉加入家庭前自己建立（family_id 為 null）的行程
  it('有家庭時自己 + 家庭，沒有家庭只有自己', () => {
    expect(tripScopeFilter('u', 'f')).toBe('user_id.eq.u,family_id.eq.f')
    expect(tripScopeFilter('u', null)).toBe('user_id.eq.u')
  })
})

describe('invite link', () => {
  it('組出 /join?code= 並可被 normalize 還原', () => {
    const link = buildInviteLink('https://x.app', 'ab12')
    expect(link).toBe('https://x.app/join?code=ab12')
    expect(normalizeJoinCode(new URL(link).searchParams.get('code'))).toBe('AB12')
  })
  it('normalize 處理陣列、非字串與超長', () => {
    expect(normalizeJoinCode([' ab ', 'x'])).toBe('AB')
    expect(normalizeJoinCode(undefined)).toBe('')
    expect(normalizeJoinCode('a'.repeat(50))).toHaveLength(32)
  })
})

describe('pending join code TTL', () => {
  const store = new Map<string, string>()
  beforeEach(() => {
    store.clear()
    vi.stubGlobal('sessionStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  // 過期的邀請碼不該在很久以後登入時突然跳出來
  it('30 分鐘內取得，超過則忽略，且取用後即清除', () => {
    savePendingJoinCode('ab12', 1000)
    expect(takePendingJoinCode(1000 + PENDING_TTL_MS)).toBe('AB12')
    expect(takePendingJoinCode(1000 + PENDING_TTL_MS)).toBe('')
    savePendingJoinCode('ab12', 1000)
    expect(takePendingJoinCode(1000 + PENDING_TTL_MS + 1)).toBe('')
  })
  it('相容舊格式純字串', () => {
    store.set('pendingJoinCode', 'xy9')
    expect(takePendingJoinCode()).toBe('XY9')
  })
})
