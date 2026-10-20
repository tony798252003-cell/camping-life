import { describe, it, expect, vi, beforeEach } from 'vitest'

// 用記憶體陣列假裝資料表，才能驗證「呼叫之後再 list 看得到」
const table: any[] = []
const insert = vi.fn(async (rows: any[]) => {
  table.push(...rows)
  return { error: null }
})

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => ({ order: async () => ({ data: [...table], error: null }) }),
      }),
      insert,
    }),
  },
}))

import { categoryQueries } from './categories'

beforeEach(() => {
  table.length = 0
  insert.mockClear()
})

describe('categoryQueries.ensureDefaults', () => {
  // 為什麼：新帳號沒有分類時畫面不能是空的，需要 5 個預設（露營、棒球、工作、家庭、個人）
  it('沒有任何分類 -> insert 5 筆', async () => {
    await categoryQueries.ensureDefaults()
    expect(insert).toHaveBeenCalledTimes(1)
    expect(insert.mock.calls[0]![0]).toHaveLength(5)
    expect(insert.mock.calls[0]![0].map((r: any) => r.system_key)).toEqual(['camping', 'baseball', 'work', 'family', 'personal'])
  })

  // 為什麼：使用者刪掉「工作」後只剩 4 筆，不能因為補齊而把它加回來（也會撞 unique(owner_id,name)）
  it('已有任一分類（刪掉工作後剩 4 筆）-> 不 insert', async () => {
    table.push({ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' })
    await categoryQueries.ensureDefaults()
    expect(insert).not.toHaveBeenCalled()
  })

  // 為什麼：每次載入都會呼叫，第二次一定要是 no-op，否則每次開啟都重複建立
  it('連續呼叫兩次只 insert 一次', async () => {
    await categoryQueries.ensureDefaults()
    await categoryQueries.ensureDefaults()
    expect(insert).toHaveBeenCalledTimes(1)
  })
})
