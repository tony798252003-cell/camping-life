<script lang="ts">
// 模組層級狀態：離開去產生草稿、回來時條件和結果都還在（規格 §5.8）
import { ref } from 'vue'
import type { PlaceLite } from '../../types/campsiteDraft'

// 對應 api/_lib/discover.ts 的 DiscoverResult（不直接 import，避免前端型別圖拉進伺服器程式）
type DiscoverResult = PlaceLite & { altitude: number | null; nearbyName?: string }

const city = ref('')
const district = ref('')
const altitudeMin = ref<number | null>(null)
const keywords = ref<string[]>([])
const freeText = ref('')
const results = ref<DiscoverResult[]>([])
const excludedCount = ref(0)
const nextPageToken = ref<string | null>(null)
// 產生 nextPageToken 的那次搜尋條件；「再找更多」必須沿用，不能讀會被編輯的畫面條件
const lastCriteria = ref<ReturnType<typeof criteria> | null>(null)
const moreUsed = ref(false) // 「再找更多」最多一次
const searched = ref(false)
const draftedPlaceIds = ref<string[]>([])
const pendingPlaceId = ref<string | null>(null) // 已送去產生草稿、尚未確定有沒有存檔
</script>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Loader2, ArrowLeft, ExternalLink, Star, Check } from 'lucide-vue-next'
import { apiPost } from '../../services/api'
import { TAIWAN_LOCATIONS } from '../../constants/locations'
import { PLAYGROUND_OPTIONS, WATER_OPTIONS, SCENERY_OPTIONS, SPOT_TYPE_OPTIONS } from '../../constants/campsiteOptions'

// App.vue 的 router-view 會傳一堆 props，這頁不吃
defineOptions({ inheritAttrs: false })

const route = useRoute()
const router = useRouter()

const ALTITUDE_CHIPS: Array<{ label: string; value: number | null }> = [
  { label: '不限', value: null },
  { label: '500+', value: 500 },
  { label: '800+', value: 800 },
  { label: '1000+', value: 1000 },
  { label: '1500+', value: 1500 },
]
const FACILITY_CHIPS = [...new Set(['雨棚', '溪流', '森林', ...SPOT_TYPE_OPTIONS, ...WATER_OPTIONS, ...SCENERY_OPTIONS, ...PLAYGROUND_OPTIONS])]

const loading = ref(false)
const loadingMore = ref(false)
const errorMsg = ref('')

const districts = computed(() => TAIWAN_LOCATIONS.find((c) => c.id === city.value)?.districts ?? [])

function onCityChange() {
  district.value = ''
}

// 與 api/_lib/discover.ts 的 MAX_KEYWORDS 一致；超過會被 API 回 400
const MAX_KEYWORDS = 8

function toggleKeyword(k: string) {
  if (keywords.value.includes(k)) {
    keywords.value = keywords.value.filter((x) => x !== k)
  } else if (keywords.value.length < MAX_KEYWORDS) {
    keywords.value = [...keywords.value, k]
  }
}

interface DiscoverResponse {
  results: DiscoverResult[]
  excludedCount: number
  closedCount: number
  nextPageToken?: string
}

function criteria() {
  return {
    city: city.value,
    ...(district.value ? { district: district.value } : {}),
    ...(altitudeMin.value !== null ? { altitudeMin: altitudeMin.value } : {}),
    keywords: keywords.value,
    ...(freeText.value.trim() ? { freeText: freeText.value.trim() } : {}),
  }
}

