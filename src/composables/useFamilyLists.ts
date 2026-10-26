import { computed, ref } from 'vue'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { apiPost } from '../services/api'
import { listQueries } from '../services/db/lists'
import type { FamilyList, FamilyListItem } from '../types/database'
import { groupItems, nextSortOrder, openCount, pickTodoList } from '../utils/familyLists'
import { useAuth } from './useAuth'
import { useNotification } from './useNotification'
import { useUserProfile } from './useUserProfile'

// 模組層級 ref（singleton）：登出時 reset()
const lists = ref<FamilyList[]>([])
const items = ref<FamilyListItem[]>([])
const loaded = ref(false)
const loadFailed = ref(false)
let channel: RealtimeChannel | null = null
let channelFid: string | null = null
// reset() 會 +1；進行中的 run() 每個 await 後比對，不一致就丟棄結果（登出途中不能寫入舊資料或再開 channel）
let generation = 0
// 同一時間只跑一次 load，避免首頁與清單頁同時進來時重複建立預設清單
let inflight: Promise<void> | null = null

const upsertRow = <T extends { id: string }>(arr: T[], row: T) => {
  const i = arr.findIndex((r) => r.id === row.id)
  return i === -1 ? [...arr, row] : arr.map((r, j) => (j === i ? row : r))
}

export function useFamilyLists() {
  const { familyId } = useUserProfile()
  const { session } = useAuth()
  const { error: notifyError, info: notifyInfo } = useNotification()

  const subscribe = (fid: string) => {
    if (channel && channelFid === fid) return
    // 加入另一個家庭後 fid 變了，舊 channel 的 filter 還綁著舊家庭，必須重建
    unsubscribe()
    channelFid = fid
    // 註：family_lists 的 DELETE 事件帶 filter 時 Realtime 收不到（舊列只有 id），目前沒有刪除清單的 UI；
    // 之後若加刪除清單，需另外處理（例如 DELETE 不帶 filter 訂閱，或定期重載）。
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
    channelFid = null
  }

  const run = async (g: number) => {
    const fid = familyId()
    if (!fid) {
      unsubscribe()
      lists.value = []
      items.value = []
      loadFailed.value = false
      loaded.value = true
      return
    }
    try {
      let l = await listQueries.listLists()
      if (g !== generation) return
      if (!pickTodoList(l)) {
        await listQueries.createTodoList(fid)
        if (g !== generation) return
        l = await listQueries.listLists()
        if (g !== generation) return
      }
      const it = await listQueries.listItems()
      if (g !== generation) return
      lists.value = l
      items.value = it
      loadFailed.value = false
      subscribe(fid)
    } catch (e) {
      if (g !== generation) return
      console.error('[useFamilyLists] load error:', e)
      loadFailed.value = true
    } finally {
      if (g === generation) loaded.value = true
    }
  }

  const load = (): Promise<void> => {
    if (inflight) return inflight
    const p: Promise<void> = run(generation).finally(() => {
      if (inflight === p) inflight = null
    })
    inflight = p
    return p
  }

  // 加入另一個家庭後：清掉舊家庭資料與 channel，再以新家庭重載
  const reload = () => {
    reset()
    return load()
  }

  // App 只用標題為「家庭待辦」的那張清單；其他清單（舊資料）一律忽略
  const list = computed(() => pickTodoList(lists.value))
  const todoItems = computed(() => items.value.filter((i) => i.list_id === list.value?.id))
  const grouped = computed(() => groupItems(todoItems.value))
  const openTotal = computed(() => openCount(todoItems.value))

  // 推播給家人（api/todo-notify）：不 await，通知失敗不影響已新增的項目
  const notifyFamily = (itemId: string) => {
    apiPost<{ sent: number; failed: number }>('/api/todo-notify', { itemId })
      .then((r) => {
        if (r.sent > 0) return
        if (r.failed > 0) notifyError('通知家人失敗')
        else notifyInfo('家人還沒開啟通知')
      })
      .catch((e) => {
        console.error('[useFamilyLists] notifyFamily error:', e)
        notifyError('通知家人失敗')
      })
  }

  // 回傳是否新增成功（呼叫端據此重設「通知家人」開關）
  const addItem = async (text: string, notify = false): Promise<boolean> => {
    const t = text.trim()
    const listId = list.value?.id
    if (!t || !listId) return false
    try {
      const row = await listQueries.addItem(listId, t, nextSortOrder(todoItems.value))
      items.value = upsertRow(items.value, row)
      if (notify) notifyFamily(row.id)
      return true
    } catch (e) {
      console.error('[useFamilyLists] addItem error:', e)
      notifyError('新增失敗，請檢查網路')
      return false
    }
  }

  const toggle = async (item: FamilyListItem) => {
    const done = !item.done
    const userId = session.value?.user?.id ?? null
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
      // 連點時後一次操作已改變狀態，只有目前仍是這次的樂觀值才還原
      const cur = items.value.find((i) => i.id === item.id)
      if (cur && cur.done === done) items.value = upsertRow(items.value, prev)
      notifyError('更新失敗，請檢查網路')
    }
  }

  const toggleImportant = async (item: FamilyListItem) => {
    const important = !item.important
    const prev = item
    items.value = upsertRow(items.value, { ...item, important })
    try {
      await listQueries.setImportant(item.id, important)
    } catch (e) {
      console.error('[useFamilyLists] toggleImportant error:', e)
      // 同 toggle：連點時只有目前仍是這次的樂觀值才還原
      const cur = items.value.find((i) => i.id === item.id)
      if (cur && cur.important === important) items.value = upsertRow(items.value, prev)
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

  const clearDone = async () => {
    const listId = list.value?.id
    if (!listId) return
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
    loadFailed.value = false
    inflight = null
    generation++
  }

  const hasFamily = computed(() => !!familyId())

  return { list, grouped, openTotal, loaded, loadFailed, hasFamily, load, reload, addItem, toggle, toggleImportant, removeItem, clearDone, reset }
}
