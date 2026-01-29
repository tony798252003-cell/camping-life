import { supabase } from '../lib/supabase'
import type {
    CampingTripWithCampsite,
    NewCampingTrip,
    CampingGear,
    NewGearItem,
    TripPhoto,
    NewTripPhoto,
    SystemAsset
} from '../types/database'

/**
 * Type-safe Supabase query helpers
 * Eliminates the need for 'as any' type casts
 */

// ============ Trip Queries ============

export const tripQueries = {
    /**
     * Fetch all trips for a user or family
     */
    async fetchAll(userId: string, familyId?: string | null) {
        let query = supabase
            .from('camping_trips')
            .select('*, campsites(*), tent:camping_gear!tent_id(name, image_url, brand)')
            .order('trip_date', { ascending: false })

        if (familyId) {
            query = query.eq('family_id', familyId)
        } else {
            query = query.eq('user_id', userId)
        }

        const { data, error } = await query

        if (error) throw error
        return (data as unknown as CampingTripWithCampsite[]) || []
    },

    /**
     * Create a new trip
     */
    async create(tripData: NewCampingTrip) {
        const { data, error } = await supabase
            .from('camping_trips')
            .insert([tripData as any])
            .select()
            .single()

        if (error) throw error
        return data
    },

    /**
     * Update an existing trip
     */
    async update(tripId: number, tripData: Partial<NewCampingTrip>) {
        const { data, error } = await supabase
            .from('camping_trips')
            .update(tripData as any)
            .eq('id', tripId)
            .select()
            .single()

        if (error) throw error
        return data
    },

    /**
     * Delete a trip
     */
    async delete(tripId: number) {
        const { error } = await supabase
            .from('camping_trips')
            .delete()
            .eq('id', tripId)

        if (error) throw error
    }
}

// ============ Gear Queries ============

export const gearQueries = {
    /**
     * Fetch all gear for a user
     */
    async fetchAll(userId: string) {
        const { data, error } = await supabase
            .from('camping_gear')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: true })

        if (error) throw error
        return (data as CampingGear[]) || []
    },

    /**
     * Create new gear item
     */
    async create(gearData: NewGearItem) {
        const { data, error } = await supabase
            .from('camping_gear')
            .insert([gearData as any])
            .select()
            .single()

        if (error) throw error
        return data as CampingGear
    },

    /**
     * Update gear item
     */
    async update(gearId: number, gearData: Partial<NewGearItem>) {
        const { error } = await supabase
            .from('camping_gear')
            .update(gearData as any)
            .eq('id', gearId)

        if (error) throw error
    },

    /**
     * Delete gear item
     */
    async delete(gearId: number) {
        const { error } = await supabase
            .from('camping_gear')
            .delete()
            .eq('id', gearId)

        if (error) throw error
    }
}

// ============ Photo Queries ============

export const photoQueries = {
    /**
     * Fetch photos for a trip
     */
    async fetchByTrip(tripId: number) {
        const { data, error } = await supabase
            .from('trip_photos')
            .select('*')
            .eq('trip_id', tripId)
            .order('created_at', { ascending: false })

        if (error) throw error
        return (data as TripPhoto[]) || []
    },

    /**
     * Add a photo to a trip
     */
    async create(photoData: NewTripPhoto) {
        const { data, error } = await supabase
            .from('trip_photos')
            .insert([photoData as any])
            .select()
            .single()

        if (error) throw error
        return data as TripPhoto
    },

    /**
     * Delete a photo
     */
    async delete(photoId: number) {
        const { error } = await supabase
            .from('trip_photos')
            .delete()
            .eq('id', photoId)

        if (error) throw error
    }
}

// ============ System Asset Queries ============

export const systemAssetQueries = {
    /**
     * Fetch system assets by type
     */
    async fetchByType(type: string) {
        const { data, error } = await supabase
            .from('system_assets')
            .select('*')
            .eq('type', type)
            .order('created_at', { ascending: false })

        if (error) throw error
        return (data as SystemAsset[]) || []
    },

    /**
     * Create system asset
     */
    async create(assetData: Omit<SystemAsset, 'id' | 'created_at'>) {
        const { data, error } = await supabase
            .from('system_assets')
            .insert([assetData as any])
            .select()
            .single()

        if (error) throw error
        return data as SystemAsset
    },

    /**
     * Update system asset
     */
    async update(assetId: number, assetData: Partial<SystemAsset>) {
        const { error } = await supabase
            .from('system_assets')
            .update(assetData as any)
            .eq('id', assetId)

        if (error) throw error
    },

    /**
     * Delete system asset
     */
    async delete(assetId: number) {
        const { error } = await supabase
            .from('system_assets')
            .delete()
            .eq('id', assetId)

        if (error) throw error
    }
}
