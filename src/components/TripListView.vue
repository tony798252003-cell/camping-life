<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useTrips } from '../composables/useTrips'
import { useTripModal } from '../composables/useTripModal'
import MapView from './MapView.vue'
import { Map, List, Search } from 'lucide-vue-next'
import { todayYmd } from '../utils/dateRange'
import {
  tripYears, summarizeYear, searchTrips, groupTimeline, upcomingBadge,
} from '../utils/tripTimeline'

const { trips, loading } = useTrips()
const { openEdit } = useTripModal()

const viewMode = ref<'list' | 'map'>('list')
const query = ref('')

const today = computed(() => todayYmd())
const currentYear = computed(() => Number(today.value.slice(0, 4)))

const years = computed(() => tripYears(trips.value))
const selectedYear = ref(currentYear.value)
// 資料載入後若沒有今年的行程，退到最近有資料的年份
watch(years, (ys) => {
  if (ys.length && !ys.includes(selectedYear.value)) selectedYear.value = ys[0]!
}, { immediate: true })

const summary = computed(() => summarizeYear(trips.value, selectedYear.value))
const maxMonthly = computed(() => Math.max(1, ...summary.value.monthly))
const barHeight = (n: number) => (n ? 10 + Math.round((n / maxMonthly.value) * 24) : 6)

const groups = computed(() => groupTimeline(searchTrips(trips.value, query.value), today.value))

const tripLocation = (t: (typeof trips.value)[number]) =>
  t.campsites?.city ? t.campsites.city + (t.campsites.district || '') : (t.location || '未設定')
const tripMeta = (t: (typeof trips.value)[number]) => {
  const alt = t.campsites?.altitude ?? t.altitude
  return [tripLocation(t), `${t.duration_days ?? 1} 天`, alt ? `海拔 ${alt}m` : ''].filter(Boolean).join(' · ')
}
const tripName = (t: (typeof trips.value)[number]) => t.campsites?.name || t.campsite_name
const dateParts = (t: (typeof trips.value)[number]) => ({
  m: `${Number(t.trip_date.slice(5, 7))}月`,
  d: Number(t.trip_date.slice(8, 10)),
})
</script>

