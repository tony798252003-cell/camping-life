export type CpblRecord = {
  game_sno: number
  game_date: string
  home_team_name: string
  visiting_team_name: string
  field_abbe: string
}

const BASE = 'https://cpbl.com.tw'
// 部分主機會擋沒有瀏覽器 UA 的請求
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

// 取得 anti-forgery token → getgamedatas → 轉成 records（由 src/services/cpblService.ts 搬來，欄位對應不變）
export async function fetchCpblMonth(
  year: number,
  month: number,
  fetchImpl: typeof fetch = fetch,
): Promise<CpblRecord[]> {
  const htmlResponse = await fetchImpl(`${BASE}/schedule`, { headers: { 'User-Agent': UA } })
  if (!htmlResponse.ok) {
    throw new Error(`Failed to fetch CPBL HTML: ${htmlResponse.status} ${htmlResponse.statusText}`)
  }
  const html = await htmlResponse.text()

  const headerTokenMatch = html.match(/RequestVerificationToken:\s*'([^']+)'/)
  const inputTokenMatch = html.match(/name="__RequestVerificationToken"\s+type="hidden"\s+value="([^"]+)"/)
  if (!headerTokenMatch || !inputTokenMatch) {
    throw new Error('Cannot find CPBL anti-forgery tokens in HTML')
  }
  const headerToken = headerTokenMatch[1]!

  // anti-forgery token 通常綁 cookie，瀏覽器會自動帶；伺服器端要手動轉送
  const cookie = (htmlResponse.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(';')[0])
    .join('; ')

  const params = new URLSearchParams()
  params.append('calendar', `${year}/${String(month).padStart(2, '0')}/01`)
  params.append('location', '')
  params.append('kindCode', 'A')

  const apiResponse = await fetchImpl(`${BASE}/schedule/getgamedatas`, {
    method: 'POST',
    headers: {
      'User-Agent': UA,
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      RequestVerificationToken: headerToken,
      'X-Requested-With': 'XMLHttpRequest',
      Accept: 'application/json, text/javascript, */*; q=0.01',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: params.toString(),
  })
  if (!apiResponse.ok) {
    throw new Error(`Failed to POST CPBL getgamedatas: ${apiResponse.status} ${apiResponse.statusText}`)
  }

  const data = (await apiResponse.json()) as { Success?: boolean; GameDatas?: string }
  const records: CpblRecord[] = []
  if (data && data.Success && data.GameDatas) {
    const games = JSON.parse(data.GameDatas) as any[]
    for (const game of games) {
      // 直接切字串，不經 Date，避免系統時區造成差一天
      const dateStr = String(game.GameDate).slice(0, 10)
      const yyyy = Number(dateStr.slice(0, 4))
      const m = Number(dateStr.slice(5, 7))
      if (yyyy === year && m === month) {
        records.push({
          game_sno: parseInt(game.GameSno, 10),
          game_date: dateStr,
          home_team_name: game.HomeTeamName,
          visiting_team_name: game.VisitingTeamName,
          field_abbe: game.FieldAbbe,
        })
      }
    }
  }
  return records
}

export type StoredGame = { id: string; game_sno: number; game_date: string }

// 回傳「existing 中、(game_sno, game_date) 不在官方資料、而且沒被使用者事件綁定」的 id
export function staleGameIds(existing: StoredGame[], official: CpblRecord[], boundIds: Set<string>): string[] {
  const keep = new Set(official.map((r) => `${r.game_sno}|${r.game_date}`))
  return existing
    .filter((g) => !keep.has(`${g.game_sno}|${g.game_date}`) && !boundIds.has(g.id))
    .map((g) => g.id)
}

export type ResyncDb = {
  upsert(records: CpblRecord[]): Promise<void>
  listExisting(year: number): Promise<StoredGame[]>
  listBoundIds(): Promise<string[]>
  deleteByIds(ids: string[]): Promise<void>
}

// 逐月抓取；任何一個月失敗就整個中止（不寫、不刪）。官方全年為空視為異常，也不刪任何列。
export async function resyncYear(
  year: number,
  deps: { fetchMonth: typeof fetchCpblMonth; db: ResyncDb },
): Promise<{ upserted: number; deleted: number }> {
  const official: CpblRecord[] = []
  for (let month = 1; month <= 12; month++) {
    official.push(...(await deps.fetchMonth(year, month)))
  }
  if (official.length === 0) return { upserted: 0, deleted: 0 }

  await deps.db.upsert(official)
  const [existing, bound] = await Promise.all([deps.db.listExisting(year), deps.db.listBoundIds()])
  const ids = staleGameIds(existing, official, new Set(bound))
  if (ids.length > 0) await deps.db.deleteByIds(ids)
  return { upserted: official.length, deleted: ids.length }
}
