<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ChevronLeft, ChevronRight, Moon, Navigation, Tent, Snowflake, Droplets, Plus, Umbrella } from 'lucide-vue-next'
import { useTrips } from '../../composables/useTrips'
import { useTripModal } from '../../composables/useTripModal'
import { useTripWeather, type WeatherDay } from '../../composables/useTripWeather'
import { estimateTripDuration } from '../../composables/useTravelTime'
import { useUserProfile } from '../../composables/useUserProfile'
import { browseableTrips, defaultTripIndex, pickNextTrip, tripStart } from '../../utils/nextTrip'
import { diffDays, tripRange, weekdayMon0 } from '../../utils/dateRange'
import { useToday } from '../../composables/useToday'
import { COLD_NIGHT_C, summarizeTripWeather } from '../../utils/tripWeatherSummary'
import { isHoliday } from '../../utils/holidays'

const WEEK = ['一', '二', '三', '四', '五', '六', '日']

const { trips } = useTrips()
const { openEdit, openNew } = useTripModal()
const { userOrigin } = useUserProfile()

const today = useToday()
// 翻看：以 id 記住使用者翻到的那趟（資料重新載入也不跳掉）；null = 回到預設的下一趟
const list = computed(() => browseableTrips(trips.value))
const defaultIndex = computed(() => defaultTripIndex(list.value, today.value))
const browsedId = ref<number | null>(null)
const index = computed(() => {
  const i = browsedId.value == null ? -1 : list.value.findIndex((t) => t.id === browsedId.value)
  return i >= 0 ? i : defaultIndex.value
})
const trip = computed(() => list.value[index.value] ?? null)
const hasPrev = computed(() => index.value > 0)
const hasNext = computed(() => index.value < list.value.length - 1)
const go = (delta: number) => {
  browsedId.value = list.value[index.value + delta]?.id ?? null
}
const hasUpcoming = computed(() => pickNextTrip(list.value, today.value) !== null)
const isDefault = computed(() => index.value === defaultIndex.value)

// 營區的 google_place_id 欄位尚未進入產生的型別（M4 加入），先用寬鬆型別讀取
const placeId = computed(() => (trip.value?.campsites as { google_place_id?: string | null } | null)?.google_place_id ?? null)
const coords = computed(() => {
  const t = trip.value
  if (!t) return null
  const lat = t.campsites?.latitude ?? t.latitude
  const lng = t.campsites?.longitude ?? t.longitude
  return lat && lng ? { lat, lng } : null
})
const name = computed(() => trip.value?.campsites?.name ?? trip.value?.campsite_name ?? '未命名營區')

const range = computed(() => (trip.value ? tripRange(trip.value.trip_date, trip.value.duration_days) : null))
const isPast = computed(() => !!range.value && range.value.end < today.value)

// 舊行程沒有營區也沒有座標時，只顯示名稱快照，不查天氣和車程
// 已結束的行程不查預報
const weatherTrip = computed(() => (coords.value && !isPast.value ? trip.value : null))
const { weatherDays, packingStatus, altitudeCorrected, siteAltitude, loading: weatherLoading } = useTripWeather(weatherTrip)

const days = computed(() => (range.value ? diffDays(range.value.start, range.value.end) + 1 : 1))
const md = (ymd: string) => `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8))}（${WEEK[weekdayMon0(ymd)]}）`
const dateText = computed(() => (range.value ? `${md(range.value.start)}–${md(range.value.end)}` : ''))
const nightsText = computed(() => `${trip.value?.night_rush ? '夜衝＋' : ''}${days.value}天${days.value - 1}夜`)

// 右側大數字：未出發 = 倒數天數；進行中 = 第幾天；今晚夜衝 = 「今晚」
const countdown = computed(() => {
  const t = trip.value
  if (!t || !range.value) return { big: '', unit: '', tag: '', large: false }
  if (isPast.value) return { big: String(diffDays(range.value.end, today.value)), unit: '天前', tag: '已結束', large: false }
  const start = tripStart(t)
  if (t.night_rush && t.trip_date > today.value && start <= today.value) return { big: '今晚', unit: '', tag: '夜衝出發', large: false }
  if (start > today.value) return { big: String(diffDays(today.value, start)), unit: '天', tag: '', large: true }
  return { big: `第 ${diffDays(range.value.start, today.value) + 1}`, unit: '天', tag: '進行中', large: false }
})

const title = computed(() => (isPast.value ? '過去的露營' : isDefault.value ? '下一趟露營' : '露營行程'))

const statusText = computed(() => {
  const s = trip.value?.status
  return s === 'planning' ? '規劃中' : s === 'booked' ? '已訂位' : s === 'completed' ? '已完成' : '—'
})

