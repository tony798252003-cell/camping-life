# Campsite Fields Expansion Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 擴充 `campsites` 資料表，加入設施/景觀/訂位欄位，更新 UI，並執行一次性資料匯入。

**Architecture:** 先建立 DB migration 新增欄位，更新 TypeScript 型別，然後擴充 `CampsiteEditModal` 加入 Accordion 分組的新欄位，`CampsiteLibrary` 的卡片顯示新標籤，最後執行一次性匯入腳本。

**Tech Stack:** Vue 3 + TypeScript, Supabase (PostgreSQL), Tailwind CSS 4, Node.js (tsx + xlsx for import script)

**Spec:** `docs/superpowers/specs/2026-03-16-campsite-fields-expansion-design.md`

---

## Chunk 1: DB Migration + TypeScript Types

### Files:
- Create: `supabase/migrations/20260316_add_campsite_facility_fields.sql`
- Modify: `src/types/database.ts`

---

### Task 1: DB Migration

- [ ] **Step 1: 建立 migration 檔案**

```sql
-- supabase/migrations/20260316_add_campsite_facility_fields.sql

ALTER TABLE public.campsites
  ADD COLUMN IF NOT EXISTS playground_features text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS water_features text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS scenery_features text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS spot_types text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS booking_method text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS booking_available_until date,
  ADD COLUMN IF NOT EXISTS booking_timing text,
  ADD COLUMN IF NOT EXISTS booking_difficulty text DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS recommended_spots text,
  ADD COLUMN IF NOT EXISTS campsite_notes text,
  ADD COLUMN IF NOT EXISTS booking_platform text,
  ADD COLUMN IF NOT EXISTS booking_platform_url text,
  ADD COLUMN IF NOT EXISTS booking_last_available_date date,
  ADD COLUMN IF NOT EXISTS booking_scraped_at timestamptz;

COMMENT ON COLUMN public.campsites.playground_features IS '遊樂設施標籤，如沙坑、溜滑梯';
COMMENT ON COLUMN public.campsites.water_features IS '水域設施標籤，如戲水池、溪流';
COMMENT ON COLUMN public.campsites.scenery_features IS '自然景觀標籤，如櫻花、螢火蟲';
COMMENT ON COLUMN public.campsites.spot_types IS '營位類型，如草地、棧板';
COMMENT ON COLUMN public.campsites.booking_method IS '訂位方式，如電話、FB';
COMMENT ON COLUMN public.campsites.booking_difficulty IS '搶位難度：normal / moderate / hard';
COMMENT ON COLUMN public.campsites.booking_platform IS '訂位平台：icamping / campingfun';
COMMENT ON COLUMN public.campsites.booking_last_available_date IS '上次爬取時平台最遠可訂日期（供偵測新訂位開放用）';
```

- [ ] **Step 2: 在 Supabase Dashboard 執行 migration**

