import { ref } from 'vue'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types/database'

/**
 * User profile state management
 * Handles user profile data and family information
 */
export function useUserProfile() {
    const userProfile = ref<{
        latitude: number
        longitude: number
        location_name: string
        is_admin: boolean
        family_id?: string | null
        onboarding_completed_at?: string | null
    } | null>(null)

    const loading = ref(false)

    /**
     * Fetch user profile from database
     */
    const fetchProfile = async (userId: string) => {
        loading.value = true
        try {
            console.log('[useUserProfile] Fetching profile for user:', userId)

            const { data, error } = await supabase
                .from('profiles')
                .select('latitude, longitude, location_name, is_admin, family_id, onboarding_completed_at')
                .eq('id', userId)
                .single()

            if (error) {
                console.warn('[useUserProfile] Profile fetch warning:', error.message)
                return
            }

            if (data) {
                const profileData = data as any
                userProfile.value = {
                    latitude: profileData.latitude || 0,
                    longitude: profileData.longitude || 0,
                    location_name: profileData.location_name || '自訂起點',
                    is_admin: profileData.is_admin || false,
                    family_id: profileData.family_id,
                    onboarding_completed_at: profileData.onboarding_completed_at
                }
            }
        } catch (e: any) {
            if (e.name === 'AbortError' || e.message?.includes('AbortError')) return
            console.error('[useUserProfile] Error loading profile', e)
        } finally {
            loading.value = false
        }
    }

    /**
     * Update user profile
     */
    const updateProfile = async (userId: string, updates: Partial<Profile>) => {
        loading.value = true
        try {
            const { error } = await supabase
                .from('profiles')
                // @ts-expect-error - Supabase type inference limitation
                .update(updates)
                .eq('id', userId)

            if (error) throw error

            // Refresh profile
            await fetchProfile(userId)
        } catch (error) {
            console.error('[useUserProfile] Update error:', error)
            throw error
        } finally {
            loading.value = false
        }
    }

    /**
     * Clear profile data (on logout)
     */
    const clearProfile = () => {
        userProfile.value = null
    }

    return {
        // State
        userProfile,
        loading,

        // Computed getters
        familyId: () => userProfile.value?.family_id,
        isAdmin: () => userProfile.value?.is_admin || false,
        userOrigin: () => userProfile.value ? {
            latitude: userProfile.value.latitude,
            longitude: userProfile.value.longitude,
            location_name: userProfile.value.location_name
        } : null,

        // Methods
        fetchProfile,
        updateProfile,
        clearProfile
    }
}
