
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { X, Clock, Users, Lock, Palette } from 'lucide-vue-next'
import type { NewCalendarEvent, CalendarEvent } from '../types/database'

const props = defineProps<{
    isOpen: boolean
    initialDate?: Date | null
    editEvent?: CalendarEvent | null
    isFamilyMode?: boolean
}>()

const emit = defineEmits<{
    (e: 'close'): void
    (e: 'save', event: NewCalendarEvent & { _isPrivate?: boolean }): void
    (e: 'delete', id: string): void
}>()

const isSubmitting = ref(false)
const title = ref('')
const description = ref('')
const startDate = ref('')
const startTime = ref('09:00')
const endDate = ref('')
const endTime = ref('10:00')
const isAllDay = ref(true)
const isFamily = ref(true) // Default to family shared
const color = ref('#3b82f6') // Default Blue

const colors = [
    { value: '#3b82f6', label: '藍色' },
    { value: '#ef4444', label: '紅色' },
    { value: '#10b981', label: '綠色' },
    { value: '#f59e0b', label: '橘色' },
    { value: '#8b5cf6', label: '紫色' },
    { value: '#ec4899', label: '粉色' },
    { value: '#64748b', label: '灰色' },
]

// Initialize form when opening
watch(() => props.isOpen, (newVal) => {
    if (newVal) {
        if (props.editEvent) {
             title.value = props.editEvent.title
             description.value = props.editEvent.description || ''
             const start = new Date(props.editEvent.start_time)
             const end = new Date(props.editEvent.end_time)
             startDate.value = start.toISOString().split('T')[0] || ''
             startTime.value = start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
             endDate.value = end.toISOString().split('T')[0] || ''
             endTime.value = end.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
             isAllDay.value = props.editEvent.is_all_day
             color.value = props.editEvent.color
             // If family_id exists, it's shared. If null, it's private.
             isFamily.value = !!props.editEvent.family_id
        } else {
             // New Event
             title.value = ''
             description.value = ''
             const d = props.initialDate || new Date()
             // Use local ISO-like string for default
             const year = d.getFullYear()
             const month = String(d.getMonth() + 1).padStart(2, '0')
             const day = String(d.getDate()).padStart(2, '0')
             const todayStr = `${year}-${month}-${day}`
             
             startDate.value = todayStr
             endDate.value = todayStr
             // Inherit family preference or default
             isFamily.value = props.isFamilyMode !== undefined ? props.isFamilyMode : true 
             color.value = '#3b82f6'
        }
    }
})

const isValid = computed(() => title.value.trim().length > 0 && startDate.value && endDate.value)

// Ensure End Date is never before Start Date
watch(startDate, (newStart) => {
    if (newStart && endDate.value && newStart > endDate.value) {
        endDate.value = newStart
    }
})

