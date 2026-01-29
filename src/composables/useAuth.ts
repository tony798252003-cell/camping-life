import { ref } from 'vue'
import { supabase } from '../lib/supabase'
import type { Session } from '@supabase/supabase-js'

/**
 * Authentication state management
 * Handles user session, login/logout, and auth state changes
 */
export function useAuth() {
    const session = ref<Session | null>(null)
    const isAuthReady = ref(false)
    const loading = ref(false)

    /**
     * Initialize auth state and set up listener
     */
    const initAuth = async () => {
        // Set up auth state listener
        supabase.auth.onAuthStateChange(async (event, _session) => {
            console.log('[useAuth] Auth Change:', event)
            session.value = _session

            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || (event === 'INITIAL_SESSION' && _session)) {
                // Auth successful
            } else if (event === 'SIGNED_OUT') {
                session.value = null
            }

            isAuthReady.value = true
        })

        // Initial session check
        try {
            const { data } = await supabase.auth.getSession()
            if (data.session) {
                session.value = data.session
            }
        } catch (e) {
            console.error('[useAuth] Initial session check failed', e)
        } finally {
            isAuthReady.value = true
        }
    }

    /**
     * Sign out the current user
     */
    const logout = async () => {
        loading.value = true
        try {
            await supabase.auth.signOut()
            session.value = null
        } catch (error) {
            console.error('[useAuth] Logout error:', error)
            throw error
        } finally {
            loading.value = false
        }
    }

    /**
     * Sign in with Google OAuth
     */
    const loginWithGoogle = async () => {
        loading.value = true
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin
                }
            })
            if (error) throw error
        } catch (error) {
            console.error('[useAuth] Login error:', error)
            throw error
        } finally {
            loading.value = false
        }
    }

    return {
        // State
        session,
        isAuthReady,
        loading,

        // Computed
        isAuthenticated: () => session.value !== null,
        userId: () => session.value?.user?.id || null,

        // Methods
        initAuth,
        logout,
        loginWithGoogle
    }
}
