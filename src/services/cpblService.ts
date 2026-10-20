import { supabase } from '../lib/supabase'
import { apiPost } from './api'
import type { CpblSchedule } from '../types/database'



export async function syncCpblScheduleForYearMonth(year: number, month: number): Promise<void> {
    try {
        await apiPost<{ upserted: number }>('/api/cpbl-sync', { year, month })
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

export async function resyncCpblYear(year: number): Promise<{ upserted: number; deleted: number }> {
    return apiPost<{ upserted: number; deleted: number }>('/api/cpbl-sync', { year, resyncYear: true })
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
