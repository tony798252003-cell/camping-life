import { ref, computed } from 'vue'
import { categoryQueries } from '../services/db/categories'
import type { EventCategory } from '../types/database'
import { useNotification } from './useNotification'

const categories = ref<EventCategory[]>([])
const bySystemKey = computed(() => {
  const map: Record<string, EventCategory> = {}
  for (const c of categories.value) if (c.system_key) map[c.system_key] = c
  return map
})
let loadPromise: Promise<void> | null = null

export function useEventCategories() {
  const { error: notifyError } = useNotification()

  // 同時多處呼叫只跑一次，避免 ensureDefaults 併發而重複 insert
  const load = () => {
    loadPromise ??= (async () => {
      try {
        let list = await categoryQueries.list()
        if (list.length === 0) {
          await categoryQueries.ensureDefaults()
          list = await categoryQueries.list()
        }
        categories.value = list
      } catch (e) {
        console.error('[useEventCategories] load error:', e)
        notifyError('無法載入分類')
      }
    })().finally(() => {
      loadPromise = null
    })
    return loadPromise
  }

  const create = async (name: string, color: string) => {
    const c = await categoryQueries.create(name, color)
    categories.value = [...categories.value, c]
    return c
  }

  const update = async (id: string, patch: { name?: string; color?: string; sort_order?: number }) => {
    await categoryQueries.update(id, patch)
    // 改 sort_order 後必須重排，否則畫面順序不會變（與 DB 的 sort_order, created_at 排序一致）
    categories.value = categories.value
      .map((c) => (c.id === id ? { ...c, ...patch } : c))
      .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at))
  }

  const remove = async (id: string) => {
    await categoryQueries.remove(id)
    categories.value = categories.value.filter((c) => c.id !== id)
  }

  const reset = () => {
    categories.value = []
  }

  return { categories, bySystemKey, load, create, update, remove, reset }
}