前往 Supabase Dashboard → SQL Editor，貼上上方 SQL 執行。
確認無錯誤後繼續。

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260316_add_campsite_facility_fields.sql
git commit -m "feat(db): add campsite facility and booking fields"
```

---

### Task 2: TypeScript 型別更新

- [ ] **Step 1: 更新 `Campsite` interface**

在 `src/types/database.ts` 的 `Campsite` interface 的 `zone_config?: string` 之後加入：

> ⚠️ 注意：spec 文件的 TypeScript 區塊已過時，**不要**加入 `booking_window_months`。以下為正確版本：

```typescript
// 在 `zone_config?: string` 之後加入：
playground_features?: string[]
water_features?: string[]
scenery_features?: string[]
spot_types?: string[]
booking_method?: string[]
booking_available_until?: string | null
booking_timing?: string | null
booking_difficulty?: 'normal' | 'moderate' | 'hard'
recommended_spots?: string | null
campsite_notes?: string | null
booking_platform?: 'icamping' | 'campingfun' | null
booking_platform_url?: string | null
booking_last_available_date?: string | null
booking_scraped_at?: string | null
```

- [ ] **Step 2: 確認 build 無錯誤**

```bash
npm run build
```

Expected: 無 TypeScript 錯誤。

- [ ] **Step 3: Commit**

```bash
git add src/types/database.ts
git commit -m "feat(types): add facility and booking fields to Campsite interface"
```

---

## Chunk 2: CampsiteEditModal UI 擴充

### Files:
- Modify: `src/components/CampsiteEditModal.vue`

### 說明
在現有 Modal 底部新增一個可折疊的 Accordion 區塊「設施與訂位資訊」，包含兩個子區塊：設施（Checkbox 群組）和訂位資訊（表單欄位）。

Accordion 預設**展開**（因為資料匯入後需要編輯）。

---

### Task 3: 在 CampsiteEditModal 新增常數定義和 reactive 欄位

- [ ] **Step 1: 在 `<script setup>` 頂部新增常數**

在 `import type { Campsite }` 之後加入：

```typescript
// Facility options constants
const PLAYGROUND_OPTIONS = ['沙坑', '溜滑梯', '盪鞦韆', '遊戲室', '氣墊城堡', '滑草', '彈簧床', '兒童攀岩', '棒球九宮格']
const WATER_OPTIONS = ['戲水池', '溪流', '河流', '瀑布', '湖泊', '溫泉', '滑水道', '海邊']
const SCENERY_OPTIONS = ['櫻花', '落羽松', '桐花', '楓葉', '螢火蟲', '雲海', '夜景', '山景', '海景', '湖景', '森林']
const SPOT_TYPE_OPTIONS = ['草地', '碎石', '草地混碎石', '棧板', '雨棚', '免搭帳']
const BOOKING_METHOD_OPTIONS = ['電話', 'FB', 'Line', '官網']
const isFacilityOpen = ref(true)
```

- [ ] **Step 2: 在 `watch(() => props.campsite, ...)` 的 form 初始化中加入 fallback**

找到以下程式碼：
```typescript
form.value = {
  ...newVal,
  amenities: newVal.amenities || {
     has_fridge: false,
     has_freezer: false,
     has_water_dispenser: false
  }
}
```

改為：
```typescript
form.value = {
  ...newVal,
  amenities: newVal.amenities || {
     has_fridge: false,
     has_freezer: false,
     has_water_dispenser: false
  },
  playground_features: newVal.playground_features ?? [],
  water_features: newVal.water_features ?? [],
  scenery_features: newVal.scenery_features ?? [],
  spot_types: newVal.spot_types ?? [],
  booking_method: newVal.booking_method ?? [],
  booking_difficulty: newVal.booking_difficulty ?? 'normal',
}
```

- [ ] **Step 3: 確認 build 無錯誤**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/components/CampsiteEditModal.vue
git commit -m "feat(modal): add facility field state initialization"
```

---

### Task 4: 加入 Accordion UI（Template 部分）

- [ ] **Step 1: 找到 Modal template 底部的儲存按鈕區域**

在 `CampsiteEditModal.vue` 的 `<template>` 中，找到儲存按鈕（含 `isSaving` 的 `<button>`）之前，加入以下 Accordion 區塊：

