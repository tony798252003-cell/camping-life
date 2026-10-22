import { describe, expect, it, vi } from 'vitest'
import { authGuardTarget } from './authGuard'

// 路由守門只依「記憶體中的登入狀態」決定導向，不呼叫 supabase.auth.getSession()：
// getSession 會跟背景的 token 更新搶同一把鎖，更新卡住時切 tab 會整個沒反應（2026-10-22 使用者回報）。
describe('authGuardTarget', () => {
  const none = () => ''

  it('未登入去非登入頁 → 導去登入，並記下邀請碼', () => {
    const save = vi.fn()
    const r = authGuardTarget({ name: 'settings', query: { view: 'family', code: 'ab12cd' } }, false, { save, take: none })
    expect(r).toEqual({ name: 'auth' })
    expect(save).toHaveBeenCalledWith('AB12CD')
  })

  it('未登入去一般頁 → 導去登入，不記邀請碼', () => {
    const save = vi.fn()
    expect(authGuardTarget({ name: 'calendar', query: {} }, false, { save, take: none })).toEqual({ name: 'auth' })
    expect(save).not.toHaveBeenCalled()
  })

  it('已登入切一般 tab → 直接放行（true）', () => {
    expect(authGuardTarget({ name: 'calendar', query: {} }, true, { save: vi.fn(), take: none })).toBe(true)
  })

  it('已登入回首頁且有待加入的邀請碼 → 導去家庭成員並帶碼', () => {
    const r = authGuardTarget({ name: 'home', query: {} }, true, { save: vi.fn(), take: () => 'AB12CD' })
    expect(r).toEqual({ name: 'settings', query: { view: 'family', code: 'AB12CD' } })
  })

  it('已登入卻在登入頁 → 回首頁', () => {
    expect(authGuardTarget({ name: 'auth', query: {} }, true, { save: vi.fn(), take: none })).toEqual({ name: 'home' })
  })

  it('未登入在登入頁 → 放行（不能無限導向）', () => {
    expect(authGuardTarget({ name: 'auth', query: {} }, false, { save: vi.fn(), take: none })).toBe(true)
  })
})
