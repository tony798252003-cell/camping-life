import { supabase } from '../../lib/supabase'
import type { TripPhoto, NewTripPhoto } from '../../types/database'

export const MAX_PHOTOS_PER_USER_PER_TRIP = 3

export const tripPhotoQueries = {
  async fetchByTrip(tripId: number): Promise<TripPhoto[]> {
    const { data, error } = await supabase
      .from('trip_photos')
      .select('*')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data || []
  },

  async countByUser(tripId: number, userId: string): Promise<number | null> {
    const { count, error } = await supabase
      .from('trip_photos')
      .select('*', { count: 'exact', head: true })
      .eq('trip_id', tripId)
      .eq('user_id', userId)
    if (error) throw error
    return count
  },

  async insert(photoData: NewTripPhoto): Promise<TripPhoto> {
    const { data, error } = await supabase.from('trip_photos').insert(photoData).select().single()
    if (error) throw error
    return data
  },

  async remove(photoId: number): Promise<void> {
    const { error } = await supabase.from('trip_photos').delete().eq('id', photoId)
    if (error) throw error
  },
}