```html
<!-- 設施與訂位資訊 Accordion -->
<div class="border border-gray-200 rounded-xl overflow-hidden mb-4">
  <button
    type="button"
    @click="isFacilityOpen = !isFacilityOpen"
    class="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
  >
    <span class="font-bold text-primary-900 text-sm">設施與訂位資訊</span>
    <svg
      class="w-4 h-4 text-gray-500 transition-transform"
      :class="{ 'rotate-180': isFacilityOpen }"
      fill="none" viewBox="0 0 24 24" stroke="currentColor"
    >
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
    </svg>
  </button>

  <div v-show="isFacilityOpen" class="p-4 space-y-5">

    <!-- 遊樂設施 -->
    <div>
      <p class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">遊樂設施</p>
      <div class="flex flex-wrap gap-2">
        <label
          v-for="opt in PLAYGROUND_OPTIONS"
          :key="opt"
          class="flex items-center gap-1.5 cursor-pointer"
        >
          <input
            type="checkbox"
            :value="opt"
            v-model="form.playground_features"
            class="w-4 h-4 rounded accent-sky-500"
          />
          <span class="text-sm text-gray-700">{{ opt }}</span>
        </label>
      </div>
    </div>

    <!-- 水域設施 -->
    <div>
      <p class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">水域設施</p>
      <div class="flex flex-wrap gap-2">
        <label
          v-for="opt in WATER_OPTIONS"
          :key="opt"
          class="flex items-center gap-1.5 cursor-pointer"
        >
          <input
            type="checkbox"
            :value="opt"
            v-model="form.water_features"
            class="w-4 h-4 rounded accent-sky-500"
          />
          <span class="text-sm text-gray-700">{{ opt }}</span>
        </label>
      </div>
    </div>

    <!-- 自然景觀 -->
    <div>
      <p class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">自然景觀</p>
      <div class="flex flex-wrap gap-2">
        <label
          v-for="opt in SCENERY_OPTIONS"
          :key="opt"
          class="flex items-center gap-1.5 cursor-pointer"
        >
          <input
            type="checkbox"
            :value="opt"
            v-model="form.scenery_features"
            class="w-4 h-4 rounded accent-sky-500"
          />
          <span class="text-sm text-gray-700">{{ opt }}</span>
        </label>
      </div>
    </div>

    <!-- 營位類型 -->
    <div>
      <p class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">營位類型</p>
      <div class="flex flex-wrap gap-2">
        <label
          v-for="opt in SPOT_TYPE_OPTIONS"
          :key="opt"
          class="flex items-center gap-1.5 cursor-pointer"
        >
          <input
            type="checkbox"
            :value="opt"
            v-model="form.spot_types"
            class="w-4 h-4 rounded accent-sky-500"
          />
          <span class="text-sm text-gray-700">{{ opt }}</span>
        </label>
      </div>
    </div>

    <hr class="border-gray-100" />

    <!-- 訂位資訊 -->
    <div class="space-y-3">
      <p class="text-xs font-bold text-gray-500 uppercase tracking-wide">訂位資訊</p>

      <!-- 訂位方式 -->
      <div>
        <p class="text-sm text-gray-600 mb-1.5">訂位方式</p>
        <div class="flex flex-wrap gap-3">
          <label
            v-for="opt in BOOKING_METHOD_OPTIONS"
            :key="opt"
            class="flex items-center gap-1.5 cursor-pointer"
          >
            <input
              type="checkbox"
              :value="opt"
              v-model="form.booking_method"
              class="w-4 h-4 rounded accent-sky-500"
            />
            <span class="text-sm text-gray-700">{{ opt }}</span>
          </label>
        </div>
      </div>

      <!-- 訂位平台連結 -->
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-sm text-gray-600 mb-1">訂位平台</label>
          <select
            v-model="form.booking_platform"
            class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent-sky outline-none"
          >
            <option :value="null">無</option>
            <option value="icamping">愛露營</option>
            <option value="campingfun">露營樂</option>
          </select>
        </div>
        <div>
          <label class="block text-sm text-gray-600 mb-1">平台連結</label>
          <input
            v-model="form.booking_platform_url"
            type="url"
            placeholder="https://..."
            class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent-sky outline-none"
          />
        </div>
      </div>

      <!-- 可訂到期日 + 訂位規則 -->
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-sm text-gray-600 mb-1">可訂到期日</label>
          <input
            v-model="form.booking_available_until"
            type="date"
            class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent-sky outline-none"
          />
        </div>
        <div>
          <label class="block text-sm text-gray-600 mb-1">訂位規則說明</label>
          <input
            v-model="form.booking_timing"
            type="text"
            placeholder="例：每月1號、年底"
            class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent-sky outline-none"
          />
        </div>
      </div>

      <!-- 搶位難度 -->
      <div>
        <label class="block text-sm text-gray-600 mb-1.5">搶位難度</label>
        <div class="flex gap-4">
          <label class="flex items-center gap-1.5 cursor-pointer">
            <input type="radio" value="normal" v-model="form.booking_difficulty" class="accent-sky-500" />
            <span class="text-sm text-gray-700">不難</span>
          </label>
          <label class="flex items-center gap-1.5 cursor-pointer">
            <input type="radio" value="moderate" v-model="form.booking_difficulty" class="accent-orange-500" />
            <span class="text-sm text-gray-700">稍難搶</span>
          </label>
          <label class="flex items-center gap-1.5 cursor-pointer">
            <input type="radio" value="hard" v-model="form.booking_difficulty" class="accent-red-500" />
            <span class="text-sm text-gray-700">需要搶</span>
          </label>
        </div>
      </div>

      <!-- 推薦營位 -->
      <div>
        <label class="block text-sm text-gray-600 mb-1">推薦營位</label>
        <input
          v-model="form.recommended_spots"
          type="text"
          placeholder="例：A1、B2~B5"
          class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent-sky outline-none"
        />
      </div>

      <!-- 其他備注 -->
      <div>
        <label class="block text-sm text-gray-600 mb-1">其他備注</label>
        <textarea
          v-model="form.campsite_notes"
          rows="3"
          placeholder="其他資訊..."
          class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent-sky outline-none resize-none"
        />
      </div>
    </div>

  </div>
</div>
```

