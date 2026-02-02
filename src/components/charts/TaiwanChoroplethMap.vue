<script setup lang="ts">
import { computed } from 'vue'
import type { CampingTripWithCampsite } from '../../types/database'
import { TAIWAN_MAP_PATHS } from '../../constants/taiwanMapSvg'

const props = defineProps<{
  trips: CampingTripWithCampsite[]
}>()

// 統計各縣市露營次數
const cityStats = computed(() => {
  const counts: Record<string, number> = {}

  props.trips.forEach(trip => {
    const city = trip.campsites?.city
    if (city) {
      counts[city] = (counts[city] || 0) + 1
    }
  })

  return counts
})

// 找出最大次數（用於顏色計算）
const maxCount = computed(() => {
  const values = Object.values(cityStats.value)
  return values.length > 0 ? Math.max(...values) : 1
})

// 取得縣市露營次數
const getCityCount = (cityId: string): number => {
  return cityStats.value[cityId] || 0
}

// 取得縣市顯示名稱
const getCityName = (cityId: string): string => {
  const city = TAIWAN_MAP_PATHS.find(c => c.id === cityId)
  return city?.name || cityId
}

// Temporary: 避免未使用變數錯誤，這些函式將在後續 Task 中使用
void maxCount
void getCityCount
void getCityName
</script>

<template>
  <div class="relative w-full h-full flex items-center justify-center py-4">
    <svg
      viewBox="0 0 400 500"
      class="w-full max-w-md h-[400px]"
      xmlns="http://www.w3.org/2000/svg"
    >
      <!-- SVG paths will be added here -->
      <text x="200" y="250" text-anchor="middle" fill="#94a3b8" font-size="14">
        地圖載入中...
      </text>
    </svg>
  </div>
</template>
