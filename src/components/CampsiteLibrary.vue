<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Search, MapPin, Plus, SlidersHorizontal, ChevronRight } from 'lucide-vue-next'
import { campsiteQueries } from '../services/db/campsites'
import { toCampsites } from '../utils/dbRows'
import {
  ALTITUDE_BANDS,
  FEATURE_CHIPS,
  altitudeBandKey,
  isHiddenByGoogle,
  matchesAltitude,
  matchesSegment,
  isVisitedTrip,
  sortCampsites,
  upcomingMonths,
  splitByBookableMonth,
  formatYmdSlash,
  GOOGLE_MIN_RATING,
  type CampsiteSort,
  type VisitedSegment,
} from '../utils/campsiteFilters'
import { TAIWAN_LOCATIONS } from '../constants/locations'
import { todayYmd } from '../utils/dateRange'
import { useUserProfile } from '../composables/useUserProfile'
import type { Campsite } from '../types/database'
import CampsiteEditModal from './CampsiteEditModal.vue'
import CampsiteFilterSheet, { type CampsiteFilters } from './CampsiteFilterSheet.vue'

const { isAdmin } = useUserProfile()

const route = useRoute()
const router = useRouter()
const campsites = ref<Campsite[]>([])
const visitedIds = ref<Set<number>>(new Set()) // completed or booked campsite_ids
const segment = ref<VisitedSegment>('unvisited')
const sortBy = ref<CampsiteSort>('rating')
const monthOptions = upcomingMonths(todayYmd())
const bookMonth = ref('') // 要去的月份 YYYY-MM；空字串＝不拘
const showNoBookData = ref(false)
const googleOnly = ref(true) // 「Google 4.0★+」快捷標籤，預設開
const activeFeatureKeys = ref<string[]>([])
const loading = ref(false)
// 新增營區流程的「查看」會帶 ?q= 過來
const searchQuery = ref(typeof route.query.q === 'string' ? route.query.q : '')
const editingCampsite = ref<Campsite | null>(null)
const isEditModalOpen = ref(false)
const isFilterOpen = ref(false)
const filters = ref<CampsiteFilters>({
  city: '',
  district: '',
  playgroundFeatures: [],
  waterFeatures: [],
  sceneryFeatures: [],
  spotTypes: [],
  altitudeMin: null,
  altitudeMax: null,
  capacityMin: null,
})

const activeFilterCount = computed(() => {
  const f = filters.value
  let count = 0
  if (f.city) count++
  if (f.district) count++
  if (f.playgroundFeatures.length) count++
  if (f.waterFeatures.length) count++
  if (f.sceneryFeatures.length) count++
  if (f.spotTypes.length) count++
  if (f.altitudeMin !== null || f.altitudeMax !== null) count++
  if (f.capacityMin !== null) count++
  return count
})

function applyFilters(newFilters: CampsiteFilters) {
  filters.value = newFilters
}

const SEGMENTS: { key: VisitedSegment; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'visited', label: '去過' },
  { key: 'unvisited', label: '沒去過' },
]

const segmentCounts = computed(() => {
  const visited = campsites.value.filter(c => visitedIds.value.has(c.id)).length
  return { all: campsites.value.length, visited, unvisited: campsites.value.length - visited }
})

const altitudeBand = computed(() => altitudeBandKey(filters.value.altitudeMin, filters.value.altitudeMax))

function setCity(city: string) {
  filters.value = { ...filters.value, city, district: '' }
}

function setAltitudeBand(key: string) {
  const band = ALTITUDE_BANDS.find(b => b.key === key)
  filters.value = { ...filters.value, altitudeMin: band?.min ?? null, altitudeMax: band?.max ?? null }
}

function toggleFeature(key: string) {
  activeFeatureKeys.value = activeFeatureKeys.value.includes(key)
    ? activeFeatureKeys.value.filter(k => k !== key)
    : [...activeFeatureKeys.value, key]
}

const handleEdit = (site: Campsite) => {
  editingCampsite.value = site
  isEditModalOpen.value = true
}

const handleEditSaved = () => {
  fetchCampsites() // Refresh list
}

