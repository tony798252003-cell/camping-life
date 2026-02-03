<script setup lang="ts">
import { computed, ref } from 'vue'
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

// 計算縣市顏色（基於露營次數）
const getCityColor = (cityId: string): string => {
  const count = getCityCount(cityId)

  if (count === 0) {
    // 未去過：深灰色
    return '#334155'
  }

  // 有資料：藍綠色漸層
  // 使用 HSL: hsl(199, 89%, L%)
  // 亮度從 70% (淺色，少次) 到 40% (深色，多次)
  const intensity = count / maxCount.value
  const lightness = 70 - intensity * 30 // 70% -> 40%

  return `hsl(199, 89%, ${lightness}%)`
}

// Hover 狀態
const hoveredCity = ref<string | null>(null)
const tooltipPosition = ref({ x: 0, y: 0 })

// Tooltip 樣式
const tooltipStyle = computed(() => ({
  left: `${tooltipPosition.value.x + 15}px`,
  top: `${tooltipPosition.value.y - 10}px`,
  transform: 'translateY(-100%)'
}))

// 處理縣市 hover
const onCityHover = (cityId: string, event: MouseEvent) => {
  hoveredCity.value = cityId
  updateTooltipPosition(event)
}

// 處理滑鼠移動
const onCityMove = (event: MouseEvent) => {
  if (hoveredCity.value) {
    updateTooltipPosition(event)
  }
}

// 更新 tooltip 位置
const updateTooltipPosition = (event: MouseEvent) => {
  const svg = (event.currentTarget as HTMLElement).closest('svg')
  if (!svg) return

  const rect = svg.getBoundingClientRect()
  tooltipPosition.value = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  }
}
</script>

<template>
  <div class="relative w-full h-full flex items-center justify-center py-4">
    <svg
      viewBox="0 0 420 520"
      class="w-full max-w-md h-[400px]"
      xmlns="http://www.w3.org/2000/svg"
      @mouseleave="hoveredCity = null"
    >
      <!-- 渲染每個縣市 -->
      <path
        v-for="city in TAIWAN_MAP_PATHS"
        :key="city.id"
        :d="city.path"
        :fill="getCityColor(city.id)"
        :stroke="hoveredCity === city.id ? '#fbbf24' : '#1e293b'"
        :stroke-width="hoveredCity === city.id ? 2 : 0.5"
        class="transition-all duration-200 cursor-pointer"
        @mouseenter="onCityHover(city.id, $event)"
        @mousemove="onCityMove($event)"
      />
    </svg>

    <!-- Tooltip -->
    <div
      v-if="hoveredCity"
      :style="tooltipStyle"
      class="absolute pointer-events-none bg-slate-900/95 border border-sky-400/30
             rounded-lg px-3 py-2 text-sm backdrop-blur-sm shadow-xl z-50"
    >
      <div class="font-bold text-sky-200">{{ getCityName(hoveredCity) }}</div>
      <div v-if="getCityCount(hoveredCity) > 0" class="text-white text-xs">
        {{ getCityCount(hoveredCity) }} 次
      </div>
      <div v-else class="text-slate-400 text-xs">尚無記錄</div>
    </div>
  </div>
</template>
