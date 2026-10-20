<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Moon, Navigation, Snowflake, Droplets, Car, Plus } from 'lucide-vue-next'
import { useTrips } from '../../composables/useTrips'
import { useTripModal } from '../../composables/useTripModal'
import { useTripWeather, type WeatherDay } from '../../composables/useTripWeather'
import { estimateTripDuration } from '../../composables/useTravelTime'
import { useUserProfile } from '../../composables/useUserProfile'
import { pickNextTrip, tripStart } from '../../utils/nextTrip'
import { diffDays, todayYmd, tripRange, weekdayMon0 } from '../../utils/dateRange'
import { isHoliday } from '../../utils/holidays'
import { getSmartWeatherIcon } from '../../utils/weatherHelpers'

const WEEK = ['一', '二', '三', '四', '五', '六', '日']
const LOW_TEMP_C = 10

const { trips } = useTrips()
const { openEdit, openNew } = useTripModal()
const { userOrigin } = useUserProfile()

const today = computed(() => todayYmd())
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

const countdown = computed(() => {
  const t = trip.value
  if (!t || !range.value) return ''
  const start = tripStart(t)
  if (t.night_rush && t.trip_date > today.value && start <= today.value) return '今晚夜衝出發'
  if (start > today.value) return `還有 ${diffDays(today.value, start)} 天`
  return `進行中 第 ${diffDays(range.value.start, today.value) + 1} 天`
})

const statusPill = computed(() => {
  const s = trip.value?.status
  return s === 'planning' ? '規劃中' : s === 'booked' ? '已訂位' : null
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
  return h > 0 ? `約 ${h} 小時 ${m} 分` : `約 ${m} 分鐘`
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
  <div class="px-4 pt-3 pb-2">
    <div
      v-if="trip"
      role="button"
      tabindex="0"
      data-testid="pinned-trip"
      class="rounded-2xl bg-white p-3 shadow-sm text-left cursor-pointer min-h-[160px]"
      :class="trip.status === 'planning' ? 'border border-dashed border-primary-300 opacity-90' : 'border border-primary-100'"
      @click="openEdit(trip)"
      @keydown.enter="openEdit(trip)"
    >
      <div class="flex items-start gap-3">
        <img v-if="trip.tent?.image_url" :src="trip.tent.image_url" :alt="trip.tent.name" class="w-12 h-12 rounded-xl object-cover shrink-0" />
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <h2 class="text-base font-bold text-primary-900 truncate">{{ name }}</h2>
            <span v-if="statusPill" class="text-[10px] px-2 py-0.5 rounded-full bg-primary-50 text-primary-600 shrink-0">{{ statusPill }}</span>
          </div>
          <p v-if="trip.status === 'planning'" class="text-[10px] text-primary-400">還沒訂位</p>
          <p class="text-xs text-primary-600 mt-0.5">
            {{ dateText }}　<span class="inline-flex items-center gap-0.5"><Moon v-if="trip.night_rush" class="w-3 h-3" />{{ nightsText }}</span>
          </p>
        </div>
        <div class="text-right shrink-0">
          <p class="text-sm font-bold text-accent-orange">{{ countdown }}</p>
          <a
            v-if="navUrl"
            :href="navUrl"
            target="_blank"
            rel="noopener"
            aria-label="導航"
            class="mt-1 inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-primary-900 text-white"
            @click.stop
          ><Navigation class="w-3 h-3" />導航</a>
        </div>
      </div>

      <template v-if="coords">
        <div v-if="weatherDays.length" class="mt-2 flex gap-2 overflow-x-auto">
          <div v-for="d in weatherDays" :key="d.date" class="shrink-0 rounded-xl bg-primary-50 px-2 py-1 text-center min-w-[64px]">
            <p class="text-[10px] text-primary-400">{{ d.dateLabel }}</p>
            <component :is="getSmartWeatherIcon(d.summary.code, d.summary.max_pop)" class="w-4 h-4 mx-auto text-primary-600" />
            <p class="text-xs font-bold text-primary-900">{{ d.summary.temp_min }}°–{{ d.summary.temp_max }}°</p>
            <p class="text-[10px] text-primary-400">{{ d.summary.max_pop }}%</p>
            <p v-if="isCold(d)" class="text-[10px] text-sky-600 flex items-center justify-center gap-0.5"><Snowflake class="w-3 h-3" />夜 {{ nightLow(d) }}°</p>
          </div>
        </div>
        <p v-else-if="forecastClosed" class="mt-2 text-xs text-primary-400">預報尚未開放</p>
        <p v-else-if="weatherLoading" class="mt-2 text-xs text-primary-400">天氣載入中…</p>
        <p v-if="altitudeCorrected" class="mt-1 text-[10px] text-primary-400">已依海拔校正（營區 {{ siteAltitude?.toLocaleString() }} m）</p>

        <div class="mt-2 space-y-0.5 text-xs text-primary-600">
          <p v-if="travelText" class="flex items-center gap-1">
            <Car class="w-3 h-3" />車程 {{ travelText }}
            <span v-if="holidayJam" class="text-accent-orange">連假，可能塞車</span>
          </p>
          <p v-if="departText">{{ departText }}</p>
          <p v-if="packRisk" class="flex items-center gap-1 text-orange-600"><Droplets class="w-3 h-3" />收帳日：{{ packRisk.label }}</p>
        </div>
      </template>
    </div>

    <button
      v-else
      class="w-full rounded-2xl border border-dashed border-primary-200 py-4 text-sm text-primary-400 flex items-center justify-center gap-1"
      @click="openNew()"
    >
      還沒有排下一趟 → <Plus class="w-4 h-4" />新增露營
    </button>
  </div>
</template>