const fetchCampsites = async () => {
  loading.value = true
  try {
    campsites.value = toCampsites(await campsiteQueries.listActive())

    // Fetch visited/booked ids
    const tripData = await campsiteQueries.listTripVisitRefs()

    if (tripData) {
      const visited = new Set<number>()
      const visitedNames = new Set<string>()
      const today = todayYmd()
      tripData.forEach(t => {
        const isVisited = isVisitedTrip(t, today)
        if (t.campsite_id) {
          if (isVisited) visited.add(t.campsite_id)
        } else if (t.campsite_name && isVisited) {
          visitedNames.add(t.campsite_name.trim())
        }
      })
      // Also add IDs for name-matched campsites
      for (const site of campsites.value) {
        if (visitedNames.has(site.name.trim())) {
          visited.add(site.id)
        }
      }
      visitedIds.value = visited
    }
  } catch (e) {
    console.error('Error fetching campsites:', e)
  } finally {
    loading.value = false
  }
}

const matchesBeforeGoogle = computed(() => {
  let result = campsites.value

  // 文字搜尋
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.city && c.city.toLowerCase().includes(q)) ||
      (c.district && c.district.toLowerCase().includes(q))
    )
  }

  const f = filters.value

  if (f.city) result = result.filter(c => c.city === f.city)

  if (f.district) result = result.filter(c => c.district === f.district)

  if (f.playgroundFeatures.length)
    result = result.filter(c => f.playgroundFeatures.some(tag => c.playground_features?.includes(tag)))

  if (f.waterFeatures.length)
    result = result.filter(c => f.waterFeatures.some(tag => c.water_features?.includes(tag)))

  if (f.sceneryFeatures.length)
    result = result.filter(c => f.sceneryFeatures.some(tag => c.scenery_features?.includes(tag)))

  if (f.spotTypes.length)
    result = result.filter(c => f.spotTypes.some(tag => c.spot_types?.includes(tag)))

  result = result.filter(c => matchesAltitude(c.altitude, f.altitudeMin, f.altitudeMax))

  if (f.capacityMin !== null)
    result = result.filter(c => (c.total_capacity ?? 0) >= f.capacityMin!)

  const chips = FEATURE_CHIPS.filter(c => activeFeatureKeys.value.includes(c.key))
  if (chips.length) result = result.filter(c => chips.every(chip => chip.test(c)))

  return result.filter(c => matchesSegment(segment.value, visitedIds.value.has(c.id)))
})

// Google 低分／歇業隱藏（去過的不隱藏）；hiddenCount 讓使用者知道有東西被藏起來
const hiddenByGoogleCount = computed(() =>
  googleOnly.value ? matchesBeforeGoogle.value.filter(c => isHiddenByGoogle(c, visitedIds.value.has(c.id))).length : 0
)

const googleVisible = computed(() =>
  googleOnly.value
    ? matchesBeforeGoogle.value.filter(c => !isHiddenByGoogle(c, visitedIds.value.has(c.id)))
    : matchesBeforeGoogle.value
)

// 選了月份：只留該月至少部分已開放的；沒有訂位資料的另外計數，點了才顯示
const monthSplit = computed(() => bookMonth.value ? splitByBookableMonth(googleVisible.value, bookMonth.value) : null)
const noBookDataCount = computed(() => monthSplit.value?.noData.length ?? 0)

const filteredCampsites = computed(() => {
  const split = monthSplit.value
  const list = !split ? googleVisible.value : showNoBookData.value ? [...split.matched, ...split.noData] : split.matched
  return sortCampsites(list, sortBy.value)
})

onMounted(() => {
  fetchCampsites()
})
</script>

