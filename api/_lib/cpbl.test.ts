import { describe, it, expect, vi } from 'vitest'
import { fetchCpblMonth, staleGameIds, resyncYear, type CpblRecord } from './cpbl.js'

const HTML = `<html><script>headers: { RequestVerificationToken: 'hdr-token' }</script>
<input name="__RequestVerificationToken" type="hidden" value="input-token" /></html>`

const GAMES = [
  { GameSno: '45', GameDate: '2026-03-14T00:00:00', HomeTeamName: '統一7-ELEVEn獅', VisitingTeamName: '樂天桃猿', FieldAbbe: '台南' },
  { GameSno: '46', GameDate: '2026-03-15T00:00:00', HomeTeamName: '中信兄弟', VisitingTeamName: '富邦悍將', FieldAbbe: '洲際' },
  { GameSno: '99', GameDate: '2026-04-01T00:00:00', HomeTeamName: '台鋼雄鷹', VisitingTeamName: '味全龍', FieldAbbe: '天母' },
]

function mockFetch(opts: { html?: string; htmlStatus?: number; postStatus?: number; data?: unknown } = {}) {
  const calls: { url: string; init?: RequestInit }[] = []
  const impl = (async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), init })
    if (!init || init.method !== 'POST') {
      return new Response(opts.html ?? HTML, { status: opts.htmlStatus ?? 200 })
    }
    return new Response(
      JSON.stringify(opts.data ?? { Success: true, GameDatas: JSON.stringify(GAMES) }),
      { status: opts.postStatus ?? 200 },
    )
  }) as unknown as typeof fetch
  return { impl, calls }
}

// 為什麼：欄位對應錯了會把錯誤資料寫進 cpbl_schedule，且 upsert 靠 game_sno+game_date 去重
describe('fetchCpblMonth', () => {
  it('把 GameDatas 轉成 records，只保留該月份', async () => {
    const { impl } = mockFetch()
    const records = await fetchCpblMonth(2026, 3, impl)
    expect(records).toEqual([
      { game_sno: 45, game_date: '2026-03-14', home_team_name: '統一7-ELEVEn獅', visiting_team_name: '樂天桃猿', field_abbe: '台南' },
      { game_sno: 46, game_date: '2026-03-15', home_team_name: '中信兄弟', visiting_team_name: '富邦悍將', field_abbe: '洲際' },
    ])
  })

  it('直接連 cpbl.com.tw，POST 帶 token 與月份參數', async () => {
    const { impl, calls } = mockFetch()
    await fetchCpblMonth(2026, 3, impl)
    expect(calls[0]!.url).toBe('https://cpbl.com.tw/schedule')
    expect(calls[1]!.url).toBe('https://cpbl.com.tw/schedule/getgamedatas')
    const headers = calls[1]!.init!.headers as Record<string, string>
    expect(headers['RequestVerificationToken']).toBe('hdr-token')
    expect(String(calls[1]!.init!.body)).toBe('calendar=2026%2F03%2F01&location=&kindCode=A')
  })

  it('找不到 token 時 throw（不是默默回空陣列）', async () => {
    const { impl } = mockFetch({ html: '<html>blocked</html>' })
    await expect(fetchCpblMonth(2026, 3, impl)).rejects.toThrow(/anti-forgery/)
  })

  it('HTML 頁面非 2xx 時 throw', async () => {
    const { impl } = mockFetch({ htmlStatus: 403 })
    await expect(fetchCpblMonth(2026, 3, impl)).rejects.toThrow(/403/)
  })

  it('getgamedatas 非 2xx 時 throw', async () => {
    const { impl } = mockFetch({ postStatus: 500 })
    await expect(fetchCpblMonth(2026, 3, impl)).rejects.toThrow(/500/)
  })

  it('Success 為 false 時回空陣列', async () => {
    const { impl } = mockFetch({ data: { Success: false } })
    expect(await fetchCpblMonth(2026, 3, impl)).toEqual([])
  })
})

