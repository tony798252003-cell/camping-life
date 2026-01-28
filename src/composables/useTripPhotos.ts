import { ref } from 'vue'
import { supabase } from '../lib/supabase'
import type { TripPhoto, NewTripPhoto } from '../types/database'

export function useTripPhotos() {
    const photos = ref<TripPhoto[]>([])
    const loading = ref(false)
    const error = ref<string | null>(null)

    const fetchPhotos = async (tripId: number) => {
        loading.value = true
        try {
            const { data, error: err } = await supabase
                .from('trip_photos')
                .select('*')
                .eq('trip_id', tripId)
                .order('created_at', { ascending: false })

            if (err) throw err
            photos.value = data || []
        } catch (e: any) {
            console.error('Error fetching photos:', e)
            error.value = e.message
        } finally {
            loading.value = false
        }
    }

    const addPhoto = async (photoData: NewTripPhoto) => {
        try {
            // Check limit: Max 3 photos per user per trip
            const { count, error: countError } = await supabase
                .from('trip_photos')
                .select('*', { count: 'exact', head: true })
                .eq('trip_id', photoData.trip_id)
                .eq('user_id', photoData.user_id)

            if (countError) throw countError
            if (count !== null && count >= 3) {
                throw new Error('每個行程最多只能上傳 3 張照片')
            }

            const { data, error: err } = await supabase
                .from('trip_photos')
                .insert(photoData as any)
                .select()
                .single()

            if (err) throw err

            if (data) {
                photos.value.unshift(data)
            }
            return data
        } catch (e: any) {
            console.error('Error adding photo:', e)
            error.value = e.message
            throw e
        }
    }

    const deletePhoto = async (photoId: number) => {
        try {
            const { error: err } = await supabase
                .from('trip_photos')
                .delete()
                .eq('id', photoId)

            if (err) throw err

            photos.value = photos.value.filter(p => p.id !== photoId)
        } catch (e: any) {
            console.error('Error deleting photo:', e)
            error.value = e.message
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
