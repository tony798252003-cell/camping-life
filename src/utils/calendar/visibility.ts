// 事件可見性（F1 家庭共用行事曆）：DB visibility ↔ 畫面顏色／標籤／預設值。
export type Visibility = 'shared' | 'private'
export type Owner = 'family' | 'me'

export const OWNER_COLOR: Record<Owner, string> = { family: '#8E7DBE', me: '#4A9E9B' }
export const OWNER_LABEL: Record<Owner, string> = { family: '全家', me: '我' }

export const ownerOf = (visibility: string | null | undefined): Owner => (visibility === 'shared' ? 'family' : 'me')

// 露營、家庭分類預設全家；其他（含自訂分類、沒有分類）預設只有我
// 沒有家庭時一律只有我（沒有家人可分享）
export const defaultVisibility = (systemKey: string | null | undefined, hasFamily = true): Visibility =>
  hasFamily && (systemKey === 'camping' || systemKey === 'family') ? 'shared' : 'private'

// 使用者手動切換過就不再被「換分類」覆蓋
export function nextVisibility(i: {
  touched: boolean
  current: Visibility
  systemKey: string | null | undefined
  hasFamily?: boolean
}): Visibility {
  return i.touched ? i.current : defaultVisibility(i.systemKey, i.hasFamily)
}

// 只有「全家事件、建立者不是自己」才需要標示是誰新增的；名稱查不到時用「家人」
export function creatorNameFor(
  e: { visibility: string | null; created_by: string | null },
  meId: string | null,
  names: Map<string, string>,
): string | undefined {
  if (e.visibility !== 'shared' || !e.created_by || e.created_by === meId) return undefined
  return names.get(e.created_by) || '家人'
}
