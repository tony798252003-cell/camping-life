<script setup lang="ts">
import { computed } from 'vue'
import { taipeiYmd } from '../../utils/dateRange'
import { formatYmdSlash } from '../../utils/campsiteFilters'
import type { Campsite } from '../../types/database'

const props = defineProps<{ form: Partial<Campsite> }>()

const PLATFORM_LABEL: Record<string, string> = {
  icamping: '愛露營 iCamping',
  campingfun: '露營樂 Campingfun',
}

const hasSample = computed(() => props.form.saturday_sample != null && props.form.saturday_full_ratio != null)
const difficulty = computed(() => {
  const d = props.form.booking_difficulty
  return d === 'hard' ? '難訂' : d === 'moderate' ? '稍難' : '一般'
})
const checkedAt = computed(() =>
  props.form.bookable_checked_at ? formatYmdSlash(taipeiYmd(props.form.bookable_checked_at)) : ''
)
const platform = computed(() => {
  const p = props.form.booking_platform
  return p ? (PLATFORM_LABEL[p] ?? p) : ''
})
// form 會把空的 booking_difficulty 補成 normal，所以只有 hard／moderate 才算「有資料」
const hasData = computed(() =>
  !!(props.form.bookable_until || props.form.bookable_checked_at || props.form.booking_platform ||
    props.form.booking_platform_url || hasSample.value ||
    props.form.booking_difficulty === 'hard' || props.form.booking_difficulty === 'moderate')
)
</script>

<template>
  <div v-if="hasData" class="border border-orange-200 bg-orange-50/40 rounded-xl p-4 mb-4 space-y-2 text-sm text-gray-700">
    <p class="font-bold text-primary-900 text-sm">訂位資訊</p>
    <div>
      <span class="text-gray-400">難度　</span>
      <span :class="form.booking_difficulty === 'hard' ? 'text-[#c2410c] font-bold' : ''">{{ difficulty }}</span>
      <span v-if="hasSample" class="text-xs text-gray-500">（未來 3 個月週六 {{ Math.round(form.saturday_full_ratio! * 100) }}% 已客滿）</span>
    </div>
    <div v-if="form.bookable_until">
      <span class="text-gray-400">目前可訂到　</span>{{ formatYmdSlash(form.bookable_until) }}
    </div>
    <div v-if="checkedAt">
      <span class="text-gray-400">資料時間　</span>{{ checkedAt }} 查詢
      <span class="text-xs text-gray-400">（以訂位平台為準）</span>
    </div>
    <div v-if="platform">
      <span class="text-gray-400">在哪訂　</span>{{ platform }}
    </div>
    <a
      v-if="form.booking_platform_url"
      :href="form.booking_platform_url"
      target="_blank"
      rel="noopener"
      class="block w-full text-center py-2.5 rounded-xl bg-primary-600 text-white font-bold text-sm hover:bg-primary-700"
    >看即時空位</a>
  </div>
</template>
