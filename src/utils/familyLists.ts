import type { FamilyListItem } from '../types/database'

// 家庭沒有任何清單時才建立（順序即 sort_order）
export const DEFAULT_LIST_TITLES = ['採買', '露營要帶', '家裡待辦'] as const

export const defaultListRows = (familyId: string) =>
  DEFAULT_LIST_TITLES.map((title, i) => ({ family_id: familyId, title, sort_order: i }))

type ItemLike = Pick<FamilyListItem, 'done' | 'done_at' | 'sort_order' | 'created_at'>

const byOrder = (a: ItemLike, b: ItemLike) =>
  a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at)

// 未完成依新增順序；已完成最近勾的在最上面（剛勾錯時一眼找得到、可取消）
export const groupItems = <T extends ItemLike>(items: T[]): { open: T[]; done: T[] } => ({
  open: items.filter((i) => !i.done).sort(byOrder),
  done: items
    .filter((i) => i.done)
    .sort((a, b) => (b.done_at ?? '').localeCompare(a.done_at ?? '') || byOrder(a, b)),
})

export const openCount = (items: Pick<FamilyListItem, 'done'>[]) => items.filter((i) => !i.done).length

// 新項目排在最後；用 max+1 而非 length，刪掉中間項目後也不會與既有的撞號
export const nextSortOrder = (items: Pick<FamilyListItem, 'sort_order'>[]) =>
  items.reduce((m, i) => Math.max(m, i.sort_order), -1) + 1
