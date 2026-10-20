<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Moon, Navigation, Snowflake, Droplets, Plus } from 'lucide-vue-next'
import { useTrips } from '../../composables/useTrips'
import { useTripModal } from '../../composables/useTripModal'
import { useTripWeather, type WeatherDay } from '../../composables/useTripWeather'
import { estimateTripDuration } from '../../composables/useTravelTime'
import { useUserProfile } from '../../composables/useUserProfile'
import { pickNextTrip, tripStart } from '../../utils/nextTrip'
import { diffDays, tripRange, weekdayMon0 } from '../../utils/dateRange'
import { useToday } from '../../composables/useToday'
import { isHoliday } from '../../utils/holidays'

const WEEK = ['一', '二', '三', '四', '五', '六', '日']
const LOW_TEMP_C = 10

const { trips } = useTrips()
const { openEdit, openNew } = useTripModal()
const { userOrigin } = useUserProfile()

const today = useToday()
const trip = computed(() => pickNextTrip(trips.value, today.value))

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

// 舊行程沒有營區也沒有座標時，只顯示名稱快照，不查天氣和車程
const weatherTrip = computed(() => (coords.value ? trip.value : null))
const { weatherDays, packingStatus, altitudeCorrected, siteAltitude, loading: weatherLoading } = useTripWeather(weatherTrip)

const range = computed(() => (trip.value ? tripRange(trip.value.trip_date, trip.value.duration_days) : null))
const days = computed(() => (range.value ? diffDays(range.value.start, range.value.end) + 1 : 1))
const md = (ymd: string) => `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8))}（${WEEK[weekdayMon0(ymd)]}）`
const dateText = computed(() => (range.value ? `${md(range.value.start)}–${md(range.value.end)}` : ''))
const nightsText = computed(() => `${trip.value?.night_rush ? '夜衝＋' : ''}${days.value}天${days.value - 1}夜`)

// 右側大數字：未出發 = 倒數天數；進行中 = 第幾天；今晚夜衝 = 「今晚」
const countdown = computed(() => {
  const t = trip.value
  if (!t || !range.value) return { big: '', unit: '', tag: '' }
  const start = tripStart(t)
  if (t.night_rush && t.trip_date > today.value && start <= today.value) return { big: '今晚', unit: '', tag: '夜衝出發' }
  if (start > today.value) return { big: String(diffDays(today.value, start)), unit: '天', tag: '' }
  return { big: `第 ${diffDays(range.value.start, today.value) + 1}`, unit: '天', tag: '進行中' }
})

const statusText = computed(() => {
  const s = trip.value?.status
  return s === 'planning' ? '規劃中' : s === 'booked' ? '已訂位' : '—'
})

// 溫度已是海拔校正後的數字；夜間（20:00–06:00）最低溫低於 10°C 時標出
const nightLow = (d: WeatherDay) => {
  const temps = d.hours
    .filter((h) => h.isValid && (Number(h.time.slice(0, 2)) >= 20 || Number(h.time.slice(0, 2)) <= 6))
    .map((h) => h.temp)
  return temps.length ? Math.round(Math.min(...temps)) : null
}
const isCold = (d: WeatherDay) => {
  const n = nightLow(d)
  return n != null && n < LOW_TEMP_C
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
    if (!t || !c) return
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
// 天氣格：取行程第一天（預報已依海拔校正）
const weatherText = computed(() => {
  if (!coords.value) return '—'
  const d = weatherDays.value[0]
  if (d) return `${d.summary.temp_min}–${d.summary.temp_max}°C`
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
  <div
    v-if="trip"
    role="button"
    tabindex="0"
    data-testid="next-trip"
    class="rounded-[30px] bg-white/85 p-4 text-left cursor-pointer shadow-[0_8px_24px_-12px_rgba(14,165,233,0.35)] flex flex-col gap-2.5"
    :class="trip.status === 'planning' ? 'border border-dashed border-primary-300' : 'border border-white/70'"
    @click="openEdit(trip)"
    @keydown.enter="openEdit(trip)"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="flex items-start gap-3 min-w-0">
        <img v-if="trip.tent?.image_url" :src="trip.tent.image_url" :alt="trip.tent.name" class="w-12 h-12 rounded-[14px] object-cover shrink-0" />
        <div class="min-w-0 flex flex-col gap-0.5">
          <span class="text-[11px] font-bold text-primary-700">下一趟露營<template v-if="countdown.tag">・{{ countdown.tag }}</template></span>
          <h2 class="text-xl font-black text-primary-900 truncate">{{ name }}</h2>
          <p class="text-[13px] font-semibold text-slate-600">
            {{ dateText }}
            <span class="inline-flex items-center gap-0.5 text-slate-400"><Moon v-if="trip.night_rush" class="w-3 h-3" />{{ nightsText }}</span>
          </p>
        </div>
      </div>
      <div class="flex items-baseline gap-1 shrink-0">
        <span class="font-black leading-none text-accent-sky" :class="countdown.unit === '天' && !countdown.tag ? 'text-[52px]' : 'text-[30px]'">{{ countdown.big }}</span>
        <span class="text-[13px] font-bold text-primary-600">{{ countdown.unit }}</span>
      </div>
    </div>

    <div class="grid grid-cols-3 gap-2">
      <div class="bg-primary-50 rounded-[14px] p-2 text-center">
        <div class="text-[11px] font-semibold text-slate-500">天氣</div>
        <div class="text-[13px] font-extrabold text-primary-900">{{ weatherText }}</div>
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

    <div v-if="coords" class="flex items-end justify-between gap-2">
      <div class="space-y-0.5 text-[11px] text-slate-500 min-w-0">
        <p v-if="departText">{{ departText }}</p>
        <p v-if="holidayJam" class="text-accent-orange">連假，可能塞車</p>
        <p v-if="weatherDays[0] && isCold(weatherDays[0])" class="flex items-center gap-1 text-primary-600"><Snowflake class="w-3 h-3" />夜間低溫 {{ nightLow(weatherDays[0]) }}°</p>
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

  <button
    v-else
    class="w-full min-h-[56px] rounded-[30px] border border-dashed border-primary-200 bg-white/60 text-[13px] font-semibold text-primary-600 flex items-center justify-center gap-1"
    @click="openNew()"
  >
    還沒有排下一趟 <Plus class="w-4 h-4" />新增露營
  </button>
</template>
