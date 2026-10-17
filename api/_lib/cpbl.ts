export type CpblRecord = {
  game_sno: number
  game_date: string
  home_team_name: string
  visiting_team_name: string
  field_abbe: string
}

const BASE = 'https://cpbl.com.tw'

// 取得 anti-forgery token → getgamedatas → 轉成 records（由 src/services/cpblService.ts 搬來，欄位對應不變）
export async function fetchCpblMonth(
  year: number,
  month: number,
  fetchImpl: typeof fetch = fetch,
): Promise<CpblRecord[]> {
  const htmlResponse = await fetchImpl(`${BASE}/schedule`)
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
      const d = new Date(game.GameDate)
      const yyyy = d.getFullYear()
      const m = d.getMonth() + 1
      if (yyyy === year && m === month) {
        records.push({
          game_sno: parseInt(game.GameSno, 10),
          game_date: `${yyyy}-${String(m).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
          home_team_name: game.HomeTeamName,
          visiting_team_name: game.VisitingTeamName,
          field_abbe: game.FieldAbbe,
        })
      }
    }
  }
  return records
}
