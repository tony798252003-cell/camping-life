# 台灣縣市露營足跡地圖 - 設計文件

**日期**: 2026-02-02
**目的**: 取代現有的 3D 等軸地圖，改用清晰直觀的 SVG 分層設色地圖（Choropleth Map）

## 需求總結

建立一個台灣地圖來顯示各縣市的露營次數統計：
- 使用顏色深淺表示露營次數（顏色越深 = 去越多次）
- 支援 hover 顯示縣市名稱和具體次數
- 輕量級實作，不依賴額外的地圖庫
- 與現有深色背景和藍色系設計風格一致

## 整體架構

### 組件結構

**新組件**: `src/components/charts/TaiwanChoroplethMap.vue`

**輸入資料**:
- `trips: CampingTripWithCampsite[]` - 露營行程列表

**核心功能**:
1. **資料處理層** - 統計各縣市露營次數
2. **視覺化層** - SVG 台灣地圖，每個縣市是獨立的 path 元素
3. **互動層** - Hover 事件處理和 Tooltip 顯示

**技術棧**:
- Vue 3 Composition API
- 內嵌 SVG（台灣縣市向量路徑）
- Tailwind CSS
- TypeScript

## 資料流與邏輯

### 資料處理

```typescript
// 1. 統計各縣市露營次數
const cityStats = computed(() => {
  const counts: Record<string, number> = {}

  props.trips.forEach(trip => {
    const city = trip.campsites?.city
    if (city) {
      counts[city] = (counts[city] || 0) + 1
    }
  })

  return counts
})

// 2. 計算最大次數（用於顏色強度計算）
const maxCount = computed(() => {
  const values = Object.values(cityStats.value)
  return values.length > 0 ? Math.max(...values) : 1
})
```

### 顏色計算策略

**顏色方案**: 藍綠色漸層（與現有 UI 一致）

- **0 次（未去過）**: `#334155` (深灰色)
- **1-N 次**: 動態藍綠色漸層
  - 使用 HSL 色彩空間: `hsl(199, 89%, L%)`
  - 亮度 L: 70%（淺色，少次）→ 40%（深色，多次）
  - 計算公式: `L = 70 - (count/maxCount) * 30`

**優點**:
- 動態適應資料範圍（無論最多 5 次還是 50 次都清楚顯示）
- 顏色平滑過渡
- 符合 Sky Blue 設計系統

## SVG 地圖結構

### Template 結構

```vue
<template>
  <div class="relative w-full h-full flex items-center justify-center">
    <!-- SVG 容器 -->
    <svg
      viewBox="0 0 400 600"
      class="w-full max-w-md"
      @mouseleave="hoveredCity = null"
    >
      <!-- 每個縣市 -->
      <path
        v-for="city in taiwanCities"
        :key="city.id"
        :d="city.path"
        :fill="getCityColor(city.id)"
        :stroke="hoveredCity === city.id ? '#fbbf24' : '#1e293b'"
        :stroke-width="hoveredCity === city.id ? 2 : 0.5"
        class="transition-all duration-200 cursor-pointer"
        @mouseenter="onCityHover(city.id, $event)"
        @mousemove="onCityMove($event)"
      />
    </svg>

    <!-- Tooltip -->
    <div
      v-if="hoveredCity"
      :style="tooltipStyle"
      class="absolute pointer-events-none bg-slate-900/95 border border-sky-400/30
             rounded-lg px-3 py-2 text-sm backdrop-blur-sm"
    >
      <div class="font-bold text-sky-200">{{ getCityName(hoveredCity) }}</div>
      <div class="text-white text-xs">{{ getCityCount(hoveredCity) }} 次</div>
    </div>
  </div>
</template>
```

### 互動設計

1. **Hover 高亮**
   - 邊框加粗（0.5 → 2）
   - 邊框變色（深色 → 琥珀色 `#fbbf24`）
   - Tailwind transition 平滑過渡

2. **Tooltip 跟隨滑鼠**
   - 監聽 `@mousemove` 事件
   - 動態計算相對位置
   - 偏移 15px（避免遮擋滑鼠）

3. **視覺回饋**
   - 滑鼠懸停時 `cursor: pointer`
   - 顏色變化有 200ms 過渡動畫

## 實作細節

### Tooltip 邏輯

