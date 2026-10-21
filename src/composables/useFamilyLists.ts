import { computed, ref } from 'vue'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { listQueries } from '../services/db/lists'
import type { FamilyList, FamilyListItem } from '../types/database'
import { groupItems, nextSortOrder, openCount } from '../utils/familyLists'
import { useAuth } from './useAuth'
import { useNotification } from './useNotification'
import { useUserProfile } from './useUserProfile'

// 模組層級 ref（singleton）：登出時 reset()
const lists = ref<FamilyList[]>([])
const items = ref<FamilyListItem[]>([])
const loaded = ref(false)
let channel: RealtimeChannel | null = null
// 同一時間只跑一次 load，避免首頁與清單頁同時進來時重複建立預設清單
let inflight: Promise<void> | null = null

const upsertRow = <T extends { id: string }>(arr: T[], row: T) => {
  const i = arr.findIndex((r) => r.id === row.id)
  return i === -1 ? [...arr, row] : arr.map((r, j) => (j === i ? row : r))
}

export function useFamilyLists() {
  const { familyId } = useUserProfile()
  const { session } = useAuth()
  const { error: notifyError } = useNotification()

  const subscribe = (fid: string) => {
    if (channel) return
    // items 沒有 family_id 欄位無法 filter；realtime 會套用 RLS，只會收到自己家庭的變更
    channel = supabase
      .channel(`family-lists-${fid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'family_lists', filter: `family_id=eq.${fid}` }, (p) => {
        if (p.eventType === 'DELETE') {
          const id = (p.old as { id?: string }).id
          lists.value = lists.value.filter((l) => l.id !== id)
          items.value = items.value.filter((i) => i.list_id !== id)
        } else {
          lists.value = upsertRow(lists.value, p.new as FamilyList)
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'family_list_items' }, (p) => {
        if (p.eventType === 'DELETE') {
          const id = (p.old as { id?: string }).id
          items.value = items.value.filter((i) => i.id !== id)
        } else {
          items.value = upsertRow(items.value, p.new as FamilyListItem)
        }
      })
      .subscribe()
  }

  const unsubscribe = () => {
    if (channel) {
      supabase.removeChannel(channel)
      channel = null
    }
  }

  const run = async () => {
    const fid = familyId()
    if (!fid) {
      lists.value = []
      items.value = []
      loaded.value = true
      return
    }
    try {
      let l = await listQueries.listLists()
      if (l.length === 0) {
        await listQueries.createDefaults(fid)
        l = await listQueries.listLists()
      }
      lists.value = l
      items.value = await listQueries.listItems()
      subscribe(fid)
    } catch (e) {
      console.error('[useFamilyLists] load error:', e)
    } finally {
      loaded.value = true
    }
  }

  const load = () => (inflight ??= run().finally(() => (inflight = null)))

  const itemsOf = (listId: string) => items.value.filter((i) => i.list_id === listId)
  const openCountOf = (listId: string) => openCount(itemsOf(listId))
  const groupedOf = (listId: string) => groupItems(itemsOf(listId))
  const listById = (id: string) => lists.value.find((l) => l.id === id)

  const addItem = async (listId: string, text: string) => {
    const t = text.trim()
    if (!t) return
    try {
      const row = await listQueries.addItem(listId, t, nextSortOrder(itemsOf(listId)))
      items.value = upsertRow(items.value, row)
    } catch (e) {
      console.error('[useFamilyLists] addItem error:', e)
      notifyError('新增失敗，請檢查網路')
    }
  }

  const toggle = async (item: FamilyListItem) => {
    const done = !item.done
    const userId = session.value?.user?.id ?? ''
    const prev = item
    // 樂觀更新：勾選要立刻有回饋，失敗再還原
    items.value = upsertRow(items.value, {
      ...item,
      done,
      done_by: done ? userId : null,
      done_at: done ? new Date().toISOString() : null,
    })
    try {
      await listQueries.setDone(item.id, done, userId)
    } catch (e) {
      console.error('[useFamilyLists] toggle error:', e)
      items.value = upsertRow(items.value, prev)
      notifyError('更新失敗，請檢查網路')
    }
  }

  const removeItem = async (id: string) => {
    try {
      await listQueries.removeItem(id)
      items.value = items.value.filter((i) => i.id !== id)
    } catch (e) {
      console.error('[useFamilyLists] removeItem error:', e)
      notifyError('刪除失敗，請檢查網路')
    }
  }

  const clearDone = async (listId: string) => {
    try {
      await listQueries.clearDone(listId)
      items.value = items.value.filter((i) => !(i.list_id === listId && i.done))
    } catch (e) {
      console.error('[useFamilyLists] clearDone error:', e)
      notifyError('清除失敗，請檢查網路')
    }
  }

  const reset = () => {
    unsubscribe()
    lists.value = []
    items.value = []
    loaded.value = false
    inflight = null
  }

  const hasFamily = computed(() => !!familyId())

  return { lists, items, loaded, hasFamily, load, listById, openCountOf, groupedOf, addItem, toggle, removeItem, clearDone, reset }
}
