<script setup lang="ts">
import { computed } from 'vue'
import { X, MapPin, Tent } from 'lucide-vue-next'
import type { CampingTripWithCampsite } from '../types/database'

const props = defineProps<{
  isOpen: boolean
  title: string
  trips: CampingTripWithCampsite[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'view-trip', trip: CampingTripWithCampsite): void
}>()

const sortedTrips = computed(() => {
  return [...props.trips].sort((a, b) => new Date(b.trip_date).getTime() - new Date(a.trip_date).getTime())
})

const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true">
    <!-- Backdrop -->
    <div class="fixed inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity" @click="emit('close')"></div>

    <!-- Modal Panel -->
    <div class="relative bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200">
        
        <!-- Header -->
        <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-surface-50 shrink-0">
            <h3 class="text-xl font-black text-primary-900 flex items-center gap-2">
                <MapPin class="w-5 h-5 text-sky-500" />
                {{ title }}
                <span class="text-sm font-normal text-gray-500 bg-white px-2 py-0.5 rounded-full border border-gray-200 shadow-sm ml-2">
                    {{ trips.length }} 次露營
                </span>
            </h3>
            <button @click="emit('close')" class="p-2 -mr-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-full transition-all">
                <X class="w-5 h-5" />
            </button>
        </div>

        <!-- Content -->
        <div class="overflow-y-auto p-4 flex-1 min-h-0 bg-surface-50/50">
            <div v-if="sortedTrips.length === 0" class="text-center py-10 text-gray-400">
                <Tent class="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>此縣市尚無露營記錄</p>
            </div>

            <div v-else class="space-y-3">
                <div 
                    v-for="trip in sortedTrips" 
                    :key="trip.id"
                    class="bg-white rounded-2xl p-4 border border-primary-100 shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-[0.98] group"
                    @click="emit('view-trip', trip)"
                >
                   <div class="flex items-start justify-between">
                       <div>
                           <div class="flex items-center gap-2 mb-1">
                               <span class="text-xs font-bold text-primary-500 bg-primary-50 px-2 py-0.5 rounded-full">
                                   {{ formatDate(trip.trip_date) }}
                               </span>
                               <span v-if="trip.night_rush" class="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                                   夜衝
                               </span>
                           </div>
                           <h4 class="font-bold text-lg text-primary-900 group-hover:text-primary-700 transition-colors">
                               {{ trip.campsite_name || trip.campsites?.name || '未命名露營區' }}
                           </h4>
                           <div class="flex items-center gap-1 text-xs text-gray-500 mt-1">
                               <MapPin class="w-3 h-3" />
                               {{ trip.location || '無地點資訊' }}
                           </div>
                       </div>
                   </div>
                </div>
            </div>
        </div>
    </div>
  </div>
</template>
