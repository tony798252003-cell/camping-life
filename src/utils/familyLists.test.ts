import { describe, it, expect } from 'vitest'
import { groupItems, nextSortOrder, openCount, pickTodoList, todoListRow } from './familyLists'

const it_ = (o: { id: string; done?: boolean; done_at?: string | null; sort_order?: number; created_at?: string }) => ({
  done: false, done_at: null, sort_order: 0, created_at: '2026-10-22T00:00:00Z', ...o,
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
