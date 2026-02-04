<script setup lang="ts">
import { computed, ref } from 'vue'
import type { CampingTripWithCampsite } from '../../types/database'
import { TAIWAN_MAP_PATHS } from '../../constants/taiwanMapSvg'

const props = defineProps<{
  trips: CampingTripWithCampsite[]
}>()

// 過濾掉離島以優化置中顯示
const mapPaths = computed(() => {
  return TAIWAN_MAP_PATHS.filter(city => 
    !['金門縣', '連江縣', '澎湖縣'].includes(city.id)
  )
})

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

// 顏色插值函數
const interpolateColor = (color1: number[], color2: number[], factor: number): string => {
  const f = Math.max(0, Math.min(1, factor))
  const c1 = color1
  const c2 = color2
  
  const r = Math.round((c1[0] || 0) + f * ((c2[0] || 0) - (c1[0] || 0)))
  const g = Math.round((c1[1] || 0) + f * ((c2[1] || 0) - (c1[1] || 0)))
  const b = Math.round((c1[2] || 0) + f * ((c2[2] || 0) - (c1[2] || 0)))
  
  return `rgb(${r}, ${g}, ${b})`
}

// 計算縣市顏色（基於露營次數的連續漸層）
const getCityColor = (cityId: string): string => {
  const count = getCityCount(cityId)

  // 0 次露營：顯示淺灰背景 (Slate-100)
  if (count === 0) return 'rgb(241, 245, 249)'

  const max = maxCount.value
  
  // 定義漸層的起始與結束顏色
  // Start (1次): Sky-200 [186, 230, 253]
  // End (最高次): Sky-700 [3, 105, 161]
  const startColor = [186, 230, 253]
  const endColor = [3, 105, 161]

  // 計算漸層比例
  // 如果最大次數是 1，直接用起始色
  if (max <= 1) return `rgb(${startColor[0]}, ${startColor[1]}, ${startColor[2]})`
  
  // 線性插值： (count - 1) / (max - 1)
  // 這樣 1 次的時候是 startColor，max 次的時候是 endColor
  const factor = (count - 1) / (max - 1)
  
  return interpolateColor(startColor, endColor, factor)
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
  <div class="relative w-full h-full flex items-center justify-center py-4
            bg-transparent">
    <svg
      viewBox="160 110 260 400"
      class="w-full max-w-md h-[400px]"
      xmlns="http://www.w3.org/2000/svg"
      @mouseleave="hoveredCity = null"
    >


      <!-- 渲染每個縣市 -->
      <path
        v-for="city in mapPaths"
        :key="city.id"
        :d="city.path"
        :fill="getCityColor(city.id)"
        :stroke="hoveredCity === city.id ? '#fbbf24' : '#64748b'"
        :stroke-width="hoveredCity === city.id ? 2 : 1"
        class="transition-all duration-200 ease-out cursor-pointer hover:brightness-125"
        :class="{ 'scale-[1.02] origin-center': hoveredCity === city.id }"
        @mouseenter="onCityHover(city.id, $event)"
        @mousemove="onCityMove($event)"
      />


    </svg>

    <!-- Tooltip -->
    <div
      v-if="hoveredCity"
      :style="tooltipStyle"
      class="absolute pointer-events-none z-50
             bg-slate-900/80 backdrop-blur-md
             border border-cyan-400/40 shadow-[0_0_20px_rgba(6,182,212,0.3)]
             rounded-xl px-4 py-2.5"
    >
      <div class="font-bold text-cyan-100 text-sm">
        {{ getCityName(hoveredCity) }}
      </div>
      <div v-if="getCityCount(hoveredCity) > 0" class="text-white text-xs mt-0.5">
        露營 {{ getCityCount(hoveredCity) }} 次
      </div>
      <div v-else class="text-slate-400 text-xs mt-0.5">
        尚無記錄
      </div>
    </div>
  </div>
</template>
