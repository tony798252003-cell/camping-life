// 第二位家人（非資料建立者）的流程用到的純邏輯

// 只有擁有者能刪行程 / 照片（RLS 只允許刪自己的），其他人不顯示刪除鈕
export const isOwnRow = (rowUserId: string | null | undefined, userId: string | null | undefined): boolean =>
  !!rowUserId && !!userId && rowUserId === userId

// 行程範圍：自己的 + 同家庭的（RLS 本來就只放行這兩種；家庭建立前的舊行程 family_id 為 null，只靠 user_id 才找得到）
export const tripScopeFilter = (userId: string, familyId?: string | null): string =>
  familyId ? `user_id.eq.${userId},family_id.eq.${familyId}` : `user_id.eq.${userId}`

export const buildInviteLink = (origin: string, code: string): string =>
  `${origin}/join?code=${encodeURIComponent(code)}`

// 邀請連結的 code 來自網址，統一成大寫去空白；沒有就回空字串
export const normalizeJoinCode = (raw: unknown): string => {
  const v = Array.isArray(raw) ? raw[0] : raw
  return typeof v === 'string' ? v.trim().toUpperCase().slice(0, 32) : ''
}

// 登入前被導去 /auth 時暫存要回去的邀請連結（OAuth 會整頁跳轉，只能放 sessionStorage）
const PENDING_KEY = 'pendingJoinCode'
export const savePendingJoinCode = (code: string): void => {
  try { sessionStorage.setItem(PENDING_KEY, code) } catch { /* 私密模式等：退回手動輸入 */ }
}
export const takePendingJoinCode = (): string => {
  try {
    const v = sessionStorage.getItem(PENDING_KEY) ?? ''
    sessionStorage.removeItem(PENDING_KEY)
    return normalizeJoinCode(v)
  } catch {
    return ''
  }
}
