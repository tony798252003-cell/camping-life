import { describe, it, expect } from 'vitest'
import { fetchCpblMonth } from './cpbl.js'

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