const handleSave = async () => {
    if (!isValid.value || isSubmitting.value) return

    isSubmitting.value = true
    try {
        // Construct timestamps carefully to preserve Local Date intent
        // format: YYYY-MM-DDTHH:mm:ss
        // For All Day events, use 12:00:00 (Noon) to avoid timezone shifts at 00:00/23:59 boundary
        const startIsoString = `${startDate.value}T${isAllDay.value ? '12:00:00' : startTime.value}`
        const endIsoString = `${endDate.value}T${isAllDay.value ? '12:00:00' : endTime.value}`

        const start = new Date(startIsoString)
        const end = new Date(endIsoString)

        const eventData: NewCalendarEvent = {
            title: title.value,
            description: description.value,
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            is_all_day: isAllDay.value,
            color: color.value,
        }

        emit('save', {
            ...eventData,
            // @ts-ignore: Temporary hack, parent will handle family_id assignment
            _isPrivate: !isFamily.value
        })
    } finally {
        isSubmitting.value = false
    }
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="$emit('close')"></div>
      
      <div class="relative w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
          <!-- Header -->
          <div class="px-6 py-4 bg-surface-50 border-b flex items-center justify-between">
              <h3 class="text-lg font-bold text-gray-800">
                  {{ editEvent ? '編輯行程' : '新增行程' }}
              </h3>
              <button @click="$emit('close')" class="p-2 hover:bg-gray-200 rounded-full transition-colors">
                  <X class="w-5 h-5 text-gray-500" />
              </button>
          </div>

          <!-- Body -->
          <div class="p-6 overflow-y-auto space-y-6">
              <!-- Title -->
              <div class="space-y-2">
                  <label class="text-sm font-bold text-gray-700">標題</label>
                  <input 
                    v-model="title" 
                    type="text" 
                    placeholder="例如：購買裝備、家庭聚餐"
                    class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all"
                  />
              </div>

               <!-- Color Picker -->
               <div class="space-y-2">
                  <label class="text-sm font-bold text-gray-700 flex items-center gap-2">
                      <Palette class="w-4 h-4" /> 標籤顏色
                  </label>
                  <div class="flex flex-wrap gap-2">
                      <button 
                        v-for="c in colors" 
                        :key="c.value"
                        @click="color = c.value"
                        class="w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 flex items-center justify-center"
                        :class="color === c.value ? 'border-gray-600 scale-110' : 'border-transparent'"
                        :style="{ backgroundColor: c.value }"
                        :title="c.label"
                      >
                         <span v-if="color === c.value" class="text-white text-xs font-bold">✓</span>
                      </button>
                  </div>
              </div>

              <!-- Time -->
              <div class="space-y-4 bg-surface-50 p-4 rounded-xl border border-gray-100">
                  <div class="flex items-center justify-between">
                     <label class="flex items-center gap-2 text-sm font-bold text-gray-700">
                         <Clock class="w-4 h-4" /> 全天
                     </label>
                      <button 
                        @click="isAllDay = !isAllDay" 
                        class="w-12 h-6 rounded-full p-1 transition-colors duration-200 ease-in-out relative"
                        :class="isAllDay ? 'bg-primary-500' : 'bg-gray-300'"
                      >
                         <div class="w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform" :class="isAllDay ? 'translate-x-6' : 'translate-x-0'"></div>
                      </button>
                  </div>

                  <div class="grid grid-cols-2 gap-4">
                      <div class="space-y-1">
                          <label class="text-xs text-gray-500">開始</label>
                          <input v-model="startDate" type="date" class="w-full p-2 rounded-lg border border-gray-200 bg-white" />
                          <input v-if="!isAllDay" v-model="startTime" type="time" class="w-full p-2 rounded-lg border border-gray-200 bg-white mt-1" />
                      </div>
                      <div class="space-y-1">
                          <label class="text-xs text-gray-500">結束</label>
                          <input 
                            v-model="endDate" 
                            type="date" 
                            :min="startDate"
                            class="w-full p-2 rounded-lg border border-gray-200 bg-white" 
                          />
                          <input v-if="!isAllDay" v-model="endTime" type="time" class="w-full p-2 rounded-lg border border-gray-200 bg-white mt-1" />
                      </div>
                  </div>
              </div>

              <!-- Family Share -->
              <div class="flex items-center justify-between p-4 border border-gray-200 rounded-xl" :class="isFamily ? 'bg-primary-50 border-primary-200' : 'bg-white'">
                  <div class="flex items-center gap-3">
                      <div class="p-2 rounded-full" :class="isFamily ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-500'">
                          <component :is="isFamily ? Users : Lock" class="w-5 h-5" />
                      </div>
                      <div>
                          <p class="font-bold text-sm" :class="isFamily ? 'text-primary-900' : 'text-gray-700'">
                              {{ isFamily ? '家庭共享' : '私人行程' }}
                          </p>
                          <p class="text-xs text-gray-500">
                              {{ isFamily ? '所有家庭成員可見' : '僅自己可見' }}
                          </p>
                      </div>
                  </div>
                  <button 
                    @click="isFamily = !isFamily" 
                    class="text-sm font-bold px-3 py-1.5 rounded-lg transition-colors border"
                    :class="isFamily ? 'bg-white text-primary-600 border-primary-200' : 'bg-gray-100 text-gray-600 border-gray-200'"
                  >
                      切換
                  </button>
              </div>

              <!-- Notes -->
              <div class="space-y-2">
                  <label class="text-sm font-bold text-gray-700">備註</label>
                  <textarea 
                    v-model="description" 
                    rows="3" 
                    class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all resize-none"
                    placeholder="新增備註..."
                  ></textarea>
              </div>
          </div>

          <!-- Footer -->
          <div class="p-4 bg-surface-50 border-t flex gap-3">
              <button 
                v-if="editEvent" 
                @click="$emit('delete', editEvent.id)" 
                class="px-4 py-3 rounded-xl font-bold text-red-500 hover:bg-red-50 transition-colors"
              >
                  刪除
              </button>
              <div class="flex-1"></div>
              <button 
                @click="$emit('close')" 
                class="px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors"
              >
                  取消
              </button>
              <button
                @click="handleSave"
                :disabled="!isValid || isSubmitting"
                class="px-8 py-3 rounded-xl font-bold text-white bg-primary-600 hover:bg-primary-500 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95"
              >
                  {{ isSubmitting ? '儲存中...' : '儲存' }}
              </button>
          </div>
      </div>
  </div>
</template>
