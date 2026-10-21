import { describe, it, expect, vi, beforeEach } from 'vitest'

const chan = { on: vi.fn(), subscribe: vi.fn() }
chan.on.mockReturnValue(chan)
chan.subscribe.mockReturnValue(chan)
vi.mock('../lib/supabase', () => ({
  supabase: { channel: vi.fn(() => chan), removeChannel: vi.fn(), auth: { onAuthStateChange: vi.fn() } },
}))
vi.mock('../services/db/lists', () => ({
  listQueries: {
    listLists: vi.fn(),
    listItems: vi.fn(),
    createDefaults: vi.fn(),
    setDone: vi.fn(),
  },
}))

import { supabase } from '../lib/supabase'
import { listQueries } from '../services/db/lists'
import { useUserProfile } from './useUserProfile'
import { useFamilyLists } from './useFamilyLists'

const q = vi.mocked(listQueries)
const list = { id: 'l1', family_id: 'f1', title: '採買', sort_order: 0, created_by: null, created_at: '2026-10-22T00:00:00Z' }
const item = { id: 'i1', list_id: 'l1', text: '牛奶', done: false, done_by: null, done_at: null, sort_order: 0, created_by: null, created_at: '2026-10-22T00:00:00Z' }

const setFamily = (id: string | null) => {
  useUserProfile().userProfile.value = { latitude: 0, longitude: 0, location_name: '', is_admin: false, family_id: id }
}

beforeEach(() => {
  vi.clearAllMocks()
  useFamilyLists().reset()
  setFamily('f1')
  q.listLists.mockResolvedValue([list])
  q.listItems.mockResolvedValue([item])
  q.createDefaults.mockResolvedValue()
  q.setDone.mockResolvedValue()
})

describe('load', () => {
  it('concurrent calls run once, because 首頁與清單頁同時載入若各建預設清單會重複', async () => {
    q.listLists.mockResolvedValueOnce([]).mockResolvedValue([list])
    const { load } = useFamilyLists()
    await Promise.all([load(), load()])
    expect(q.createDefaults).toHaveBeenCalledTimes(1)
    expect(q.listItems).toHaveBeenCalledTimes(1)
  })

  it('reset during load discards the stale result and opens no channel, because 登出後不能殘留上一位的資料', async () => {
    let release!: (v: typeof list[]) => void
    q.listLists.mockReturnValueOnce(new Promise((r) => (release = r)))
    const { load, reset, lists } = useFamilyLists()
    const p = load()
    reset()
    release([list])
    await p
    expect(lists.value).toEqual([])
    expect(supabase.channel).not.toHaveBeenCalled()
  })

  it('failure sets loadFailed so the UI can offer retry', async () => {
    q.listLists.mockRejectedValueOnce(new Error('x'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { load, loadFailed } = useFamilyLists()
    await load()
    expect(loadFailed.value).toBe(true)
  })

  it('reload after family change resubscribes to the new family, because 舊 channel 的 filter 綁著舊家庭', async () => {
    const { load, reload } = useFamilyLists()
    await load()
    setFamily('f2')
    await reload()
    expect(supabase.channel).toHaveBeenCalledTimes(2)
    expect(supabase.removeChannel).toHaveBeenCalledTimes(1)
  })
})

describe('toggle', () => {
  it('failure reverts the optimistic change', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { load, toggle, items } = useFamilyLists()
    await load()
    q.setDone.mockRejectedValueOnce(new Error('x'))
    await toggle(items.value[0]!)
    expect(items.value[0]!.done).toBe(false)
  })

  it('failed earlier toggle does not revert a later one, because 連點時還原會蓋掉使用者最後的意圖', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { load, toggle, items } = useFamilyLists()
    await load()
    let fail!: (e: Error) => void
    q.setDone.mockReturnValueOnce(new Promise((_, rej) => (fail = rej)))
    const first = toggle(items.value[0]!) // → done
    q.setDone.mockResolvedValueOnce()
    await toggle(items.value[0]!) // → undone
    fail(new Error('x'))
    await first
    expect(items.value[0]!.done).toBe(false)
  })

  it('sends null done_by when no user, because 空字串不是合法 uuid', async () => {
    const { load, toggle, items } = useFamilyLists()
    await load()
    await toggle(items.value[0]!)
    expect(q.setDone).toHaveBeenCalledWith('i1', true, null)
  })
})
