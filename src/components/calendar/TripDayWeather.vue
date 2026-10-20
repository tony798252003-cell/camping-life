<script setup lang="ts">
import { computed, toRef } from 'vue'
import type { CampingTripWithCampsite } from '../../types/database'
import { useTripWeather } from '../../composables/useTripWeather'
import { getSmartWeatherIcon } from '../../utils/weatherHelpers'

// 日檢視全天區的行程天氣：沿用 useTripWeather 的資料，抓不到（超過 16 天、無座標、已結束）就整個不顯示
const props = defineProps<{ trip: CampingTripWithCampsite; date: string }>()
const { weatherDays } = useTripWeather(toRef(props, 'trip'))
const day = computed(() => weatherDays.value.find((d) => d.date === props.date))
const icon = computed(() => (day.value ? getSmartWeatherIcon(day.value.summary.code, day.value.summary.max_pop) : null))
</script>

<template>
  <span v-if="day && icon" class="inline-flex items-center gap-1 text-xs text-primary-600 shrink-0">
    <component :is="icon" class="w-4 h-4" />{{ day.summary.temp_min }}–{{ day.summary.temp_max }}°
  </span>
</template>
