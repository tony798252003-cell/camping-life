<script setup lang="ts">
import { ref, computed } from 'vue'
import { useUserProfile } from '../../composables/useUserProfile'
import { useOnboarding } from '../../composables/useOnboarding'
import { gearQueries } from '../../services/supabaseQueries'
import OnboardingStepFamily from './OnboardingStepFamily.vue'
import OnboardingStepOrigin from './OnboardingStepOrigin.vue'
import OnboardingStepTent from './OnboardingStepTent.vue'

const props = defineProps<{
  isOpen: boolean
  userId?: string
  userProfile?: any
  currentStep?: number
  isSubmitting?: boolean
}>()

const emit = defineEmits<{
  complete: []
  close: []
  next: []
  previous: []
}>()

const { updateProfile } = useUserProfile()
const { completeOnboarding } = useOnboarding()

// Use props or fallback to composables
const userId = computed(() => props.userId)
const userProfile = computed(() => props.userProfile)

// State for wizard data
const familyChoice = ref<'create' | 'join' | 'skip' | null>(null)
const originData = ref({ location_name: '', latitude: null as number | null, longitude: null as number | null })
const tentData = ref({ name: '', brand: '', image_url: '' })
const isProcessing = ref(false)

// Handler functions
const handleFamilyNext = async (choice: 'create' | 'join' | 'skip') => {
  familyChoice.value = choice

  if (choice === 'join' && userId.value) {
    // Join family completes onboarding
    const success = await completeOnboarding(userId.value)
    if (success) {
      emit('complete')
    }
  } else {
    // Create or skip -> continue to step 2
    emit('next')
  }
}

const handleOriginNext = (data: { location_name: string; latitude: number; longitude: number }) => {
  originData.value = data
  emit('next')
}

const handleOriginSkip = () => {
  emit('next')
}

const handleTentNext = async (data: { name: string; brand: string; image_url: string }) => {
  console.log('[OnboardingWizard] handleTentNext called with:', data)

  if (isProcessing.value) {
    console.warn('[OnboardingWizard] Already processing, ignoring duplicate submission')
    return
  }

  if (!userId.value) {
    console.error('[OnboardingWizard] No user ID found')
    alert('請先登入')
    return
  }

  isProcessing.value = true
  tentData.value = data

  try {
    console.log('[OnboardingWizard] Updating profile...')
    // Update profile with origin data (if set)
    if (originData.value.latitude && originData.value.longitude) {
      await updateProfile(userId.value, {
        location_name: originData.value.location_name,
        latitude: originData.value.latitude,
        longitude: originData.value.longitude
      })
    }

    console.log('[OnboardingWizard] Creating tent gear...')
    // Create tent gear matching your actual database schema
    const gearData: any = {
      name: tentData.value.name,
      image_url: tentData.value.image_url,
      user_id: userId.value,
      type: 'tent',
      category: 'tent',
      cost: 0,
      rental_price: 0,
      base_usage_count: 0,
      usage_count: 0,
      family_id: userProfile.value?.family_id || null
    }

    // Add brand if provided
    if (tentData.value.brand) {
      gearData.brand = tentData.value.brand
    }

    try {
      await gearQueries.create(gearData)
      console.log('[OnboardingWizard] Tent gear created successfully')
    } catch (error: any) {
      console.error('[OnboardingWizard] Failed to create tent gear:', error)
      alert('建立帳篷失敗：' + error.message)
      throw error
    }

    console.log('[OnboardingWizard] Completing onboarding...')
    // Complete onboarding
    await completeOnboarding(userId.value)

    console.log('[OnboardingWizard] Onboarding completed! Emitting complete event')
    emit('complete')
  } catch (error: any) {
    console.error('[OnboardingWizard] Error in handleTentNext:', error)
    alert('儲存失敗：' + (error.message || '未知錯誤'))
    isProcessing.value = false
  }
}

const handleTentSkip = async () => {
  console.log('[OnboardingWizard] handleTentSkip called')

  if (isProcessing.value) {
    console.warn('[OnboardingWizard] Already processing, ignoring duplicate skip')
    return
  }

  if (!userId.value) {
    console.error('[OnboardingWizard] No user ID found')
    alert('請先登入')
    return
  }

  isProcessing.value = true

  try {
    console.log('[OnboardingWizard] Skipping tent, updating profile...')
    // Update profile with origin data (if set)
    if (originData.value.latitude && originData.value.longitude) {
      await updateProfile(userId.value, {
        location_name: originData.value.location_name,
        latitude: originData.value.latitude,
        longitude: originData.value.longitude
      })
    }

    console.log('[OnboardingWizard] Completing onboarding...')
    // Complete onboarding
    await completeOnboarding(userId.value)

    console.log('[OnboardingWizard] Onboarding completed! Emitting complete event')
    emit('complete')
  } catch (error: any) {
    console.error('[OnboardingWizard] Error in handleTentSkip:', error)
    alert('儲存失敗：' + (error.message || '未知錯誤'))
    isProcessing.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="isOpen" class="fixed inset-0 z-50 overflow-hidden">
        <!-- Background with decorations -->
        <div class="absolute inset-0 bg-surface-50">
          <div class="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary-100/50 rounded-full blur-[100px]"></div>
          <div class="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-accent-orange/10 rounded-full blur-[100px]"></div>
        </div>

        <!-- Main content -->
        <div class="relative z-10 min-h-screen flex items-center justify-center p-4 overflow-y-auto">
          <div class="w-full max-w-2xl bg-white/80 backdrop-blur-xl rounded-[2.5rem] p-6 md:p-12 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 my-8">
            <!-- Progress indicator -->
            <div class="flex gap-2 mb-8">
              <div class="h-1 flex-1 rounded-full transition-colors" :class="(currentStep ?? 0) >= 1 ? 'bg-primary-500' : 'bg-gray-200'"></div>
              <div class="h-1 flex-1 rounded-full transition-colors" :class="(currentStep ?? 0) >= 2 ? 'bg-primary-500' : 'bg-gray-200'"></div>
              <div class="h-1 flex-1 rounded-full transition-colors" :class="(currentStep ?? 0) >= 3 ? 'bg-primary-500' : 'bg-gray-200'"></div>
            </div>

            <!-- Step content -->
            <Transition name="wizard" mode="out-in">
              <div v-if="currentStep === 1" key="step-1">
                <OnboardingStepFamily @next="handleFamilyNext" />
              </div>

              <div v-else-if="currentStep === 2" key="step-2">
                <OnboardingStepOrigin
                  :initial-data="originData"
                  @next="handleOriginNext"
                  @skip="handleOriginSkip"
                  @back="$emit('previous')"
                />
              </div>

              <div v-else-if="currentStep === 3" key="step-3">
                <OnboardingStepTent
                  :initial-data="tentData"
                  @next="handleTentNext"
                  @skip="handleTentSkip"
                  @back="$emit('previous')"
                />
              </div>
            </Transition>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.wizard-enter-active,
.wizard-leave-active {
  transition: all 0.3s ease;
}

.wizard-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.wizard-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}
</style>
