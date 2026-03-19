# Campsite Filter Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在「找營地」頁加入底部滑出 Filter Sheet，支援縣市、鄉鎮、設施（遊樂/水域/景觀/營位類型）、海拔範圍篩選。

**Architecture:** 新增 `CampsiteFilterSheet.vue` 元件，以 Teleport 掛到 body；filter 狀態以 `useFilters` composable 管理；`CampsiteLibrary.vue` 的 `filteredCampsites` computed 加入 filter 邏輯。

**Tech Stack:** Vue 3 Composition API, TypeScript, Tailwind CSS 4, `src/constants/locations.ts` (TAIWAN_LOCATIONS)

---

## 檔案結構

- **新增** `src/components/CampsiteFilterSheet.vue` — 底部抽屜 UI，接收 filters 狀態、emit apply/close
- **修改** `src/components/CampsiteLibrary.vue` — 加篩選按鈕、引入 FilterSheet、擴充 filteredCampsites computed

---

## Chunk 1: Filter Sheet 元件

### Task 1: 建立 CampsiteFilterSheet.vue

**Files:**
- Create: `src/components/CampsiteFilterSheet.vue`

這個元件接收目前 filter 值作為 props，讓使用者調整後 emit `apply` 事件（帶新的 filter 值），以及 `close` 事件。

**Filter 型別定義（在此元件內部，不需要獨立檔案）：**

```ts
export interface CampsiteFilters {
  city: string        // 縣市 ID，例如 '南投縣'，空字串 = 不篩選
  district: string    // 鄉鎮 ID，例如 '魚池鄉'，空字串 = 不篩選
  playgroundFeatures: string[]  // 多選，空陣列 = 不篩選
  waterFeatures: string[]
  sceneryFeatures: string[]
  spotTypes: string[]
  altitudeMin: number | null    // null = 不篩選
  altitudeMax: number | null
}
```

**Options 常數（與 CampsiteEditModal 一致）：**

```ts
const PLAYGROUND_OPTIONS = ['溜滑梯','沙坑','盪鞦韆','遊戲室','氣墊城堡','滑草','彈簧床','兒童攀岩','棒球九宮格']
const WATER_OPTIONS = ['戲水池','溪流','河流','瀑布','湖泊','溫泉','滑水道','海邊']
const SCENERY_OPTIONS = ['櫻花','落羽松','桐花','楓葉','螢火蟲','雲海','夜景','山景','海景','湖景','森林']
const SPOT_TYPE_OPTIONS = ['草地','碎石','草地混碎石','棧板','雨棚','免搭帳']
```

- [ ] **Step 1: 建立 CampsiteFilterSheet.vue**

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import { X, SlidersHorizontal } from 'lucide-vue-next'
import { TAIWAN_LOCATIONS } from '../constants/locations'

export interface CampsiteFilters {
  city: string
  district: string
  playgroundFeatures: string[]
  waterFeatures: string[]
  sceneryFeatures: string[]
  spotTypes: string[]
  altitudeMin: number | null
  altitudeMax: number | null
}

const props = defineProps<{
  modelValue: CampsiteFilters
}>()

const emit = defineEmits<{
  (e: 'apply', filters: CampsiteFilters): void
  (e: 'close'): void
}>()

const PLAYGROUND_OPTIONS = ['溜滑梯','沙坑','盪鞦韆','遊戲室','氣墊城堡','滑草','彈簧床','兒童攀岩','棒球九宮格']
const WATER_OPTIONS = ['戲水池','溪流','河流','瀑布','湖泊','溫泉','滑水道','海邊']
const SCENERY_OPTIONS = ['櫻花','落羽松','桐花','楓葉','螢火蟲','雲海','夜景','山景','海景','湖景','森林']
const SPOT_TYPE_OPTIONS = ['草地','碎石','草地混碎石','棧板','雨棚','免搭帳']

// Local copy for editing (don't mutate props directly)
const local = ref<CampsiteFilters>({ ...props.modelValue, playgroundFeatures: [...props.modelValue.playgroundFeatures], waterFeatures: [...props.modelValue.waterFeatures], sceneryFeatures: [...props.modelValue.sceneryFeatures], spotTypes: [...props.modelValue.spotTypes] })

const availableDistricts = computed(() => {
  if (!local.value.city) return []
  return TAIWAN_LOCATIONS.find(c => c.id === local.value.city)?.districts ?? []
})

// District IDs in TAIWAN_LOCATIONS have suffixes (e.g. '魚池鄉', '尖石鄉')
// but campsite.district in DB stores values WITHOUT suffix (e.g. '魚池', '尖石').
// So we strip the suffix when comparing.
function stripDistrictSuffix(d: string): string {
  return d.replace(/(鄉|鎮|市|區|里)$/, '')
}

function onCityChange() {
  local.value.district = ''
}

function onCitySelect(cityId: string) {
  local.value.city = local.value.city === cityId ? '' : cityId
  onCityChange()
}

function onDistrictSelect(districtId: string) {
  local.value.district = local.value.district === districtId ? '' : districtId
}

