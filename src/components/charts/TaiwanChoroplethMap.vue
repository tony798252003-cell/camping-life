<script setup lang="ts">
import { computed, ref } from 'vue'
import type { CampingTripWithCampsite } from '../../types/database'
import { TAIWAN_MAP_PATHS } from '../../constants/taiwanMapSvg'

const props = defineProps<{
  trips: CampingTripWithCampsite[]
}>()

// 發光等級介面
interface GlowLevel {
  color: string
  filter: string
  opacity: number
}

// 發光等級配置
const GLOW_LEVELS = {
  none: {
    color: 'rgb(51, 65, 85)',
    filter: 'none',
    opacity: 0.6
  },
  weak: {
    color: 'rgb(56, 189, 248)',
    filter: 'url(#glow-weak)',
    opacity: 0.3
  },
  medium: {
    color: 'rgb(34, 211, 238)',
    filter: 'url(#glow-medium)',
    opacity: 0.4
  },
  strong: {
    color: 'rgb(6, 182, 212)',
    filter: 'url(#glow-strong)',
    opacity: 0.5
  }
} as const

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
// @ts-expect-error - 保留供未來使用
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

// 取得縣市發光等級
const getCityLevel = (cityId: string): GlowLevel => {
  const count = getCityCount(cityId)

  if (count === 0) return GLOW_LEVELS.none
  if (count <= 2) return GLOW_LEVELS.weak
  if (count <= 5) return GLOW_LEVELS.medium
  return GLOW_LEVELS.strong
}

// 計算縣市顏色（基於露營次數）
const getCityColor = (cityId: string): string => {
  const level = getCityLevel(cityId)
  const { color, opacity } = level

  // 將 rgb 轉換為 rgba
  return color.replace('rgb', 'rgba').replace(')', `, ${opacity})`)
}

// 取得縣市濾鏡
const getCityFilter = (cityId: string): string => {
  return getCityLevel(cityId).filter
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
      <!-- SVG 濾鏡定義 -->
      <defs>
        <!-- 弱發光濾鏡 (1-2次露營) -->
        <filter id="glow-weak" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="0 0 0 0 0.22
                    0 0 0 0 0.74
                    0 0 0 0 0.97
                    0 0 0 0.6 0"
            result="glow"
          />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <!-- 中等發光濾鏡 (3-5次露營) -->
        <filter id="glow-medium" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="0 0 0 0 0.13
                    0 0 0 0 0.79
                    0 0 0 0 0.93
                    0 0 0 0.8 0"
            result="glow"
          />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <!-- 強發光濾鏡 (6+次露營) -->
        <filter id="glow-strong" x="-50%" y="-50%" width="200%" height="200%">
          <!-- 外層青色發光 -->
          <feGaussianBlur in="SourceGraphic" stdDeviation="16" result="blur1" />
          <feColorMatrix
            in="blur1"
            type="matrix"
            values="0 0 0 0 0.06
                    0 0 0 0 0.83
                    0 0 0 0 0.98
                    0 0 0 1 0"
            result="glow1"
          />
          <!-- 內層白色發光 -->
          <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur2" />
          <feColorMatrix
            in="blur2"
            type="matrix"
            values="0 0 0 0 1
                    0 0 0 0 1
                    0 0 0 0 1
                    0 0 0 0.5 0"
            result="glow2"
          />
          <feMerge>
            <feMergeNode in="glow1" />
            <feMergeNode in="glow2" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <!-- 玻璃高光漸層 -->
        <linearGradient id="glass-highlight" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.4" />
          <stop offset="50%" stop-color="#ffffff" stop-opacity="0.1" />
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
        </linearGradient>
      </defs>

      <!-- 渲染每個縣市 -->
      <path
        v-for="city in TAIWAN_MAP_PATHS"
        :key="city.id"
        :d="city.path"
        :fill="getCityColor(city.id)"
        :filter="getCityFilter(city.id)"
        :stroke="hoveredCity === city.id ? '#fbbf24' : '#1e293b'"
        :stroke-width="hoveredCity === city.id ? 2 : 0.5"
        class="transition-all duration-200 ease-out cursor-pointer hover:brightness-125"
        :class="{ 'scale-[1.02] origin-center': hoveredCity === city.id }"
        @mouseenter="onCityHover(city.id, $event)"
        @mousemove="onCityMove($event)"
      />

      <!-- 玻璃高光覆蓋層 -->
      <path
        v-for="city in TAIWAN_MAP_PATHS"
        :key="`highlight-${city.id}`"
        :d="city.path"
        fill="url(#glass-highlight)"
        :opacity="getCityCount(city.id) > 0 ? 0.6 : 0"
        class="pointer-events-none"
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
