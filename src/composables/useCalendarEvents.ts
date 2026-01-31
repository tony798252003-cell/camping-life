
import { ref } from 'vue'
import { supabase } from '../lib/supabase'
import type { CalendarEvent, NewCalendarEvent } from '../types/database'

export function useCalendarEvents() {
    const events = ref<CalendarEvent[]>([])
    const isLoading = ref(false)
    const error = ref<string | null>(null)

    async function fetchEvents() {
        isLoading.value = true
        error.value = null
        try {
            const { data, error: err } = await supabase
                .from('calendar_events')
                .select('*')
                .order('start_time', { ascending: true })

            if (err) throw err
            events.value = data || []
        } catch (e: any) {
            console.error('Error fetching events:', e)
            error.value = e.message
        } finally {
            isLoading.value = false
        }
    }

    async function addEvent(event: NewCalendarEvent) {
        isLoading.value = true
        try {
            // @ts-ignore: Suppress strict type check for now
            const { data, error: err } = await supabase
                .from('calendar_events')
                .insert(event as any)
                .select()
                .single()

            if (err) throw err
            if (data) {
                events.value.push(data as CalendarEvent)
            }
            return data
        } catch (e: any) {
            console.error('Error adding event:', e)
            throw e
        } finally {
            isLoading.value = false
        }
    }

    async function updateEvent(id: string, updates: Partial<NewCalendarEvent>) {
        isLoading.value = true
        try {
            const updateResult: any = await (supabase
                .from('calendar_events') as any)
                .update(updates)
                .eq('id', id)
                .select()
                .single()
            const { data, error: err } = updateResult

            if (err) throw err
            if (data) {
                const index = events.value.findIndex(e => e.id === id)
                if (index !== -1) {
                    events.value[index] = data
                }
            }
            return data
        } catch (e: any) {
            console.error('Error updating event:', e)
            throw e
        } finally {
            isLoading.value = false
        }
    }

    async function deleteEvent(id: string) {
        isLoading.value = true
        try {
            const { error: err } = await supabase
                .from('calendar_events')
                .delete()
                .eq('id', id)

            if (err) throw err
            events.value = events.value.filter(e => e.id !== id)
        } catch (e: any) {
            console.error('Error deleting event:', e)
            throw e
        } finally {
            isLoading.value = false
        }
    }

    return {
        events,
        isLoading,
        error,
        fetchEvents,
        addEvent,
        updateEvent,
        deleteEvent
    }
}
