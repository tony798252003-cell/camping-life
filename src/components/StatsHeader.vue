<script setup lang="ts">
import { computed } from 'vue'
import { Tent } from 'lucide-vue-next'
import type { CampingTrip } from '../types/database'

interface Props {
  trips: CampingTrip[]
}

const props = defineProps<Props>()

const stats = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // 只統計「已完成」的露營 (日期早於今天)
  const pastTrips = props.trips.filter(trip => new Date(trip.trip_date) < today)
  const totalTrips = pastTrips.length

  return { totalTrips }
})
</script>

<template>
  <div class="mb-8">
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex items-center justify-between">
      <div>
        <p class="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">累計露營</p>
        <p class="text-5xl font-black text-gray-800 tracking-tight">{{ stats.totalTrips }} <span class="text-xl font-medium text-gray-400">次</span></p>
      </div>
      <div class="w-20 h-20 rounded-3xl bg-blue-50 flex items-center justify-center text-blue-500 shadow-sm border border-blue-100">
        <Tent class="w-10 h-10" />
      </div>
    </div>
  </div>
</template>
