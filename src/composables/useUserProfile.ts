import { ref } from 'vue'
import { supabase } from '../lib/supabase'
import { profileQueries } from '../services/db/profile'
import type { Profile } from '../types/database'
import { useNotification } from './useNotification'

// 模組層級 ref（singleton）：登出時 reset()
export interface UserProfileState {
    latitude: number
    longitude: number
    location_name: string
    is_admin: boolean
    family_id?: string | null
}
const userProfile = ref<UserProfileState | null>(null)
const showCpbl = ref(false)
const loading = ref(false)

/**
 * User profile state management
 * Handles user profile data and family information
 */
export function useUserProfile() {
    const { error: notifyError } = useNotification()

    /**
     * Fetch user profile from database
     */
    const fetchProfile = async (userId: string) => {
        loading.value = true
        try {
            console.log('[useUserProfile] Fetching profile for user:', userId)

            const { data, error } = await supabase
                .from('profiles')
                .select('latitude, longitude, location_name, is_admin, family_id, show_cpbl')
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
                    family_id: profileData.family_id
                }
                showCpbl.value = !!profileData.show_cpbl
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
        showCpbl.value = false
    }

    /**
     * 樂觀更新中職開關，失敗時復原並提示
     */
    const setShowCpbl = async (v: boolean) => {
        const { data } = await supabase.auth.getUser()
        const userId = data.user?.id
        if (!userId) return
        const prev = showCpbl.value
        showCpbl.value = v
        try {
            await profileQueries.setShowCpbl(userId, v)
        } catch (e) {
            console.error('[useUserProfile] setShowCpbl error:', e)
            showCpbl.value = prev
            notifyError('更新失敗，請檢查網路')
        }
    }

    return {
        // State
        userProfile,
        showCpbl,
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
        clearProfile,
        reset: clearProfile,
        setShowCpbl
    }
}