// 溫度已是海拔校正後的數字；夜間（20:00–06:00）最低溫低於 10°C 時標出
const nightLow = (d: WeatherDay) => {
  const temps = d.hours
    .filter((h) => h.isValid && (Number(h.time.slice(0, 2)) >= 20 || Number(h.time.slice(0, 2)) <= 6))
    .map((h) => h.temp)
  return temps.length ? Math.round(Math.min(...temps)) : null
}
const forecastClosed = computed(
  () => !!trip.value && !!coords.value && weatherDays.value.length === 0 && !weatherLoading.value && diffDays(today.value, trip.value.trip_date) > 16,
)
// 只在有風險時顯示收帳日濕帳提示
const packRisk = computed(() => (packingStatus.value && ['wet', 'risk', 'damp'].includes(packingStatus.value.status) ? packingStatus.value : null))

// 車程（秒）
const travelSec = ref<number | null>(null)
watch(
  [trip, () => userOrigin()],
  async () => {
    travelSec.value = null
    const t = trip.value
    const c = coords.value
    if (!t || !c || isPast.value) return
    const o = userOrigin()
    const sLat = t.start_latitude ?? o?.latitude
    const sLng = t.start_longitude ?? o?.longitude
    const sec = await estimateTripDuration(c.lat, c.lng, sLat ?? undefined, sLng ?? undefined)
    if (trip.value === t) travelSec.value = sec
  },
  { immediate: true },
)
const travelText = computed(() => {
  if (travelSec.value == null) return null
  const h = Math.floor(travelSec.value / 3600)
  const m = Math.round((travelSec.value % 3600) / 60)
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}m` : `${m}m`
})
// 天氣格：整趟行程的最低–最高溫（預報已依海拔校正）
const weatherSummary = computed(() =>
  summarizeTripWeather(
    weatherDays.value.map((d) => ({ tempMin: d.summary.temp_min, tempMax: d.summary.temp_max, maxPop: d.summary.max_pop, nightLow: nightLow(d) })),
  ),
)
const weatherText = computed(() => {
  if (!coords.value || isPast.value) return '—'
  const w = weatherSummary.value
  if (w) return `${w.min}–${w.max}°C`
  if (weatherLoading.value) return '載入中'
  return forecastClosed.value ? '未開放' : '—'
})
const holidayJam = computed(() => !!trip.value && !!isHoliday(tripStart(trip.value)))

// 建議出發時間 = 進場時間（夜衝為夜衝時間）減車程
const departText = computed(() => {
  const t = trip.value
  if (!t || travelSec.value == null || !t.campsites) return null
  const arrive = t.night_rush ? t.campsites.night_rush_time : t.campsites.check_in_time
  if (!arrive) return null
  const [h, m] = arrive.split(':').map(Number)
  const total = (((h ?? 0) * 60 + (m ?? 0) - Math.round(travelSec.value / 60)) % 1440 + 1440) % 1440
  const hh = String(Math.floor(total / 60)).padStart(2, '0')
  const mm = String(total % 60).padStart(2, '0')
  return `${t.night_rush ? '夜衝' : '進場'} ${arrive} → 建議 ${hh}:${mm} 出發`
})

const navUrl = computed(() => {
  const t = trip.value
  if (!t) return null
  if (placeId.value) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(name.value)}&destination_place_id=${placeId.value}`
  }
  const c = coords.value
  return c ? `https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}` : null
})
</script>