- [ ] **Step 2: 確認 build 無錯誤**

```bash
npm run build
```

- [ ] **Step 3: 手動測試**

啟動 dev server：`npm run dev`
前往營地庫 → 點任一營地 → 確認「設施與訂位資訊」Accordion 出現，展開/收合正常，Checkbox 可勾選，儲存後資料正確寫入 Supabase。

- [ ] **Step 4: Commit**

```bash
git add src/components/CampsiteEditModal.vue
git commit -m "feat(modal): add facility and booking info accordion"
```

---

## Chunk 3: CampsiteLibrary 卡片標籤顯示

### Files:
- Modify: `src/components/CampsiteLibrary.vue`

---

### Task 5: 在營地卡片加入標籤顯示

- [ ] **Step 1: 找到 CampsiteLibrary.vue 的卡片 template**

找到 `v-for="site in filteredCampsites"` 迴圈內的卡片內容，在現有卡片 **底部**（admin 操作按鈕之前）加入標籤顯示：

```html
<!-- 景觀/設施標籤 -->
<div class="mt-2 flex flex-wrap gap-1" v-if="site.scenery_features?.length || site.water_features?.length || site.playground_features?.length">
  <template v-for="tag in (site.scenery_features ?? []).slice(0, 3)" :key="'s-'+tag">
    <span class="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded-full font-medium">{{ tag }}</span>
  </template>
  <span v-if="(site.scenery_features?.length ?? 0) > 3" class="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
    +{{ (site.scenery_features?.length ?? 0) - 3 }}
  </span>
  <span v-if="site.water_features?.length" class="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">💧 水域</span>
  <span v-if="site.playground_features?.length" class="text-[10px] bg-yellow-50 text-yellow-600 px-1.5 py-0.5 rounded-full">🎠 遊樂</span>
</div>

<!-- 訂位相關標籤 -->
<div class="mt-1 flex flex-wrap gap-1">
  <span
    v-if="site.booking_difficulty === 'hard'"
    class="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded-full font-bold"
  >需搶</span>
  <span
    v-else-if="site.booking_difficulty === 'moderate'"
    class="text-[10px] bg-orange-50 text-orange-500 px-1.5 py-0.5 rounded-full font-bold"
  >稍難搶</span>
  <a
    v-if="site.booking_platform_url"
    :href="site.booking_platform_url"
    target="_blank"
    rel="noopener"
    @click.stop
    class="text-[10px] bg-sky-50 text-sky-600 px-1.5 py-0.5 rounded-full font-medium hover:bg-sky-100 transition-colors"
  >前往訂位 ↗</a>
  <span
    v-if="site.booking_last_available_date && isNewlyOpened(site.booking_last_available_date, site.booking_scraped_at)"
    class="text-[10px] bg-green-500 text-white px-1.5 py-0.5 rounded-full font-bold animate-pulse"
  >訂位剛開放！</span>
  <span
    v-if="isExpiringSoon(site.booking_available_until)"
    class="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full font-medium"
  >訂位快到期</span>
</div>
```

- [ ] **Step 2: 在 `<script setup>` 加入 helper functions**

