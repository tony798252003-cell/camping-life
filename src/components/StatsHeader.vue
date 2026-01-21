<script setup lang="ts">
import { computed } from 'vue'
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
  <div class="mb-4">
    <div class="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 p-6 flex flex-col items-center justify-center text-center">
      <div class="text-gray-400 text-sm font-medium uppercase tracking-widest mb-2 font-['Outfit']">累計露營</div>
      <div class="flex items-baseline justify-center">
        <span class="text-8xl font-black text-primary-600 tracking-tighter leading-none font-['Outfit']">{{ stats.totalTrips }}</span>
        <span class="text-2xl font-bold text-gray-300 ml-2">次</span>
      </div>
    </div>
  </div>
</template>
