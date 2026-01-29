import { ref } from 'vue'
import { tripQueries } from '../services/supabaseQueries'
import type { CampingTripWithCampsite, NewCampingTrip } from '../types/database'
import { useNotification } from './useNotification'

/**
 * Trip data management
 * Handles CRUD operations for camping trips
 */
export function useTrips() {
    const trips = ref<CampingTripWithCampsite[]>([])
    const loading = ref(false)
    const { success, error: notifyError } = useNotification()

    /**
     * Fetch all trips for user or family
     */
    const fetchTrips = async (userId: string, familyId?: string | null) => {
        loading.value = true
        try {
            trips.value = await tripQueries.fetchAll(userId, familyId)
        } catch (error: any) {
            if (error.name === 'AbortError' || error.message?.includes('AbortError')) {
                console.log('[useTrips] Fetch cancelled')
                return
            }
            console.error('[useTrips] Fetch error:', error)
            notifyError('無法載入露營記錄,請檢查網路連線')
        } finally {
            loading.value = false
        }
    }

    /**
     * Create a new trip
     */
    const createTrip = async (tripData: NewCampingTrip) => {
        try {
            await tripQueries.create(tripData)
            success('新增成功！')
            return true
        } catch (error) {
            console.error('[useTrips] Create error:', error)
            notifyError('儲存失敗，請稍後再試')
            return false
        }
    }

    /**
     * Update an existing trip
     */
    const updateTrip = async (tripId: number, tripData: Partial<NewCampingTrip>) => {
        try {
            await tripQueries.update(tripId, tripData)
            success('更新成功！')
            return true
        } catch (error) {
            console.error('[useTrips] Update error:', error)
            notifyError('儲存失敗，請稍後再試')
            return false
        }
    }

    /**
     * Delete a trip
     */
    const deleteTrip = async (tripId: number) => {
        try {
            await tripQueries.delete(tripId)
            success('刪除成功！')
            return true
        } catch (error) {
            console.error('[useTrips] Delete error:', error)
            notifyError('刪除失敗，請稍後再試')
            return false
        }
    }

    /**
     * Update night rush status
     */
    const updateNightRush = async (tripId: number, value: boolean) => {
        try {
            await tripQueries.update(tripId, { night_rush: value })
            return true
        } catch (error) {
            console.error('[useTrips] Update night rush error:', error)
            notifyError('更新失敗，請檢查網路')
            return false
        }
    }

    /**
     * Find trip by ID
     */
    const findTripById = (tripId: number) => {
        return trips.value.find(t => t.id === tripId)
    }

    /**
     * Clear trips data (on logout)
     */
    const clearTrips = () => {
        trips.value = []
    }

    return {
        // State
        trips,
        loading,

        // Methods
        fetchTrips,
        createTrip,
        updateTrip,
        deleteTrip,
        updateNightRush,
        findTripById,
        clearTrips
    }
}
