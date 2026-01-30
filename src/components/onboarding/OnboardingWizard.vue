<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuth } from '../../composables/useAuth'
import { useUserProfile } from '../../composables/useUserProfile'
import { useOnboarding } from '../../composables/useOnboarding'
import { gearQueries } from '../../services/supabaseQueries'
import OnboardingStepFamily from './OnboardingStepFamily.vue'
import OnboardingStepOrigin from './OnboardingStepOrigin.vue'
import OnboardingStepTent from './OnboardingStepTent.vue'

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  complete: []
  close: []
}>()

const { session } = useAuth()
const { userProfile, updateProfile } = useUserProfile()
const { currentStep, nextStep, previousStep, completeOnboarding } = useOnboarding()

// State for wizard data
const familyChoice = ref<'create' | 'join' | 'skip' | null>(null)
const originData = ref({ location_name: '', latitude: null as number | null, longitude: null as number | null })
const tentData = ref({ name: '', brand: '', image_url: '' })

// Handler functions
const handleFamilyNext = async (choice: 'create' | 'join' | 'skip') => {
  familyChoice.value = choice

  if (choice === 'join' && session.value) {
    // Join family completes onboarding
    const success = await completeOnboarding(session.value.user.id)
    if (success) {
      emit('complete')
    }
  } else {
    // Create or skip -> continue to step 2
    nextStep()
  }
}

const handleOriginNext = (data: { location_name: string; latitude: number; longitude: number }) => {
  originData.value = data
  nextStep()
}

const handleOriginSkip = () => {
  nextStep()
}

const handleTentNext = async (data: { name: string; brand: string; image_url: string }) => {
  if (!session.value) return

  tentData.value = data

  try {
    // Update profile with origin data (if set)
    if (originData.value.latitude && originData.value.longitude) {
      await updateProfile(session.value.user.id, {
        location_name: originData.value.location_name,
        latitude: originData.value.latitude,
        longitude: originData.value.longitude
      })
    }

    // Create tent gear
    await gearQueries.create({
      name: tentData.value.name,
      brand: tentData.value.brand,
      category: 'tent',
      image_url: tentData.value.image_url,
      user_id: session.value.user.id,
      family_id: userProfile.value?.family_id || null,
      price: 0,
      purchase_date: new Date().toISOString().split('T')[0],
      status: 'active',
      is_consumable: false,
      base_usage_count: 0,
      rental_price: 0,
      cost: 0
    })

    // Complete onboarding
    await completeOnboarding(session.value.user.id)

    emit('complete')
  } catch (error) {
    console.error('[OnboardingWizard] Save error:', error)
  }
}

const handleTentSkip = async () => {
  if (!session.value) return

  try {
    // Update profile with origin data (if set)
    if (originData.value.latitude && originData.value.longitude) {
      await updateProfile(session.value.user.id, {
        location_name: originData.value.location_name,
        latitude: originData.value.latitude,
        longitude: originData.value.longitude
      })
    }

    // Complete onboarding
    await completeOnboarding(session.value.user.id)

    emit('complete')
  } catch (error) {
    console.error('[OnboardingWizard] Save error:', error)
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
        <div class="relative z-10 min-h-screen flex items-center justify-center p-4">
          <div class="w-full max-w-2xl bg-white/80 backdrop-blur-xl rounded-[2.5rem] p-6 md:p-12 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60">
            <!-- Progress indicator -->
            <div class="flex gap-2 mb-8">
              <div class="h-1 flex-1 rounded-full transition-colors" :class="currentStep >= 1 ? 'bg-primary-500' : 'bg-gray-200'"></div>
              <div class="h-1 flex-1 rounded-full transition-colors" :class="currentStep >= 2 ? 'bg-primary-500' : 'bg-gray-200'"></div>
              <div class="h-1 flex-1 rounded-full transition-colors" :class="currentStep >= 3 ? 'bg-primary-500' : 'bg-gray-200'"></div>
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
                  @back="previousStep"
                />
              </div>

              <div v-else-if="currentStep === 3" key="step-3">
                <OnboardingStepTent
                  :initial-data="tentData"
                  @next="handleTentNext"
                  @skip="handleTentSkip"
                  @back="previousStep"
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
