import { ref } from 'vue'
import { tripPhotoQueries, MAX_PHOTOS_PER_USER_PER_TRIP } from '../services/db/tripPhotos'
import type { TripPhoto, NewTripPhoto } from '../types/database'

const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e))

export function useTripPhotos() {
    const photos = ref<TripPhoto[]>([])
    const loading = ref(false)
    const error = ref<string | null>(null)

    const fetchPhotos = async (tripId: number) => {
        loading.value = true
        try {
            photos.value = await tripPhotoQueries.fetchByTrip(tripId)
        } catch (e) {
            console.error('Error fetching photos:', e)
            error.value = messageOf(e)
        } finally {
            loading.value = false
        }
    }

    const addPhoto = async (photoData: NewTripPhoto) => {
        try {
            // Check limit: Max 3 photos per user per trip
            const count = await tripPhotoQueries.countByUser(photoData.trip_id, photoData.user_id)
            if (count !== null && count >= MAX_PHOTOS_PER_USER_PER_TRIP) {
                throw new Error('每個行程最多只能上傳 3 張照片')
            }

            const data = await tripPhotoQueries.insert(photoData)
            if (data) {
                photos.value.unshift(data)
            }
            return data
        } catch (e) {
            console.error('Error adding photo:', e)
            error.value = messageOf(e)
            throw e
        }
    }

    const deletePhoto = async (photoId: number) => {
        try {
            await tripPhotoQueries.remove(photoId)
            photos.value = photos.value.filter(p => p.id !== photoId)
        } catch (e) {
            console.error('Error deleting photo:', e)
            error.value = messageOf(e)
            throw e
        }
    }

    return {
        photos,
        loading,
        error,
        fetchPhotos,
        addPhoto,
        deletePhoto
    }
}