async function search() {
  if (!city.value || loading.value) return
  loading.value = true
  errorMsg.value = ''
  try {
    const used = criteria()
    const r = await apiPost<DiscoverResponse>('/api/campsite-discover', used)
    lastCriteria.value = used
    results.value = r.results
    excludedCount.value = r.excludedCount
    nextPageToken.value = r.nextPageToken ?? null
    moreUsed.value = false
    searched.value = true
  } catch (e) {
    errorMsg.value = (e instanceof Error && e.message) || '搜尋失敗，請稍後再試'
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  if (!nextPageToken.value || !lastCriteria.value || moreUsed.value || loadingMore.value) return
  loadingMore.value = true
  errorMsg.value = ''
  try {
    const r = await apiPost<DiscoverResponse>('/api/campsite-discover', { ...lastCriteria.value, pageToken: nextPageToken.value })
    const seen = new Set(results.value.map((x) => x.placeId))
    results.value = [...results.value, ...r.results.filter((x) => !seen.has(x.placeId))]
    excludedCount.value += r.excludedCount
    nextPageToken.value = null
    moreUsed.value = true
  } catch (e) {
    errorMsg.value = (e instanceof Error && e.message) || '載入失敗，請稍後再試'
  } finally {
    loadingMore.value = false
  }
}

function generateDraft(placeId: string) {
  if (draftedPlaceIds.value.includes(placeId)) return
  pendingPlaceId.value = placeId
  router.push({ path: '/library/new', query: { placeId, returnTo: '/library/discover' } })
}

const isDrafted = (placeId: string) => draftedPlaceIds.value.includes(placeId)

const STATUS_NOTE: Record<string, string> = { CLOSED_TEMPORARILY: '暫停營業' }

onMounted(() => {
  // 存檔後 AddCampsiteView 會帶 ?campsiteId= 回來；沒帶代表取消，不算已產生
  if (route.query.campsiteId && pendingPlaceId.value) {
    if (!draftedPlaceIds.value.includes(pendingPlaceId.value)) draftedPlaceIds.value.push(pendingPlaceId.value)
    router.replace({ path: route.path })
  }
  pendingPlaceId.value = null
})
</script>

<template>
  <div class="min-h-full bg-surface-50 pb-24 font-sans">
    <div class="sticky top-0 z-20 flex items-center gap-2 bg-gray-50 px-3 py-3 shadow-sm">
      <button class="p-1 text-gray-600" aria-label="返回" @click="router.push({ name: 'library' })">
        <ArrowLeft class="h-5 w-5" />
      </button>
      <h2 class="text-lg font-black text-primary-900">找新營區</h2>
    </div>

    <div class="space-y-4 p-3">
      <section class="space-y-3 rounded-xl border border-gray-200 bg-white p-3">
        <div class="flex gap-2">
          <select v-model="city" class="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm" @change="onCityChange">
            <option value="">選擇縣市（必選）</option>
            <option v-for="c in TAIWAN_LOCATIONS" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
          <select v-model="district" :disabled="!city" class="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm disabled:opacity-50">
            <option value="">鄉鎮（不限）</option>
            <option v-for="d in districts" :key="d.id" :value="d.id">{{ d.name }}</option>
          </select>
        </div>

        <div>
          <div class="mb-1 text-xs font-semibold text-gray-500">海拔</div>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="a in ALTITUDE_CHIPS"
              :key="a.label"
              class="rounded-full border px-3 py-1.5 text-xs font-semibold"
              :class="altitudeMin === a.value ? 'border-primary-600 bg-primary-600 text-white' : 'border-gray-200 bg-white text-gray-600'"
              @click="altitudeMin = a.value"
            >{{ a.label }}</button>
          </div>
        </div>

        <div>
          <div class="mb-1 text-xs font-semibold text-gray-500">設施關鍵字（只影響搜尋結果，不保證有；最多選 {{ MAX_KEYWORDS }} 個）</div>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="k in FACILITY_CHIPS"
              :key="k"
              class="rounded-full border px-3 py-1.5 text-xs font-semibold"
              :class="keywords.includes(k) ? 'border-primary-600 bg-primary-600 text-white' : 'border-gray-200 bg-white text-gray-600'"
              @click="toggleKeyword(k)"
            >{{ k }}</button>
          </div>
        </div>

        <input
          v-model="freeText"
          type="text"
          maxlength="40"
          placeholder="自由描述（選填），例如：親子、安靜"
          class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
        />

        <div>
          <button
            :disabled="!city || loading"
            class="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white disabled:opacity-50"
            @click="search"
          >
            <Loader2 v-if="loading" class="h-4 w-4 animate-spin" />
            搜尋
          </button>
          <p class="mt-1 text-center text-xs text-gray-400">每次搜尋會呼叫 Google，約 2–5 秒</p>
        </div>
      </section>

      <p v-if="errorMsg" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{{ errorMsg }}</p>

      <section v-if="searched" class="space-y-3">
        <div>
          <div class="text-sm font-bold text-gray-800">找到 {{ results.length }} 個尚未收錄（已排除 {{ excludedCount }} 個收錄過的）</div>
          <div class="text-xs text-gray-500">設施條件不保證有，請產生草稿後確認</div>
        </div>

        <div v-if="results.length === 0" class="py-8 text-center text-sm text-gray-400">沒有新的營區，換個條件試試</div>

        <div v-for="r in results" :key="r.placeId" class="space-y-2 rounded-xl border border-gray-200 bg-white p-3">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <div class="font-bold text-gray-900">{{ r.name }}</div>
              <div class="text-xs text-gray-500">{{ r.address }}</div>
            </div>
            <a v-if="r.mapsUrl" :href="r.mapsUrl" target="_blank" rel="noopener" class="flex shrink-0 items-center gap-1 text-xs text-sky-600">
              地圖<ExternalLink class="h-3 w-3" />
            </a>
          </div>
          <div class="flex flex-wrap items-center gap-2 text-xs">
            <span v-if="r.typeLabel" class="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">{{ r.typeLabel }}</span>
            <span v-if="r.businessStatus && STATUS_NOTE[r.businessStatus]" class="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">{{ STATUS_NOTE[r.businessStatus] }}</span>
            <span v-if="r.altitude !== null" class="text-gray-600">海拔 {{ Math.round(r.altitude) }} m</span>
            <span v-if="r.rating" class="flex items-center gap-0.5 text-gray-600">
              <Star class="h-3 w-3 text-amber-400" />{{ r.rating }}<template v-if="r.ratingCount">（{{ r.ratingCount }}）</template>
            </span>
          </div>
          <div class="text-xs text-gray-400">設施：未知（產生草稿時才查）</div>
          <div v-if="r.nearbyName" class="text-xs text-amber-700">附近已有營區：{{ r.nearbyName }}</div>
          <button
            :disabled="isDrafted(r.placeId)"
            class="flex w-full items-center justify-center gap-1 rounded-lg py-2 text-sm font-semibold"
            :class="isDrafted(r.placeId) ? 'bg-gray-100 text-gray-500' : 'bg-primary-600 text-white'"
            @click="generateDraft(r.placeId)"
          >
            <template v-if="isDrafted(r.placeId)"><Check class="h-4 w-4" />已產生草稿</template>
            <template v-else>＋ 產生草稿</template>
          </button>
        </div>

        <button
          v-if="nextPageToken && !moreUsed"
          :disabled="loadingMore"
          class="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white py-3 text-sm font-semibold text-gray-700 disabled:opacity-50"
          @click="loadMore"
        >
          <Loader2 v-if="loadingMore" class="h-4 w-4 animate-spin" />
          再找更多
        </button>
      </section>
    </div>
  </div>
</template>