```typescript
const hoveredCity = ref<string | null>(null)
const tooltipPosition = ref({ x: 0, y: 0 })

const tooltipStyle = computed(() => ({
  left: `${tooltipPosition.value.x + 15}px`,
  top: `${tooltipPosition.value.y - 10}px`,
  transform: 'translateY(-100%)'
}))

function onCityHover(cityId: string, event: MouseEvent) {
  hoveredCity.value = cityId
  updateTooltipPosition(event)
}

function onCityMove(event: MouseEvent) {
  if (hoveredCity.value) {
    updateTooltipPosition(event)
  }
}

function updateTooltipPosition(event: MouseEvent) {
  const svg = event.currentTarget as SVGElement
  const rect = svg.getBoundingClientRect()
  tooltipPosition.value = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  }
}
```

### 錯誤處理

1. **無資料情況**
   - `trips.length === 0` → 所有縣市顯示灰色
   - 不顯示 "0 次"，改顯示 "尚無記錄"

2. **資料不匹配**
   - 縣市名稱不在 SVG 定義中 → 使用預設灰色
   - 不中斷渲染流程

3. **SVG 路徑缺失**
   - 提供空 path 作為 fallback
   - Console 警告但不報錯

### 效能優化

- 使用 `computed` 快取縣市統計（避免每次渲染重新計算）
- SVG 路徑定義為常數（不在響應式系統中）
- Tooltip 位置更新可選用 `requestAnimationFrame` 節流

## 整合計畫

### 修改檔案

**StatsView.vue**:
```vue
<script setup>
// 移除
// import TaiwanMap3D from '../components/charts/TaiwanMap3D.vue'

// 新增
import TaiwanChoroplethMap from '../components/charts/TaiwanChoroplethMap.vue'
</script>

<template>
  <!-- 原地圖區塊 (約第 90-106 行) -->
  <div class="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-6
              shadow-xl border border-slate-700 card-organic text-white">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-bold flex items-center gap-2 text-sky-200">
        <MapIcon class="w-5 h-5" />
        露營足跡地圖
      </h2>
    </div>

    <!-- 替換組件 -->
    <TaiwanChoroplethMap :trips="validTrips" />

    <div class="text-center text-xs text-slate-400 font-medium mt-4">
      各縣市露營次數 • 顏色越深去越多次
    </div>
  </div>
</template>
```

### 檔案清單

- ✅ **新建**: `src/components/charts/TaiwanChoroplethMap.vue`
- ✅ **修改**: `src/views/StatsView.vue`
- ✅ **刪除**: `src/components/charts/TaiwanMap3D.vue`

## 測試計畫

### 1. 視覺測試

- [ ] 各縣市顏色正確對應露營次數
- [ ] 未去過的縣市顯示為深灰色
- [ ] 在深色背景下可讀性良好
- [ ] 地圖比例和位置居中美觀
- [ ] 顏色漸層平滑自然

### 2. 互動測試

- [ ] Hover 時正確顯示 tooltip
- [ ] Tooltip 位置跟隨滑鼠移動
- [ ] Tooltip 內容正確（縣市名稱 + 次數）
- [ ] 邊框高亮效果正常
- [ ] 離開縣市時 tooltip 消失

### 3. 資料測試

- [ ] 無露營資料時正確顯示（全灰色）
- [ ] 單一縣市多次露營正確累加
- [ ] 不同資料範圍的顏色適應（1-3次 vs 1-30次）
- [ ] 縣市名稱不匹配時不報錯

### 4. 響應式測試

- [ ] 桌面版顯示正常
- [ ] 平板版適應良好
- [ ] 手機版（觸控）可正常互動

## 技術債務與未來改進

### 當前限制

1. **SVG 路徑資料**: 需要手動維護台灣 22 縣市的 SVG path
2. **靜態地圖**: 無縮放、平移功能（符合當前需求）
3. **離島顯示**: 金門、馬祖、澎湖等離島可能需要特殊處理

### 可能的未來擴展

1. **點擊跳轉**: 點擊縣市跳轉到該縣市的行程列表
2. **年份篩選**: 整合現有的年份選擇器
3. **圖例**: 新增顏色圖例說明（目前用文字描述）
4. **動畫**: 資料變化時的過渡動畫

## 預期效果

完成後，使用者可以：
- 一眼看出哪些縣市去得最多（深藍色）
- 快速識別尚未探索的縣市（灰色）
- Hover 查看精確的露營次數
- 享受流暢的視覺體驗（與現有設計風格一致）

相比原有的 3D 等軸地圖：
- ✅ 地圖形狀更清晰準確
- ✅ 資訊更直觀易讀
- ✅ 載入速度更快
- ✅ 維護成本更低
- ✅ 視覺效果更專業