<template>
  <div class="pb-24 font-sans text-center">
    <!-- Sticky Header -->
    <div class="sticky top-0 z-20 bg-gray-50 px-3 pt-3 pb-1 shadow-sm">
      <div class="flex items-center justify-between mb-2">
        <h2 class="text-xl font-black text-primary-900 flex items-center gap-2">
          <Search class="w-5 h-5 text-accent-sky" />
          找營地
        </h2>
        <button
          @click="router.push({ name: 'library-discover' })"
          class="px-3 py-1.5 rounded-full text-xs font-semibold border border-emerald-600 text-emerald-700 bg-white"
        >找新營區</button>
      </div>

      <!-- Search Bar + Filter Button -->
      <div class="mb-2 flex gap-2 items-center">
        <div class="relative flex-1">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜尋營地名稱、縣市..."
            class="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-accent-sky focus:border-transparent outline-none transition-all shadow-sm"
          />
          <Search class="w-5 h-5 text-gray-400 absolute left-3 top-3.5" />
        </div>
        <button
          @click="isFilterOpen = true"
          class="relative flex-shrink-0 flex items-center gap-1.5 px-4 py-3 bg-white border border-gray-200 rounded-xl shadow-sm font-semibold text-sm transition-all hover:border-primary-400"
          :class="activeFilterCount > 0 ? 'text-primary-600 border-primary-400' : 'text-gray-600'"
        >
          <SlidersHorizontal class="w-4 h-4" />
          篩選
          <span
            v-if="activeFilterCount > 0"
            class="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-primary-600 text-white text-[10px] font-bold flex items-center justify-center"
          >{{ activeFilterCount }}</span>
        </button>
      </div>

      <!-- 去過 / 沒去過 -->
      <div class="mb-2 flex bg-sky-100 rounded-2xl p-[3px] text-sm font-bold" role="group" aria-label="營區範圍">
        <button
          v-for="seg in SEGMENTS"
          :key="seg.key"
          @click="segment = seg.key"
          :aria-pressed="segment === seg.key"
          class="flex-1 py-2 rounded-xl transition-all"
          :class="segment === seg.key ? 'bg-white text-primary-900 shadow-sm' : 'text-sky-700'"
        >{{ seg.label }} {{ segmentCounts[seg.key] }}</button>
      </div>

      <!-- 縣市 / 海拔 / 排序 -->
      <div class="mb-2 grid grid-cols-2 gap-2 text-left">
        <label class="bg-white border border-gray-200 rounded-2xl min-h-[44px] px-3 flex items-center justify-between gap-2 text-[13px] font-bold">
          <span class="flex-shrink-0">縣市</span>
          <select
            :value="filters.city"
            @change="setCity(($event.target as HTMLSelectElement).value)"
            class="min-w-0 bg-transparent text-sky-600 font-bold text-right outline-none"
            aria-label="縣市"
          >
            <option value="">不拘</option>
            <option v-for="city in TAIWAN_LOCATIONS" :key="city.id" :value="city.id">{{ city.name }}</option>
          </select>
        </label>
        <label class="bg-white border border-gray-200 rounded-2xl min-h-[44px] px-3 flex items-center justify-between gap-2 text-[13px] font-bold">
          <span class="flex-shrink-0">海拔</span>
          <select
            :value="altitudeBand"
            @change="setAltitudeBand(($event.target as HTMLSelectElement).value)"
            class="min-w-0 bg-transparent text-sky-600 font-bold text-right outline-none"
            aria-label="海拔"
          >
            <option value="">不拘</option>
            <option v-for="b in ALTITUDE_BANDS" :key="b.key" :value="b.key">{{ b.label }}</option>
          </select>
        </label>
        <label class="col-span-2 bg-white border border-gray-200 rounded-2xl min-h-[44px] px-3 flex items-center justify-between gap-2 text-[13px] font-bold">
          <span class="flex-shrink-0">要去的月份</span>
          <select
            v-model="bookMonth"
            @change="showNoBookData = false"
            class="min-w-0 bg-transparent text-sky-600 font-bold text-right outline-none"
            aria-label="要去的月份"
          >
            <option value="">不拘</option>
            <option v-for="m in monthOptions" :key="m.key" :value="m.key">{{ m.label }}</option>
          </select>
        </label>
        <label class="col-span-2 bg-white border border-gray-200 rounded-2xl min-h-[44px] px-3 flex items-center justify-between gap-2 text-[13px] font-bold">
          <span class="flex-shrink-0">排序</span>
          <select
            v-model="sortBy"
            class="min-w-0 bg-transparent text-sky-600 font-bold text-right outline-none"
            aria-label="排序"
          >
            <option value="rating">Google 評分高→低</option>
            <option value="name">名稱</option>
          </select>
        </label>
      </div>

      <!-- Quick Filter Chips -->
      <div class="mb-1 flex gap-2 overflow-x-auto pb-2 scrollbar-hide items-center">
        <button
          @click="googleOnly = !googleOnly"
          :aria-pressed="googleOnly"
          class="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
          :class="googleOnly ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-200'"
        >Google {{ GOOGLE_MIN_RATING.toFixed(1) }}★+</button>
        <button
          v-for="chip in FEATURE_CHIPS"
          :key="chip.key"
          @click="toggleFeature(chip.key)"
          :aria-pressed="activeFeatureKeys.includes(chip.key)"
          class="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
          :class="activeFeatureKeys.includes(chip.key) ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-200'"
        >{{ chip.label }}</button>
      </div>
      <button
        v-if="hiddenByGoogleCount > 0"
        @click="googleOnly = false"
        class="mb-1 text-xs text-gray-500 underline underline-offset-2"
      >已隱藏 {{ hiddenByGoogleCount }} 間低於 4.0 星或評論太少的營區（點此顯示）</button>
      <button
        v-if="noBookDataCount > 0 && !showNoBookData"
        @click="showNoBookData = true"
        class="mb-1 block mx-auto text-xs text-gray-500 underline underline-offset-2"
      >另有 {{ noBookDataCount }} 間沒有訂位資料（點此顯示）</button>
    </div><!-- end sticky -->

    <!-- List -->
    <div v-if="loading" class="px-3 py-12">
       <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto"></div>
    </div>

    <div v-else-if="filteredCampsites.length === 0" class="px-3 py-12 text-gray-400">
       <MapPin class="w-12 h-12 mx-auto mb-2 opacity-50" />
       <p>沒有找到相關營地</p>
    </div>

    <div v-else class="flex flex-col gap-2 px-3">
       <div
         v-for="site in filteredCampsites"
         :key="site.id"
         @click="handleEdit(site)"
         class="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all cursor-pointer group"
       >
          <!-- 左：名稱 + 地點 -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1.5">
              <span class="font-semibold text-sm text-primary-900 group-hover:text-accent-sky transition-colors truncate">{{ site.name }}</span>
              <span v-if="site.booking_difficulty === 'hard'" class="flex-shrink-0 text-[10px] bg-[#ffedd5] text-[#c2410c] px-1.5 py-0.5 rounded-full font-bold">難訂</span>
              <span v-else-if="site.booking_difficulty === 'moderate'" class="flex-shrink-0 text-[10px] bg-orange-50 text-orange-400 px-1.5 py-0.5 rounded-full">稍難</span>
              <span v-if="site.google_business_status === 'CLOSED_TEMPORARILY'" class="flex-shrink-0 text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-bold">暫停營業</span>
            </div>
            <div class="flex items-center gap-2 mt-0.5">
              <span class="text-xs text-gray-400 truncate">{{ site.city }}{{ site.district }}</span>
              <span v-if="site.scenery_features?.length" class="text-[10px] text-green-600">{{ site.scenery_features[0] }}</span>
              <span v-if="site.water_features?.length" class="text-[10px]">💧</span>
              <span v-if="site.playground_features?.length" class="text-[10px]">🎠</span>
              <span v-if="site.bookable_until" class="text-[10px] text-gray-400 whitespace-nowrap">可訂到 {{ formatYmdSlash(site.bookable_until) }}</span>
            </div>
          </div>

          <!-- 右：海拔 + 帳數 + pending admin actions -->
          <div class="flex-shrink-0 flex items-center gap-2">
            <span v-if="site.google_rating != null" class="text-xs font-extrabold text-amber-700 whitespace-nowrap">★ {{ site.google_rating.toFixed(1) }} <span class="text-gray-400 font-semibold">({{ site.google_rating_count ?? 0 }})</span></span>
            <span v-if="site.altitude" class="text-[10px] text-purple-500 font-medium">{{ site.altitude }}m</span>
            <span
              v-if="site.total_capacity"
              class="text-[10px] text-indigo-500 font-medium"
            >{{ site.total_capacity }}帳</span>
            <span
              v-else-if="isAdmin()"
              class="text-[10px] text-gray-300 font-medium"
            >?帳</span>
            <ChevronRight class="w-4 h-4 text-gray-300 group-hover:text-gray-400 transition-colors" />
          </div>
       </div>
    </div>

    <!-- Add Buttons (Floating) -->
    <div class="fixed bottom-24 right-6 flex flex-col gap-3 z-30">
      <button
        @click="router.push({ name: 'library-new' })"
        class="bg-primary-600 text-white rounded-full shadow-lg hover:bg-primary-700 active:scale-90 transition-all z-40 flex items-center justify-center border-4 border-surface-50 w-14 h-14"
        title="新增營區"
        aria-label="新增營區"
      >
        <Plus class="w-8 h-8" />
      </button>
    </div>

    <CampsiteEditModal
      v-if="isEditModalOpen && editingCampsite"
      :is-open="isEditModalOpen"
      :campsite="editingCampsite"
      :is-editable="isAdmin()"
      @close="isEditModalOpen = false"
      @saved="handleEditSaved"
    />

    <CampsiteFilterSheet
      v-if="isFilterOpen"
      :model-value="filters"
      @apply="applyFilters"
      @close="isFilterOpen = false"
    />

  </div>
</template>