<template>
  <div v-if="trip" class="flex flex-col gap-2">
  <div class="flex items-center justify-between gap-2 px-1">
    <h2 class="text-xs font-bold uppercase tracking-widest text-slate-500">{{ title }}</h2>
    <div class="flex items-center -my-2.5">
      <button
        v-if="!isDefault"
        type="button"
        class="min-h-[44px] px-3 rounded-[12px] text-[13px] font-extrabold text-primary-700"
        @click="browsedId = null"
      >{{ hasUpcoming ? '回到下一趟' : '回到最近一趟' }}</button>
      <button
        type="button"
        aria-label="上一趟"
        :disabled="!hasPrev"
        class="w-11 h-11 flex items-center justify-center rounded-full text-primary-700 disabled:text-slate-300"
        @click="go(-1)"
      ><ChevronLeft class="w-5 h-5" /></button>
      <button
        type="button"
        aria-label="下一趟"
        :disabled="!hasNext"
        class="w-11 h-11 flex items-center justify-center rounded-full text-primary-700 disabled:text-slate-300"
        @click="go(1)"
      ><ChevronRight class="w-5 h-5" /></button>
    </div>
  </div>
  <div
    role="button"
    tabindex="0"
    data-testid="next-trip"
    class="rounded-[30px] p-4 text-left cursor-pointer shadow-[0_8px_24px_-12px_rgba(14,165,233,0.35)] flex flex-col gap-2.5"
    :class="[trip.status === 'planning' ? 'border border-dashed border-primary-300' : 'border border-white/70', isPast ? 'bg-white/60' : 'bg-white/85']"
    @click="openEdit(trip)"
    @keydown.enter="openEdit(trip)"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="flex items-start gap-3 min-w-0">
        <!-- 裝備格：帳篷圖（沒有就放帳篷圖示），下方帳篷名稱 -->
        <div class="w-16 shrink-0 flex flex-col items-center gap-1" data-testid="tent-slot">
          <div class="w-16 h-16 rounded-[16px] bg-primary-50 border border-primary-100 overflow-hidden flex items-center justify-center">
            <img v-if="trip.tent?.image_url" :src="trip.tent.image_url" :alt="trip.tent.name" class="w-full h-full object-contain p-1" />
            <Tent v-else class="w-8 h-8 text-primary-300" aria-label="尚未選帳篷" />
          </div>
          <span v-if="trip.tent?.name" class="w-full text-[10px] font-bold text-slate-500 text-center truncate">{{ trip.tent.name }}</span>
        </div>
        <div class="min-w-0 flex flex-col gap-0.5">
          <span v-if="countdown.tag" class="text-[11px] font-bold text-primary-700">{{ countdown.tag }}</span>
          <h2 class="text-xl font-black text-primary-900 truncate">{{ name }}</h2>
          <p class="text-[13px] font-semibold text-slate-600">
            {{ dateText }}
            <span class="inline-flex items-center gap-0.5 text-slate-500"><Moon v-if="trip.night_rush" class="w-3 h-3" />{{ nightsText }}</span>
          </p>
        </div>
      </div>
      <div class="flex items-baseline gap-1 shrink-0">
        <span class="font-black leading-none" :class="[isPast ? 'text-slate-600' : 'text-accent-sky', countdown.large ? 'text-[52px]' : 'text-[30px]']">{{ countdown.big }}</span>
        <span class="text-[13px] font-bold" :class="isPast ? 'text-slate-600' : 'text-primary-600'">{{ countdown.unit }}</span>
      </div>
    </div>

    <div class="grid grid-cols-3 gap-2">
      <div class="bg-primary-50 rounded-[14px] p-2 text-center">
        <div class="text-[11px] font-semibold text-slate-500">天氣</div>
        <div class="text-[13px] font-extrabold text-primary-900">{{ weatherText }}</div>
        <div v-if="weatherSummary && (weatherSummary.cold || weatherSummary.rainy)" class="flex items-center justify-center gap-1 text-[11px] font-bold text-orange-600">
          <Snowflake v-if="weatherSummary.cold" class="w-3 h-3" aria-label="夜間低溫" /><Umbrella v-if="weatherSummary.rainy" class="w-3 h-3" aria-label="可能降雨" />
        </div>
      </div>
      <div class="bg-primary-50 rounded-[14px] p-2 text-center">
        <div class="text-[11px] font-semibold text-slate-500">車程</div>
        <div class="text-[13px] font-extrabold text-primary-900">{{ travelText ?? '—' }}</div>
      </div>
      <div class="bg-primary-50 rounded-[14px] p-2 text-center">
        <div class="text-[11px] font-semibold text-slate-500">狀態</div>
        <div class="text-[13px] font-extrabold" :class="trip.status === 'booked' ? 'text-green-800' : 'text-primary-900'">{{ statusText }}</div>
      </div>
    </div>

    <div v-if="coords && !isPast" class="flex items-end justify-between gap-2">
      <div class="space-y-0.5 text-[11px] text-slate-500 min-w-0">
        <p v-if="departText">{{ departText }}</p>
        <p v-if="holidayJam" class="text-accent-orange">連假，可能塞車</p>
        <p v-if="weatherSummary?.cold" class="flex items-center gap-1 text-primary-600"><Snowflake class="w-3 h-3" />有夜間低於 {{ COLD_NIGHT_C }}°C</p>
        <p v-if="weatherSummary?.rainy" class="flex items-center gap-1 text-primary-600"><Umbrella class="w-3 h-3" />可能降雨</p>
        <p v-if="packRisk" class="flex items-center gap-1 text-orange-600"><Droplets class="w-3 h-3" />收帳日：{{ packRisk.label }}</p>
        <p v-if="altitudeCorrected">已依海拔校正（營區 {{ siteAltitude?.toLocaleString() }} m）</p>
      </div>
      <a
        v-if="navUrl"
        :href="navUrl"
        target="_blank"
        rel="noopener"
        aria-label="導航"
        class="shrink-0 inline-flex items-center justify-center gap-1 min-h-[44px] px-4 rounded-[14px] bg-primary-900 text-white text-[13px] font-bold"
        @click.stop
      ><Navigation class="w-4 h-4" />導航</a>
    </div>
  </div>
  </div>

  <button
    v-else
    class="w-full min-h-[56px] rounded-[30px] border border-dashed border-primary-200 bg-white/60 text-[13px] font-semibold text-primary-600 flex items-center justify-center gap-1"
    @click="openNew()"
  >
    還沒有排下一趟 <Plus class="w-4 h-4" />新增露營
  </button>
</template>