<template>
  <div class="pb-24">
    <!-- 頂部標題與列表地圖切換 -->
    <div class="sticky top-0 bg-white/80 backdrop-blur-md z-20 px-4 py-4 border-b border-primary-100 flex items-center justify-between supports-[backdrop-filter]:bg-white/60">
      <h1 class="text-2xl font-black text-primary-900 tracking-tight">我的足跡</h1>

      <!-- View Toggle (List/Map) -->
      <div class="bg-surface-100 p-1 rounded-xl flex items-center border border-primary-100">
        <button
          @click="viewMode = 'list'"
          aria-label="列表檢視"
          class="w-11 h-11 flex items-center justify-center rounded-lg transition-all"
          :class="viewMode === 'list' ? 'bg-white text-primary-600 shadow-sm' : 'text-primary-400 hover:text-primary-600'"
        >
          <List class="w-5 h-5" />
        </button>
        <button
          @click="viewMode = 'map'"
          aria-label="地圖檢視"
          class="w-11 h-11 flex items-center justify-center rounded-lg transition-all"
          :class="viewMode === 'map' ? 'bg-white text-primary-600 shadow-sm' : 'text-primary-400 hover:text-primary-600'"
        >
          <Map class="w-5 h-5" />
        </button>
      </div>
    </div>

    <div v-if="viewMode === 'map'" class="h-[70vh] w-full relative">
       <MapView :trips="trips" />
    </div>

    <div v-else class="min-h-[50vh]">
      <!-- Loading state -->
      <div v-if="loading" class="flex justify-center py-16">
        <div class="flex flex-col items-center gap-3 text-primary-400">
          <div class="animate-spin">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          </div>
          <span class="text-sm font-medium">載入中...</span>
        </div>
      </div>

      <!-- Empty state -->
      <div v-else-if="trips.length === 0" class="flex flex-col items-center justify-center py-16 text-primary-300/50">
        <div class="text-5xl mb-4 opacity-50 grayscale">🏔️</div>
        <p class="font-medium">還沒有露營紀錄</p>
      </div>

      <template v-else>
        <!-- 年度摘要 -->
        <section class="mx-4 mt-4 mb-3 bg-primary-600 text-white rounded-3xl px-[18px] py-4 flex flex-col gap-3">
          <div class="flex items-baseline justify-between">
            <span class="text-[13px] font-bold opacity-90">{{ selectedYear }} 年</span>
            <select
              v-model.number="selectedYear"
              aria-label="選擇年份"
              class="bg-white/20 text-white border-none rounded-[10px] min-h-8 py-0 pl-2.5 pr-7 text-xs font-extrabold focus:ring-0 cursor-pointer"
            >
              <option v-for="y in years" :key="y" :value="y" class="text-primary-900">{{ y }}</option>
            </select>
          </div>
          <div class="grid grid-cols-3">
            <div>
              <div class="text-[26px] font-black leading-tight">{{ summary.trips }}</div>
              <div class="text-xs font-semibold opacity-90">趟露營</div>
            </div>
            <div>
              <div class="text-[26px] font-black leading-tight">{{ summary.nights }}</div>
              <div class="text-xs font-semibold opacity-90">晚</div>
            </div>
            <div>
              <div class="text-[26px] font-black leading-tight">{{ summary.campsites }}</div>
              <div class="text-xs font-semibold opacity-90">個營區</div>
            </div>
          </div>
          <div class="grid grid-cols-12 items-end gap-1 h-[34px]">
            <span
              v-for="(n, i) in summary.monthly"
              :key="i"
              class="block rounded"
              :class="n ? 'bg-white/90' : 'bg-white/25'"
              :style="{ height: barHeight(n) + 'px' }"
            ></span>
          </div>
        </section>

        <!-- 搜尋 -->
        <label class="mx-4 mb-2 flex items-center gap-2 bg-white rounded-[14px] px-3 min-h-11">
          <Search class="w-[18px] h-[18px] text-slate-500 shrink-0" />
          <input
            v-model="query"
            type="search"
            placeholder="搜尋營區或地區"
            class="flex-1 bg-transparent border-none p-0 text-sm text-primary-900 placeholder:text-slate-500 focus:ring-0"
          />
        </label>

        <!-- 時間軸 -->
        <div class="px-4">
          <p v-if="groups.length === 0" class="text-center text-sm text-slate-500 py-12">找不到符合的行程</p>
          <template v-for="g in groups" :key="g.key">
            <div class="flex items-baseline gap-2 mt-2.5 mb-2 mx-1">
              <span class="text-xl font-black text-primary-900">{{ g.label }}</span>
              <span class="text-xs font-semibold text-slate-500">{{ g.meta }}</span>
            </div>
            <div
              v-for="t in g.trips"
              :key="t.id"
              class="grid grid-cols-[44px_18px_1fr] items-stretch min-h-[88px]"
            >
              <div class="flex flex-col items-center pt-2.5">
                <span class="text-[11px] font-bold text-slate-500">{{ dateParts(t).m }}</span>
                <span class="text-[22px] font-black leading-none text-primary-900">{{ dateParts(t).d }}</span>
              </div>
              <div class="flex flex-col items-center">
                <span class="w-0.5 h-3.5 bg-primary-200"></span>
                <span
                  class="w-3 h-3 rounded-full ring-[3px] ring-surface-50"
                  :class="g.upcoming ? 'bg-primary-600' : 'bg-slate-400'"
                ></span>
                <span class="w-0.5 flex-1 bg-primary-200"></span>
              </div>
              <div class="pt-1 pb-2.5 pl-1.5">
                <button
                  type="button"
                  @click="openEdit(t)"
                  class="w-full text-left bg-white/90 rounded-[20px] px-3.5 py-3 flex flex-col gap-1 active:scale-[0.99] transition-transform"
                  :class="g.upcoming ? 'shadow-[0_6px_16px_-12px_rgba(2,132,199,0.6)]' : ''"
                >
                  <span class="flex items-center justify-between gap-2">
                    <span class="text-[15px] font-extrabold text-primary-900 truncate">{{ tripName(t) }}</span>
                    <span
                      class="text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap"
                      :class="g.upcoming ? 'font-extrabold text-primary-700 bg-primary-100' : 'font-bold text-slate-600 bg-slate-100'"
                    >{{ g.upcoming ? upcomingBadge(t, today) : '已去過' }}</span>
                  </span>
                  <span class="text-xs font-semibold text-slate-500">{{ tripMeta(t) }}</span>
                </button>
              </div>
            </div>
          </template>
        </div>
      </template>
    </div>
  </div>
</template>