```typescript
// 訂位剛開放：scraping 在 7 天內且日期有更新過（非 null）
const isNewlyOpened = (lastAvailableDate: string | null | undefined, scrapedAt: string | null | undefined) => {
  if (!lastAvailableDate || !scrapedAt) return false
  const scraped = new Date(scrapedAt)
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  return scraped > sevenDaysAgo
}

// 可訂到期日快到了（30 天內）
const isExpiringSoon = (availableUntil: string | null | undefined) => {
  if (!availableUntil) return false
  const deadline = new Date(availableUntil)
  const thirtyDaysLater = new Date()
  thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30)
  return deadline <= thirtyDaysLater && deadline >= new Date()
}
```

- [ ] **Step 3: build + 手動測試**

```bash
npm run build
```

啟動 dev server，確認已有資料的營地卡片正確顯示景觀標籤、訂位標籤。

- [ ] **Step 4: Commit**

```bash
git add src/components/CampsiteLibrary.vue
git commit -m "feat(library): show facility and booking tags on campsite cards"
```

---

## Chunk 4: 一次性資料匯入腳本

### Files:
- Create: `scripts/import-campsites.ts`
- Create: `data/campsites.xlsx`（使用者需自行放置）

---

### Task 6: 撰寫匯入腳本

- [ ] **Step 1: 安裝依賴**

```bash
npm install --save-dev tsx xlsx dotenv
```

- [ ] **Step 2: 確認 `.env.local` 有以下兩個變數**

```
SUPABASE_URL=https://xxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...（從 Supabase Dashboard → Settings → API 取得 service_role key）
```

- [ ] **Step 3: 建立 `scripts/import-campsites.ts`**

```typescript
import * as XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// === Mapping Tables ===
const PLAYGROUND_MAP: Record<string, string> = {
  '溜': '溜滑梯', '沙': '沙坑', '盪': '盪鞦韆',
  '遊戲區': '遊戲室', '遊戲室': '遊戲室',
  '氣墊城堡': '氣墊城堡', '滑草': '滑草',
  '彈簧床': '彈簧床', '兒童攀岩': '兒童攀岩',
  '棒球九宮格': '棒球九宮格'
}
const WATER_MAP: Record<string, string> = {
  '池': '戲水池', '溪': '溪流', '河': '河流',
  '瀑布': '瀑布', '湖': '湖泊', '溫泉': '溫泉',
  '滑水道': '滑水道', '海': '海邊'
}
const SCENERY_MAP: Record<string, string> = {
  '櫻': '櫻花', '落羽松': '落羽松', '桐花': '桐花',
  '楓': '楓葉', '螢': '螢火蟲', '螢火蟲': '螢火蟲',
  '雲': '雲海', '雲海': '雲海', '夜': '夜景', '夜景': '夜景',
  '山': '山景', '海景': '海景', '湖景': '湖景',
  '林': '森林', '森林': '森林'
}

function mapTags(raw: string | undefined, mapping: Record<string, string>): string[] {
  if (!raw) return []
  const tokens = String(raw).split(/[\s　]+/).filter(Boolean)
  const result: string[] = []
  const unmapped: string[] = []
  for (const token of tokens) {
    if (mapping[token]) {
      if (!result.includes(mapping[token])) result.push(mapping[token])
    } else {
      unmapped.push(token)
    }
  }
  return result
}

function parseLocation(location: string | undefined): { city: string; district: string } {
  if (!location) return { city: '', district: '' }
  const s = String(location)
  // 縣市列表（與 TAIWAN_LOCATIONS 保持一致）
  const cities = ['台北', '新北', '桃園', '新竹', '苗栗', '台中', '彰化', '南投', '雲林',
    '嘉義', '台南', '高雄', '屏東', '宜蘭', '花蓮', '台東', '澎湖', '基隆', '新竹市', '嘉義市']
  for (const city of cities) {
    if (s.startsWith(city)) {
      const district = s.slice(city.length).trim()
      return { city, district }
    }
  }
  return { city: s, district: '' }
}

function parseDate(val: any): string | null {
  if (!val) return null
  const s = String(val).trim()
  // Excel date serial number
  if (/^\d{5}$/.test(s)) {
    const d = XLSX.SSF.parse_date_code(Number(s))
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
  }
  // String like 2026/9/30
  const match = s.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/)
  if (match) {
    return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`
  }
  return null
}

