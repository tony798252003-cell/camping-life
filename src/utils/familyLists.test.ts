import { describe, it, expect } from 'vitest'
import { groupItems, nextSortOrder, openCount, pickTodoList, todoListRow } from './familyLists'

const it_ = (o: { id: string; done?: boolean; important?: boolean; done_at?: string | null; sort_order?: number; created_at?: string }) => ({
  done: false, done_at: null, important: false, sort_order: 0, created_at: '2026-10-22T00:00:00Z', ...o,
})

describe('groupItems', () => {
  it('未完成依 sort_order，同序再依建立時間', () => {
    // 兩人同時新增可能拿到同一個 sort_order；沒有第二排序鍵，畫面順序會在重新載入後跳動
    const g = groupItems([
      it_({ id: 'c', sort_order: 1 }),
      it_({ id: 'b', sort_order: 0, created_at: '2026-10-22T00:00:02Z' }),
      it_({ id: 'a', sort_order: 0, created_at: '2026-10-22T00:00:01Z' }),
    ])
    expect(g.open.map((i) => i.id)).toEqual(['a', 'b', 'c'])
  })
  it('重要的排在較舊的前面，同為重要或同為一般則維持原順序', () => {
    // 首頁只顯示前 3 項；重要事項若輸給較舊的一般項目就會被擠掉，星號就失去意義
    const g = groupItems([
      it_({ id: 'old', sort_order: 0 }),
      it_({ id: 'star2', sort_order: 2, important: true }),
      it_({ id: 'mid', sort_order: 1 }),
      it_({ id: 'star1', sort_order: 1, important: true }),
    ])
    expect(g.open.map((i) => i.id)).toEqual(['star1', 'star2', 'old', 'mid'])
  })
  it('important 欄位缺值（例如 migration 前或 realtime 舊列）時當成不重要，排序仍正確', () => {
    // Number(undefined) 是 NaN，NaN 會讓比較函式失效、重要項目排不到前面（本機 QA 實際遇到）
    const g = groupItems([
      it_({ id: 'old', sort_order: 0, important: undefined as unknown as boolean }),
      it_({ id: 'star', sort_order: 2, important: true }),
    ])
    expect(g.open.map((i) => i.id)).toEqual(['star', 'old'])
  })
  it('已完成項目不受重要標記影響', () => {
    // 已完成區照「最近勾的在前」才能馬上取消誤勾；星號不該改變這個順序
    const g = groupItems([
      it_({ id: 'x', done: true, important: true, done_at: '2026-10-22T01:00:00Z' }),
      it_({ id: 'y', done: true, done_at: '2026-10-22T02:00:00Z' }),
    ])
    expect(g.done.map((i) => i.id)).toEqual(['y', 'x'])
  })
  it('已完成與未完成分開，已完成最近勾的在前', () => {
    // 剛誤勾的項目必須在已完成區最上面，才能馬上取消
    const g = groupItems([
      it_({ id: 'x', done: true, done_at: '2026-10-22T01:00:00Z' }),
      it_({ id: 'y', done: true, done_at: '2026-10-22T02:00:00Z' }),
      it_({ id: 'z' }),
    ])
    expect(g.open.map((i) => i.id)).toEqual(['z'])
    expect(g.done.map((i) => i.id)).toEqual(['y', 'x'])
  })
  it('不改動傳入陣列', () => {
    // 來源是 Vue 的 reactive 陣列，就地排序會觸發多餘的重繪與 realtime 順序錯亂
    const src = [it_({ id: 'b', sort_order: 1 }), it_({ id: 'a', sort_order: 0 })]
    groupItems(src)
    expect(src.map((i) => i.id)).toEqual(['b', 'a'])
  })
})

describe('openCount', () => {
  it('只算未完成', () => {
    // 首頁「未完成 N 項」；把已完成也算進去會讓清單永遠清不到 0
    expect(openCount([{ done: false }, { done: true }, { done: false }])).toBe(2)
    expect(openCount([])).toBe(0)
  })
})

describe('nextSortOrder', () => {
  it('排在最後，刪除中間項目後不撞號', () => {
    expect(nextSortOrder([])).toBe(0)
    expect(nextSortOrder([{ sort_order: 0 }, { sort_order: 2 }])).toBe(3)
  })
})

describe('todoListRow', () => {
  it('只建立「家庭待辦」並帶家庭 id', () => {
    // family_id 帶錯會被 RLS WITH CHECK 擋掉，建立失敗
    expect(todoListRow('f1')).toEqual({ family_id: 'f1', title: '家庭待辦', sort_order: 0 })
  })
})

describe('pickTodoList', () => {
  it('只認標題「家庭待辦」，忽略其他舊清單', () => {
    // 舊資料可能還有 採買／露營要帶 等空清單；挑錯清單會讓新增的項目看不見
    const lists = [{ id: 'a', title: '採買' }, { id: 'b', title: '家庭待辦' }, { id: 'c', title: '露營要帶' }]
    expect(pickTodoList(lists)?.id).toBe('b')
    expect(pickTodoList([{ id: 'a', title: '採買' }])).toBeUndefined()
  })
})
