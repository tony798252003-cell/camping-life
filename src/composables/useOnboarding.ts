import { ref, computed } from 'vue'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types/database'

export function useOnboarding() {
    const isOnboardingOpen = ref(false)
    const currentStep = ref(1)
    const isSubmitting = ref(false)

    const shouldShowOnboarding = (
        profile: Profile | null,
        hasTent: boolean
    ): boolean => {
        if (!profile) return false
        if (profile.onboarding_completed_at) return false
        if (profile.family_id) return false

        return !profile.latitude || !profile.longitude || !hasTent
    }

    const openOnboarding = () => {
        isOnboardingOpen.value = true
        currentStep.value = 1
    }

    const closeOnboarding = () => {
        isOnboardingOpen.value = false
        currentStep.value = 1
    }

    const nextStep = () => {
        if (currentStep.value < 3) {
            currentStep.value++
        }
    }

    const previousStep = () => {
        if (currentStep.value > 1) {
            currentStep.value--
        }
    }

    const goToStep = (step: number) => {
        if (step >= 1 && step <= 3) {
            currentStep.value = step
        }
    }

    const completeOnboarding = async (userId: string) => {
        isSubmitting.value = true
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ onboarding_completed_at: new Date().toISOString() })
                .eq('id', userId)

            if (error) throw error

            closeOnboarding()
            return true
        } catch (error) {
            console.error('[useOnboarding] Complete error:', error)
            return false
        } finally {
            isSubmitting.value = false
        }
    }

    return {
        // State
        isOnboardingOpen,
        currentStep,
        isSubmitting,

        // Computed
        shouldShowOnboarding,

        // Methods
        openOnboarding,
        closeOnboarding,
        nextStep,
        previousStep,
        goToStep,
        completeOnboarding
    }
}