function toggleChip(arr: string[], val: string) {
  const idx = arr.indexOf(val)
  if (idx === -1) arr.push(val)
  else arr.splice(idx, 1)
}

function reset() {
  local.value = { city: '', district: '', playgroundFeatures: [], waterFeatures: [], sceneryFeatures: [], spotTypes: [], altitudeMin: null, altitudeMax: null }
}

function apply() {
  emit('apply', { ...local.value })
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <div class="fixed inset-0 bg-black/40 z-40" @click="emit('close')" />

    <!-- Sheet -->
    <div class="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl max-h-[85vh] flex flex-col">
      <!-- Handle -->
      <div class="flex justify-center pt-3 pb-1">
        <div class="w-10 h-1 bg-gray-300 rounded-full" />
      </div>

      <!-- Header -->
      <div class="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <div class="flex items-center gap-2 font-bold text-gray-800">
          <SlidersHorizontal class="w-4 h-4" />
          篩選條件
        </div>
        <button @click="emit('close')" class="text-gray-400 hover:text-gray-600">
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Scrollable content -->
      <div class="overflow-y-auto flex-1 px-5 py-4 space-y-5">

        <!-- 縣市 -->
        <div>
          <div class="text-sm font-semibold text-gray-600 mb-2">縣市</div>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="city in TAIWAN_LOCATIONS"
              :key="city.id"
              @click="onCitySelect(city.id)"
              class="px-3 py-1.5 rounded-full text-sm border transition-all"
              :class="local.city === city.id ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'"
            >{{ city.name }}</button>
          </div>
        </div>

        <!-- 鄉鎮 -->
        <div v-if="availableDistricts.length">
          <div class="text-sm font-semibold text-gray-600 mb-2">鄉鎮</div>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="d in availableDistricts"
              :key="d.id"
              @click="onDistrictSelect(d.id)"
              class="px-3 py-1.5 rounded-full text-sm border transition-all"
              :class="local.district === d.id ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'"
            >{{ d.name }}</button>
          </div>
        </div>

        <!-- 遊樂設施 -->
        <div>
          <div class="text-sm font-semibold text-gray-600 mb-2">遊樂設施</div>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="opt in PLAYGROUND_OPTIONS"
              :key="opt"
              @click="toggleChip(local.playgroundFeatures, opt)"
              class="px-3 py-1.5 rounded-full text-sm border transition-all"
              :class="local.playgroundFeatures.includes(opt) ? 'bg-yellow-400 text-white border-yellow-400' : 'bg-white text-gray-600 border-gray-200 hover:border-yellow-300'"
            >{{ opt }}</button>
          </div>
        </div>

        <!-- 水域設施 -->
        <div>
          <div class="text-sm font-semibold text-gray-600 mb-2">水域設施</div>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="opt in WATER_OPTIONS"
              :key="opt"
              @click="toggleChip(local.waterFeatures, opt)"
              class="px-3 py-1.5 rounded-full text-sm border transition-all"
              :class="local.waterFeatures.includes(opt) ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'"
            >{{ opt }}</button>
          </div>
        </div>

        <!-- 景觀 -->
        <div>
          <div class="text-sm font-semibold text-gray-600 mb-2">景觀</div>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="opt in SCENERY_OPTIONS"
              :key="opt"
              @click="toggleChip(local.sceneryFeatures, opt)"
              class="px-3 py-1.5 rounded-full text-sm border transition-all"
              :class="local.sceneryFeatures.includes(opt) ? 'bg-green-500 text-white border-green-500' : 'bg-white text-gray-600 border-gray-200 hover:border-green-300'"
            >{{ opt }}</button>
          </div>
        </div>

        <!-- 營位類型 -->
        <div>
          <div class="text-sm font-semibold text-gray-600 mb-2">營位類型</div>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="opt in SPOT_TYPE_OPTIONS"
              :key="opt"
              @click="toggleChip(local.spotTypes, opt)"
              class="px-3 py-1.5 rounded-full text-sm border transition-all"
              :class="local.spotTypes.includes(opt) ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300'"
            >{{ opt }}</button>
          </div>
        </div>

        <!-- 海拔 -->
        <div>
          <div class="text-sm font-semibold text-gray-600 mb-2">海拔（公尺）</div>
          <div class="flex items-center gap-3">
            <input
              v-model.number="local.altitudeMin"
              type="number"
              placeholder="最低"
              min="0"
              max="3000"
              class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
            <span class="text-gray-400">–</span>
            <input
              v-model.number="local.altitudeMax"
              type="number"
              placeholder="最高"
              min="0"
              max="3000"
              class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="px-5 py-4 border-t border-gray-100 flex gap-3">
        <button
          @click="reset"
          class="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors"
        >清除全部</button>
        <button
          @click="apply"
          class="flex-2 flex-grow-[2] py-3 rounded-xl bg-primary-600 text-white font-semibold text-sm hover:bg-primary-700 transition-colors"
        >套用篩選</button>
      </div>
    </div>
  </Teleport>
</template>
```

- [ ] **Step 2: 確認 TypeScript 編譯無誤**

```bash
npx vue-tsc --noEmit
```

Expected: 無錯誤（或只有現有既有錯誤，非新增的）

- [ ] **Step 3: Commit**

```bash
git add src/components/CampsiteFilterSheet.vue
git commit -m "feat(filter): add CampsiteFilterSheet bottom sheet component"
```

---

## Chunk 2: 整合進 CampsiteLibrary

### Task 2: 整合 FilterSheet 與 filteredCampsites

**Files:**
- Modify: `src/components/CampsiteLibrary.vue`

**修改重點：**
1. import `CampsiteFilterSheet` 和 `CampsiteFilters` 型別
2. 加入 `filters` ref（預設全空）和 `isFilterOpen` ref
3. 計算 `activeFilterCount`（有幾個 filter 條件在作用中）
4. 擴充 `filteredCampsites` computed 加入所有 filter 條件
5. 搜尋列右側加篩選按鈕（顯示數量 badge）
6. 在 template 底部加上 `<CampsiteFilterSheet>`

- [ ] **Step 1: 在 lucide import 加入 SlidersHorizontal**

找到現有的 lucide import 行：
```ts
import { Search, MapPin, Plus, CheckCircle, Upload, Phone, Tent, AlertTriangle, XCircle, Trash2 } from 'lucide-vue-next'
```
替換為：
```ts
import { Search, MapPin, Plus, CheckCircle, Upload, Phone, Tent, AlertTriangle, XCircle, Trash2, SlidersHorizontal } from 'lucide-vue-next'
```

- [ ] **Step 2: 在 `<script setup>` 加入 filter 狀態與邏輯**

在 `CampsiteLibrary.vue` 的 script 區段，在現有 import 後面加入：

```ts
import CampsiteFilterSheet, { type CampsiteFilters } from './CampsiteFilterSheet.vue'

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
  return count
})

