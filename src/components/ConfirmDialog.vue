<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { AlertCircle, AlertTriangle, Info, X } from 'lucide-vue-next'
import { useConfirm } from '../composables/useConfirm'

const { state, handleConfirm, handleCancel } = useConfirm()

const icon = computed(() => {
  switch (state.value.type) {
    case 'danger':
      return AlertCircle
    case 'warning':
      return AlertTriangle
    default:
      return Info
  }
})

const iconColor = computed(() => {
  switch (state.value.type) {
    case 'danger':
      return 'text-red-500'
    case 'warning':
      return 'text-orange-500'
    default:
      return 'text-blue-500'
  }
})

const iconBgColor = computed(() => {
  switch (state.value.type) {
    case 'danger':
      return 'bg-red-50'
    case 'warning':
      return 'bg-orange-50'
    default:
      return 'bg-blue-50'
  }
})

const confirmButtonClass = computed(() => {
  switch (state.value.type) {
    case 'danger':
      return 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
    case 'warning':
      return 'bg-orange-600 hover:bg-orange-700 focus:ring-orange-500'
    default:
      return 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
  }
})

// Keyboard shortcuts
const handleKeydown = (e: KeyboardEvent) => {
  if (!state.value.isOpen) return
  
  if (e.key === 'Enter') {
    e.preventDefault()
    handleConfirm()
  } else if (e.key === 'Escape') {
    e.preventDefault()
    handleCancel()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="dialog">
      <div
        v-if="state.isOpen"
        class="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        @click.self="handleCancel"
      >
        <div
          class="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all"
          @click.stop
        >
          <!-- Header with Icon -->
          <div class="p-6 pb-4">
            <div class="flex items-start gap-4">
              <div :class="[iconBgColor, 'w-12 h-12 rounded-full flex items-center justify-center shrink-0']">
                <component :is="icon" :class="[iconColor, 'w-6 h-6']" />
              </div>
              <div class="flex-1 min-w-0">
                <h3 class="text-lg font-bold text-gray-900 mb-2">
                  {{ state.title }}
                </h3>
                <p class="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                  {{ state.message }}
                </p>
              </div>
              <button
                @click="handleCancel"
                class="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors shrink-0"
              >
                <X class="w-5 h-5" />
              </button>
            </div>
          </div>

          <!-- Actions -->
          <div class="p-6 pt-2 bg-gray-50/50 flex gap-3">
            <button
              @click="handleCancel"
              class="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
            >
              {{ state.cancelText }}
            </button>
            <button
              @click="handleConfirm"
              :class="[
                confirmButtonClass,
                'flex-1 px-4 py-2.5 text-sm font-bold text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors shadow-lg'
              ]"
            >
              {{ state.confirmText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.dialog-enter-active,
.dialog-leave-active {
  transition: opacity 0.2s ease;
}

.dialog-enter-active .bg-white,
.dialog-leave-active .bg-white {
  transition: all 0.2s ease;
}

.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}

.dialog-enter-from .bg-white,
.dialog-leave-to .bg-white {
  transform: scale(0.95);
  opacity: 0;
}
</style>
