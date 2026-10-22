import { normalizeJoinCode } from '../utils/familyJourney'

type GuardRoute = { name?: unknown; query: Record<string, unknown> }
type NextTarget = true | { name: string; query?: Record<string, string> }

const joinSettingsRoute = (code: string): NextTarget => ({ name: 'settings', query: { view: 'family', ...(code ? { code } : {}) } })

// 依「是否已登入」決定導向；不碰網路、不碰 auth 鎖（見 authGuard.test.ts 開頭說明）
export function authGuardTarget(
  to: GuardRoute,
  hasSession: boolean,
  pending: { save: (code: string) => void; take: () => string },
): NextTarget {
  if (!hasSession) {
    if (to.name === 'auth') return true
    // 邀請連結未登入：記下邀請碼，登入（OAuth 整頁跳轉回首頁）後再導回
    if (to.name === 'settings' && to.query.view === 'family') pending.save(normalizeJoinCode(to.query.code))
    return { name: 'auth' }
  }
  if (to.name === 'auth' || to.name === 'home') {
    const code = pending.take()
    if (code) return joinSettingsRoute(code)
    if (to.name === 'auth') return { name: 'home' }
  }
  return true
}