// ---- 重新同步整年（規格 §6.2、Review Focus 5） ----
const rec = (game_sno: number, game_date: string): CpblRecord => ({
  game_sno, game_date, home_team_name: 'A', visiting_team_name: 'B', field_abbe: 'X',
})

// 為什麼：被綁定的比賽一刪掉，使用者事件的 cpbl_game_id 會被 set null，同一場比賽就會出現兩次
describe('staleGameIds', () => {
  const existing = [
    { id: 'old', game_sno: 1, game_date: '2026-03-01' },
    { id: 'bound', game_sno: 2, game_date: '2026-03-02' },
    { id: 'kept', game_sno: 3, game_date: '2026-03-03' },
  ]
  const official = [rec(3, '2026-03-03')]

  it('官方已沒有、也沒被綁定的舊比賽 → 要刪', () => {
    expect(staleGameIds(existing, official, new Set(['bound']))).toEqual(['old'])
  })
  it('官方已沒有、但被綁定的比賽 → 不刪', () => {
    expect(staleGameIds(existing, official, new Set(['bound']))).not.toContain('bound')
  })
  it('官方仍有的比賽 → 不刪', () => {
    expect(staleGameIds(existing, official, new Set())).not.toContain('kept')
  })
  it('同場次但改期（game_date 不同）視為舊比賽', () => {
    expect(staleGameIds([{ id: 'moved', game_sno: 3, game_date: '2026-03-01' }], official, new Set())).toEqual(['moved'])
  })
})

function mockDb(existing: { id: string; game_sno: number; game_date: string }[] = [], bound: string[] = []) {
  return {
    upsert: vi.fn(async (_r: CpblRecord[]) => {}),
    listExisting: vi.fn(async (_y: number) => existing),
    listBoundIds: vi.fn(async () => bound),
    deleteByIds: vi.fn(async (_ids: string[]) => {}),
  }
}

describe('resyncYear', () => {
  // 為什麼：只抓到部分月份就刪，會把其實還在的比賽當成「官方已取消」
  it('任何一個月抓取失敗 → reject，不 upsert 也不 delete', async () => {
    const db = mockDb([{ id: 'old', game_sno: 1, game_date: '2026-03-01' }])
    const fetchMonth = vi.fn(async (_y: number, m: number) => {
      if (m === 7) throw new Error('boom')
      return [rec(m, `2026-${String(m).padStart(2, '0')}-01`)]
    })
    await expect(resyncYear(2026, { fetchMonth, db })).rejects.toThrow('boom')
    expect(db.upsert).not.toHaveBeenCalled()
    expect(db.deleteByIds).not.toHaveBeenCalled()
  })

  it('全部成功 → upsert 全年，刪掉過期且未綁定的列', async () => {
    const db = mockDb(
      [
        { id: 'old', game_sno: 99, game_date: '2026-03-01' },
        { id: 'bound', game_sno: 98, game_date: '2026-03-02' },
      ],
      ['bound'],
    )
    const fetchMonth = vi.fn(async (_y: number, m: number) => (m === 3 ? [rec(1, '2026-03-05')] : []))
    const result = await resyncYear(2026, { fetchMonth, db })
    expect(fetchMonth).toHaveBeenCalledTimes(12)
    expect(db.upsert).toHaveBeenCalledWith([rec(1, '2026-03-05')])
    expect(db.deleteByIds).toHaveBeenCalledWith(['old'])
    expect(result).toEqual({ upserted: 1, deleted: 1 })
  })

  // 為什麼：官方回傳空陣列（例如整年抓不到資料）時，不能順手把整年賽程刪光
  it('官方全年皆空 → 不 upsert、不 delete', async () => {
    const db = mockDb([{ id: 'old', game_sno: 1, game_date: '2026-03-01' }])
    const result = await resyncYear(2026, { fetchMonth: async () => [], db })
    expect(db.upsert).not.toHaveBeenCalled()
    expect(db.deleteByIds).not.toHaveBeenCalled()
    expect(result).toEqual({ upserted: 0, deleted: 0 })
  })
})
