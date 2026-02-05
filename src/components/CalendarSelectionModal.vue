<script setup lang="ts">
import { X, ChevronRight } from 'lucide-vue-next'


// Define the shape of ViewEvent as used in CalendarView
// Ideally this should be exported from a types file, but re-defining for now or importing if possible.
// Since it was defined inline in CalendarView, I'll redefine a compatible interface here.
interface ViewEvent {
    type: 'trip' | 'custom'
    id: string | number
    title: string
    subtitle?: string
    date: Date
    color: string
    data: any 
    isAllDay: boolean
}

defineProps<{
    isOpen: boolean
    date: Date | null
    events: ViewEvent[]
}>()

const emit = defineEmits<{
    (e: 'close'): void
    (e: 'select', event: ViewEvent): void
}>()

const formatDate = (date: Date) => {
    if (!date) return ''
    return date.toLocaleDateString('zh-TW', { month: 'long', day: 'numeric', weekday: 'short' })
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="$emit('close')"></div>
      
      <div class="relative w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in zoom-in duration-200">
          <!-- Header -->
          <div class="px-5 py-3 bg-surface-50 border-b flex items-center justify-between">
              <h3 class="text-base font-black text-gray-800 tracking-tight">
                  {{ formatDate(date!) }} 的行程
              </h3>
              <button @click="$emit('close')" class="p-1.5 hover:bg-gray-200 rounded-full transition-colors">
                  <X class="w-5 h-5 text-gray-400" />
              </button>
          </div>

          <!-- List -->
          <div class="p-4 overflow-y-auto space-y-3">
              <button 
                v-for="event in events" 
                :key="event.id"
                @click="$emit('select', event)"
                class="w-full bg-white rounded-xl p-3 shadow-sm border border-gray-100 flex items-center gap-3 active:scale-98 transition-all hover:border-primary-200 hover:shadow-md group text-left"
              >
                  <!-- Color Indicator -->
                  <div class="w-1.5 self-stretch rounded-full" :style="{ backgroundColor: event.color }"></div>
                  
                  <!-- Content -->
                  <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-1.5 mb-0.5">
                         <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-500 group-hover:bg-primary-50 group-hover:text-primary-600 transition-colors">
                           {{ event.type === 'trip' ? '露營' : '行程' }}
                         </span>
                         <span v-if="!event.isAllDay" class="text-xs text-gray-400 font-mono">
                           {{ new Date(event.date).toLocaleTimeString('zh-TW', {hour:'2-digit', minute:'2-digit'}) }}
                         </span>
                      </div>
                      <h4 class="font-bold text-gray-900 truncate">{{ event.title }}</h4>
                  </div>
                  
                  <ChevronRight class="w-5 h-5 text-gray-300 group-hover:text-primary-400" />
              </button>
          </div>
      </div>
  </div>
</template>
