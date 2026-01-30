<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuth } from '../../composables/useAuth'
import { useUserProfile } from '../../composables/useUserProfile'
import { useOnboarding } from '../../composables/useOnboarding'

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

            <!-- Step content (to be implemented) -->
            <div class="min-h-[400px]">
              <p class="text-center text-gray-500">步驟 {{ currentStep }} - 內容待實作</p>
            </div>
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
</style>
