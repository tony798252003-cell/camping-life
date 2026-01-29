<script setup lang="ts">
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-vue-next'
import { useNotification } from '../composables/useNotification'

const { notifications, remove } = useNotification()

const getIcon = (type: string) => {
  switch (type) {
    case 'success': return CheckCircle
    case 'error': return AlertCircle
    case 'warning': return AlertTriangle
    default: return Info
  }
}

const getColorClasses = (type: string) => {
  switch (type) {
    case 'success': return 'bg-emerald-50 border-emerald-200 text-emerald-800'
    case 'error': return 'bg-red-50 border-red-200 text-red-800'
    case 'warning': return 'bg-amber-50 border-amber-200 text-amber-800'
    default: return 'bg-blue-50 border-blue-200 text-blue-800'
  }
}

const getIconColorClass = (type: string) => {
  switch (type) {
    case 'success': return 'text-emerald-600'
    case 'error': return 'text-red-600'
    case 'warning': return 'text-amber-600'
    default: return 'text-blue-600'
  }
}
</script>

<template>
  <div class="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-md pointer-events-none">
    <TransitionGroup name="toast">
      <div
        v-for="notification in notifications"
        :key="notification.id"
        class="pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-lg backdrop-blur-sm transition-all"
        :class="getColorClasses(notification.type)"
      >
        <component 
          :is="getIcon(notification.type)" 
          class="w-5 h-5 flex-shrink-0 mt-0.5"
          :class="getIconColorClass(notification.type)"
        />
        
        <p class="flex-1 text-sm font-medium leading-snug">
          {{ notification.message }}
        </p>
        
        <button 
          @click="remove(notification.id)"
          class="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
        >
          <X class="w-4 h-4" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(100px);
}

.toast-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}

.toast-move {
  transition: transform 0.3s ease;
}
</style>