function parseSpotTypes(row: any): string[] {
  const types: string[] = []
  if (row['草地']) types.push('草地')
  if (row['碎石']) types.push('碎石')
  if (row['草地'] && row['碎石']) types.push('草地混碎石') // 兩種都有 → 草地混碎石
  if (row['雨棚']) types.push('雨棚') // 有雨棚遮蓋的營位
  if (row['棧板']) types.push('棧板')
  if (row['免搭']) types.push('免搭帳')
  return [...new Set(types)] // dedupe
}

async function main() {
  const filePath = process.argv[2] || './data/campsites.xlsx'
  if (!fs.existsSync(filePath)) {
    console.error(`找不到檔案：${filePath}`)
    process.exit(1)
  }

  const workbook = XLSX.readFile(filePath)
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })

  console.log(`讀取到 ${rows.length} 筆資料`)

  let success = 0
  let failed = 0

  for (const row of rows) {
    const name = String(row['名稱'] || '').trim()
    if (!name) continue

    const { city, district } = parseLocation(row['地點'])
    const altitude = row['海拔'] ? Number(row['海拔']) : null

    // Unmapped playground tokens → notes
    const playgroundTokens = String(row['遊樂區'] || '').split(/[\s　]+/).filter(Boolean)
    const unmappedPlayground = playgroundTokens.filter(t => !PLAYGROUND_MAP[t])

    const campsite = {
      name,
      city,
      district,
      altitude,
      is_verified: false,
      playground_features: mapTags(row['遊樂區'], PLAYGROUND_MAP),
      water_features: mapTags(row['水'], WATER_MAP),
      scenery_features: mapTags(row['景'], SCENERY_MAP),
      spot_types: parseSpotTypes(row),
      booking_available_until: parseDate(row['可訂時間']),
      booking_timing: String(row['訂位時間'] || '').trim() || null,
      booking_difficulty: row['要搶'] === 'O' ? 'hard' : row['要搶'] === '△' ? 'moderate' : 'normal',
      recommended_spots: String(row['推薦營位'] || '').trim() || null,
      campsite_notes: [
        String(row['其他'] || '').trim(),
        unmappedPlayground.length ? `遊樂區（未對應）：${unmappedPlayground.join(' ')}` : ''
      ].filter(Boolean).join('；') || null,
    }

    // upsert on name to avoid duplicates if script is re-run
    const { error } = await (supabase.from('campsites') as any).upsert(campsite, { onConflict: 'name', ignoreDuplicates: false })
    if (error) {
      console.error(`❌ 匯入失敗：${name}`, error.message)
      failed++
    } else {
      console.log(`✅ 已匯入：${name}`)
      success++
    }
  }

  console.log(`\n完成：成功 ${success} 筆，失敗 ${failed} 筆`)
}

main().catch(console.error)
```

- [ ] **Step 4: 準備資料檔案**

先建立資料目錄並更新 `.gitignore`（**必須在放置 Excel 前完成**）：

```bash
mkdir -p scripts data
echo "data/" >> .gitignore
```

把 Google Sheets 下載為 `.xlsx` 格式，放到 `data/campsites.xlsx`。

- [ ] **Step 5: 執行匯入**

```bash
npx tsx scripts/import-campsites.ts ./data/campsites.xlsx
```

確認輸出中大部分為 ✅，失敗的再手動處理。

- [ ] **Step 6: 前往 CampsiteLibrary 確認資料正確匯入**

開 dev server 確認營地庫有新資料，部分營地有設施標籤。

- [ ] **Step 7: Commit**

```bash
git add scripts/import-campsites.ts .gitignore
git commit -m "feat(scripts): add one-time campsite import script"
```

---

## 完成後確認清單

- [ ] Supabase `campsites` 資料表有 14 個新欄位
- [ ] `Campsite` TypeScript interface 同步更新
- [ ] CampsiteEditModal 有「設施與訂位資訊」Accordion，可正常儲存
- [ ] CampsiteLibrary 卡片顯示景觀標籤和訂位難度
- [ ] 匯入腳本成功執行，資料出現在 App 中
- [ ] `npm run build` 無錯誤
