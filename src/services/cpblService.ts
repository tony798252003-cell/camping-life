import { supabase } from '../lib/supabase'
import type { CpblSchedule } from '../types/database'



// We will fetch schedule for a given year and month
// The API accepts form data but maybe we can just pass json or x-www-form-urlencoded
export async function syncCpblScheduleForYearMonth(year: number, month: number): Promise<void> {
    try {
        // 1. Fetch the HTML page to get the anti-forgery tokens
        const HTML_URL = import.meta.env.DEV
            ? `/api/cpbl/schedule`
            : `https://corsproxy.io/?${encodeURIComponent(`https://cpbl.com.tw/schedule`)}`

        const htmlResponse = await fetch(HTML_URL)
        if (!htmlResponse.ok) {
            throw new Error(`Failed to fetch CPBL HTML: ${htmlResponse.statusText}`)
        }
        const html = await htmlResponse.text()

        // Extract RequestVerificationToken from headers script block
        // headers: { RequestVerificationToken: '...' }
        const headerTokenMatch = html.match(/RequestVerificationToken:\s*'([^']+)'/)

        // Extract __RequestVerificationToken hidden input
        // <input name="__RequestVerificationToken" type="hidden" value="..." />
        const inputTokenMatch = html.match(/name="__RequestVerificationToken"\s+type="hidden"\s+value="([^"]+)"/)

        if (!headerTokenMatch || !inputTokenMatch) {
            console.error("Tokens not found in HTML")
            throw new Error("Cannot find CPBL anti-forgery tokens in HTML")
        }

        const headerToken = headerTokenMatch[1]
        // const inputToken = inputTokenMatch[1] // The cpbl logic seems to actually just send `filterData` without the input token if using AJAX, but we'll include it or just strictly follow their AJAX format.

        // Their AJAX request: data: { calendar: yyyy/mm/dd, location: '', kindCode: 'A' }
        // Let's format date as YYYY/MM/DD
        const formattedDate = `${year}/${String(month).padStart(2, '0')}/01`

        // To handle CORS in production for POST, we still need proxy. vite config applies to /api/cpbl
        const API_POST_URL = import.meta.env.DEV
            ? `/api/cpbl/schedule/getgamedatas`
            : `https://corsproxy.io/?${encodeURIComponent(`https://cpbl.com.tw/schedule/getgamedatas`)}`

        // Send URL encoded form data with the required fields
        const params = new URLSearchParams()
        params.append('calendar', formattedDate)
        params.append('location', '') // All locations
        params.append('kindCode', 'A') // Regular season

        // 2. Fetch the actual JSON data via the POST endpoint
        const apiResponse = await fetch(API_POST_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'RequestVerificationToken': headerToken || '',
                // if we use a dev proxy we need these typical headers
                'X-Requested-With': 'XMLHttpRequest',
                'Accept': 'application/json, text/javascript, */*; q=0.01'
            },
            body: params.toString()
        })

        if (!apiResponse.ok) {
            throw new Error(`Failed to POST CPBL getgamedatas: ${apiResponse.statusText}`)
        }

        const data = await apiResponse.json()
        const scheduleRecords: any[] = []

        if (data && data.Success && data.GameDatas) {
            const games = JSON.parse(data.GameDatas)
            for (const game of games) {
                // only add games for the requested month
                const gameDateObj = new Date(game.GameDate)

                // Use local timezone getters to avoid UTC offset issues (where 00:00:00 Taiwan time becomes 16:00:00 the day before in UTC)
                const yyyy = gameDateObj.getFullYear()
                const m = gameDateObj.getMonth() + 1
                const d = gameDateObj.getDate()

                if (yyyy === year && m === month) {
                    const localDateStr = `${yyyy}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

                    scheduleRecords.push({
                        game_sno: parseInt(game.GameSno, 10),
                        game_date: localDateStr,
                        home_team_name: game.HomeTeamName,
                        visiting_team_name: game.VisitingTeamName,
                        field_abbe: game.FieldAbbe,
                    })
                }
            }
        }

        if (scheduleRecords.length > 0) {
            // Upsert into Supabase
            const { error } = await (supabase
                .from('cpbl_schedule') as any)
                .upsert(scheduleRecords, { onConflict: 'game_sno, game_date' })

            if (error) {
                throw error
            }
        }
    } catch (error) {
        console.error('Failed to sync CPBL schedule:', error)
        throw error
    }
}

export async function syncCpblScheduleForYear(year: number): Promise<void> {
    // Sync all months from 3 (March) to 11 (November)
    for (let month = 3; month <= 11; month++) {
        await syncCpblScheduleForYearMonth(year, month)
    }
}

export async function getCpblSchedule(startDate?: string, endDate?: string): Promise<CpblSchedule[]> {
    let query = supabase.from('cpbl_schedule').select('*')
    if (startDate) {
        query = query.gte('game_date', startDate)
    }
    if (endDate) {
        query = query.lte('game_date', endDate)
    }
    const { data, error } = await query
    if (error) {
        console.error('Error fetching CPBL schedule:', error)
        return []
    }
    return data || []
}

export async function clearCpblScheduleForYear(year: number): Promise<void> {
    try {
        const { error } = await supabase
            .from('cpbl_schedule')
            .delete()
            .gte('game_date', `${year}-01-01`)
            .lte('game_date', `${year}-12-31`)

        if (error) {
            throw error
        }
    } catch (error) {
        console.error(`Failed to clear CPBL schedule for year ${year}:`, error)
        throw error
    }
}
