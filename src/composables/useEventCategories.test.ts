import { describe, it, expect, vi } from 'vitest'

const rows = [
  { id: 'a', name: 'A', color: '#000', sort_order: 0, created_at: '2026-01-01' },
  { id: 'b', name: 'B', color: '#000', sort_order: 1, created_at: '2026-01-02' },
]
vi.mock('../services/db/categories', () => ({
  categoryQueries: {
    list: vi.fn(async () => rows),
    ensureDefaults: vi.fn(),
    update: vi.fn(async () => {}),
  },
}))

import { useEventCategories } from './useEventCategories'

describe('useEventCategories.update', () => {
  it('re-sorts after sort_order changes, because the UI renders in array order (move up/down must be visible)', async () => {
    const { categories, load, update } = useEventCategories()
    await load()
    expect(categories.value.map((c) => c.id)).toEqual(['a', 'b'])
    await update('b', { sort_order: 0 })
    await update('a', { sort_order: 1 })
    expect(categories.value.map((c) => c.id)).toEqual(['b', 'a'])
  })
})