function applyFilters(newFilters: CampsiteFilters) {
  filters.value = newFilters
}
```

- [ ] **Step 3: 擴充 `filteredCampsites` computed**

將現有的 `filteredCampsites` 替換為：

```ts
const filteredCampsites = computed(() => {
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
  // district in DB is stored WITHOUT suffix (e.g. '魚池'), but TAIWAN_LOCATIONS uses '魚池鄉'
  // Strip suffix from f.district before comparing
  if (f.district) {
    const districtShort = f.district.replace(/(鄉|鎮|市|區|里)$/, '')
    result = result.filter(c => c.district === districtShort)
  }

  if (f.playgroundFeatures.length)
    result = result.filter(c => f.playgroundFeatures.some(tag => c.playground_features?.includes(tag)))

  if (f.waterFeatures.length)
    result = result.filter(c => f.waterFeatures.some(tag => c.water_features?.includes(tag)))

  if (f.sceneryFeatures.length)
    result = result.filter(c => f.sceneryFeatures.some(tag => c.scenery_features?.includes(tag)))

  if (f.spotTypes.length)
    result = result.filter(c => f.spotTypes.some(tag => c.spot_types?.includes(tag)))

  if (f.altitudeMin !== null)
    result = result.filter(c => c.altitude !== null && c.altitude !== undefined && c.altitude >= f.altitudeMin!)

  if (f.altitudeMax !== null)
    result = result.filter(c => c.altitude !== null && c.altitude !== undefined && c.altitude <= f.altitudeMax!)

  return result
})
```

- [ ] **Step 4: 修改搜尋列 template，加篩選按鈕**

找到現有的搜尋列區塊：
```html
<!-- Search Bar -->
<div class="mb-6 relative">
   <input
     v-model="searchQuery"
     ...
   />
   <Search class="w-5 h-5 text-gray-400 absolute left-3 top-3.5" />
</div>
```

替換為（搜尋 + 篩選按鈕並排）：
```html
<!-- Search Bar + Filter Button -->
<div class="mb-6 flex gap-2 items-center">
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
```

- [ ] **Step 6: 在 template 底部加入 FilterSheet**

在 `</div>` 最後面（`CampsiteEditModal` 之後）加入：

```html
<CampsiteFilterSheet
  v-if="isFilterOpen"
  :model-value="filters"
  @apply="applyFilters"
  @close="isFilterOpen = false"
/>
```

- [ ] **Step 7: TypeScript 編譯確認**

```bash
npx vue-tsc --noEmit
```

Expected: 無新錯誤

- [ ] **Step 8: 啟動 dev server 手動測試**

```bash
npm run dev
```

測試清單：
1. 點擊「篩選」按鈕，底部 sheet 滑出
2. 點擊縣市（例如南投縣），chips 變色
3. 選了縣市後，鄉鎮 chips 出現
4. 選遊樂設施、水域等多選項目
5. 輸入海拔範圍（例如 500–2000）
6. 點「套用篩選」，sheet 關閉，結果更新
7. 篩選按鈕上出現數字 badge
8. 點「清除全部」，所有 chips 取消，再套用後結果還原

- [ ] **Step 9: Commit**

```bash
git add src/components/CampsiteLibrary.vue
git commit -m "feat(filter): integrate filter sheet into CampsiteLibrary with active filter count badge"
```
