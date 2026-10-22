import type { FamilyListItem } from '../types/database'

// App 只使用這一張清單（依標題找）；家庭沒有時才建立
export const TODO_LIST_TITLE = '家庭待辦'

export const todoListRow = (familyId: string) => ({ family_id: familyId, title: TODO_LIST_TITLE, sort_order: 0 })

export const pickTodoList = <T extends { title: string }>(lists: T[]): T | undefined =>
  lists.find((l) => l.title === TODO_LIST_TITLE)

type ItemLike = Pick<FamilyListItem, 'done' | 'done_at' | 'important' | 'sort_order' | 'created_at'>

const byOrder = (a: ItemLike, b: ItemLike) =>
  a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at)

// 重要的排前面，其餘維持原順序（舊→新）；首頁只顯示前 3 項，重要事項不能被擠到「全部」裡看不到
const byImportantThenOrder = (a: ItemLike, b: ItemLike) => Number(!!b.important) - Number(!!a.important) || byOrder(a, b)

// 未完成重要優先、再依新增順序；已完成最近勾的在最上面（剛勾錯時一眼找得到、可取消）
export const groupItems = <T extends ItemLike>(items: T[]): { open: T[]; done: T[] } => ({
  open: items.filter((i) => !i.done).sort(byImportantThenOrder),
  done: items
    .filter((i) => i.done)
    .sort((a, b) => (b.done_at ?? '').localeCompare(a.done_at ?? '') || byOrder(a, b)),
})

export const openCount = (items: Pick<FamilyListItem, 'done'>[]) => items.filter((i) => !i.done).length

// 新項目排在最後；用 max+1 而非 length，刪掉中間項目後也不會與既有的撞號
export const nextSortOrder = (items: Pick<FamilyListItem, 'sort_order'>[]) =>
  items.reduce((m, i) => Math.max(m, i.sort_order), -1) + 1
