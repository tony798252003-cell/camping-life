# 玻璃擬態台灣地圖實作計劃

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 將現有的六角形台灣地圖升級為真實地理輪廓，並實作玻璃擬態視覺效果

**Architecture:** 使用真實的台灣縣市 GeoJSON 資料轉換為 SVG paths，透過 SVG filters 和 CSS 實作玻璃擬態效果，保持現有的 Vue 3 Composition API 架構

**Tech Stack:** Vue 3, TypeScript, SVG, Tailwind CSS

---

## Task 1: 取得真實台灣地圖資料

**Files:**
- Modify: `src/constants/taiwanMapSvg.ts`

**Step 1: 搜尋並下載台灣地圖 GeoJSON**

使用以下開源資料之一：
- GitHub: `g0v/twgeojson` (推薦，台灣社群維護)
- Natural Earth Data
- 政府開放資料平台

下載縣市等級的 GeoJSON 檔案。

**Step 2: 轉換 GeoJSON 到 SVG paths**

使用線上工具或編寫轉換腳本：
```javascript
// 可以使用 https://geojson.io 查看
// 或使用 mapshaper.org 簡化並轉換為 SVG
```

**Step 3: 更新 taiwanMapSvg.ts**

替換現有的簡化路徑為真實路徑：

```typescript
export const TAIWAN_MAP_PATHS: CityPath[] = [
  {
    id: '基隆市',
    name: '基隆市',
    path: 'M [真實的 SVG path data]'
  },
  // ... 其他縣市
]
```

**Step 4: 驗證地圖顯示**

Run: `npm run dev`
檢查瀏覽器中地圖是否正確顯示為台灣形狀

**Step 5: 調整 viewBox**

如果地圖過大或過小，調整 SVG viewBox：

```vue
<svg
  viewBox="0 0 [width] [height]"
  ...
>
```

**Step 6: Commit**

```bash
git add src/constants/taiwanMapSvg.ts
git commit -m "feat(map): replace hexagonal paths with real Taiwan geographic data"
```

---

## Task 2: 實作 SVG 濾鏡定義

**Files:**
- Modify: `src/components/charts/TaiwanChoroplethMap.vue:96-116`

**Step 1: 在 SVG 中加入 defs 區塊**

在 `<svg>` 標籤內，template 開頭加入：

```vue
<svg ...>
  <defs>
    <!-- 濾鏡將在下一步加入 -->
  </defs>

  <!-- 現有內容 -->
</svg>
```

**Step 2: 定義弱發光濾鏡**

```vue
<defs>
  <!-- 弱發光 (1-2次) -->
  <filter id="glow-weak" x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
    <feColorMatrix
      in="blur"
      type="matrix"
      values="0 0 0 0 0.22
              0 0 0 0 0.74
              0 0 0 0 0.97
              0 0 0 0.6 0"
      result="glow"
    />
    <feMerge>
      <feMergeNode in="glow" />
      <feMergeNode in="SourceGraphic" />
    </feMerge>
  </filter>
</defs>
```

**Step 3: 定義中等發光濾鏡**

```vue
<!-- 中等發光 (3-5次) -->
<filter id="glow-medium" x="-50%" y="-50%" width="200%" height="200%">
  <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="blur" />
  <feColorMatrix
    in="blur"
    type="matrix"
    values="0 0 0 0 0.13
            0 0 0 0 0.83
            0 0 0 0 0.93
            0 0 0 0.8 0"
    result="glow"
  />
  <feMerge>
    <feMergeNode in="glow" />
    <feMergeNode in="SourceGraphic" />
  </feMerge>
</filter>
```

**Step 4: 定義強發光濾鏡**

```vue
<!-- 強發光 (6+次) -->
<filter id="glow-strong" x="-50%" y="-50%" width="200%" height="200%">
  <feGaussianBlur in="SourceGraphic" stdDeviation="16" result="blur1" />
  <feColorMatrix
    in="blur1"
    type="matrix"
    values="0 0 0 0 0.02
            0 0 0 0 0.71
            0 0 0 0 0.83
            0 0 0 1 0"
    result="glow1"
  />
  <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur2" />
  <feColorMatrix
    in="blur2"
    type="matrix"
    values="0 0 0 0 1
            0 0 0 0 1
            0 0 0 0 1
            0 0 0 0.4 0"
    result="glow2"
  />
  <feMerge>
    <feMergeNode in="glow1" />
    <feMergeNode in="glow2" />
    <feMergeNode in="SourceGraphic" />
  </feMerge>
</filter>
```

**Step 5: 定義玻璃高光漸層**

```vue
<!-- 玻璃高光漸層 -->
<linearGradient id="glass-highlight" x1="0%" y1="0%" x2="0%" y2="100%">
  <stop offset="0%" style="stop-color:rgba(255,255,255,0.4);stop-opacity:1" />
  <stop offset="50%" style="stop-color:rgba(255,255,255,0.1);stop-opacity:1" />
  <stop offset="100%" style="stop-color:rgba(255,255,255,0);stop-opacity:1" />
</linearGradient>
```

**Step 6: 驗證濾鏡定義**

Run: `npm run dev`
在開發工具中檢查 SVG defs 是否正確渲染

**Step 7: Commit**

```bash
git add src/components/charts/TaiwanChoroplethMap.vue
git commit -m "feat(map): add SVG filters for glassmorphism glow effects"
```

---

## Task 3: 重構顏色計算邏輯

**Files:**
- Modify: `src/components/charts/TaiwanChoroplethMap.vue:42-57`

**Step 1: 建立分級系統介面**

在 script 區塊頂部加入：

```typescript
interface GlowLevel {
  color: string
  filter: string
  opacity: number
}
```

**Step 2: 定義分級配置**

```typescript
const GLOW_LEVELS: Record<string, GlowLevel> = {
  none: {
    color: 'rgb(51, 65, 85)',
    filter: 'none',
    opacity: 0.6
  },
  weak: {
    color: 'rgb(56, 189, 248)',
    filter: 'url(#glow-weak)',
    opacity: 0.3
  },
  medium: {
    color: 'rgb(34, 211, 238)',
    filter: 'url(#glow-medium)',
    opacity: 0.4
  },
  strong: {
    color: 'rgb(6, 182, 212)',
    filter: 'url(#glow-strong)',
    opacity: 0.5
  }
}
```

**Step 3: 重構 getCityColor 函數**

替換現有的 `getCityColor` 函數：

```typescript
const getCityLevel = (cityId: string): GlowLevel => {
  const count = getCityCount(cityId)

  if (count === 0) return GLOW_LEVELS.none
  if (count <= 2) return GLOW_LEVELS.weak
  if (count <= 5) return GLOW_LEVELS.medium
  return GLOW_LEVELS.strong
}

const getCityColor = (cityId: string): string => {
  const level = getCityLevel(cityId)
  const { color, opacity } = level

  // 將 rgb 轉換為 rgba
  return color.replace('rgb', 'rgba').replace(')', `, ${opacity})`)
}
```

**Step 4: 新增 getCityFilter 函數**

```typescript
const getCityFilter = (cityId: string): string => {
  return getCityLevel(cityId).filter
}
```

**Step 5: 驗證分級邏輯**

在瀏覽器 console 測試：
```javascript
console.log(getCityColor('臺北市'))
console.log(getCityFilter('臺北市'))
```

**Step 6: Commit**

```bash
git add src/components/charts/TaiwanChoroplethMap.vue
git commit -m "refactor(map): implement tiered glow system for trip counts"
```

---

## Task 4: 套用濾鏡和玻璃效果到縣市路徑

**Files:**
- Modify: `src/components/charts/TaiwanChoroplethMap.vue:105-115`

**Step 1: 在 path 元素加入 filter 屬性**

更新 `<path>` 標籤：

```vue
<path
  v-for="city in TAIWAN_MAP_PATHS"
  :key="city.id"
  :d="city.path"
  :fill="getCityColor(city.id)"
  :filter="getCityFilter(city.id)"
  :stroke="hoveredCity === city.id ? '#fbbf24' : '#1e293b'"
  :stroke-width="hoveredCity === city.id ? 2 : 0.5"
  class="transition-all duration-200 cursor-pointer"
  @mouseenter="onCityHover(city.id, $event)"
  @mousemove="onCityMove($event)"
/>
```

**Step 2: 加入玻璃高光層**

在縣市路徑後加入高光覆蓋層：

```vue
<!-- 玻璃高光覆蓋層 -->
<path
  v-for="city in TAIWAN_MAP_PATHS"
  :key="`highlight-${city.id}`"
  :d="city.path"
  fill="url(#glass-highlight)"
  :opacity="getCityCount(city.id) > 0 ? 0.6 : 0"
  class="pointer-events-none"
/>
```

**Step 3: 驗證視覺效果**

Run: `npm run dev`
檢查：
- 未去過的縣市：深灰色，無發光
- 去過 1-2 次：淺藍色，柔和發光
- 去過 3-5 次：青色，中等發光
- 去過 6+ 次：明亮青色，強烈發光

**Step 4: Commit**

```bash
git add src/components/charts/TaiwanChoroplethMap.vue
git commit -m "feat(map): apply glassmorphism filters and highlight overlay"
```

---

## Task 5: 強化 Hover 效果

**Files:**
- Modify: `src/components/charts/TaiwanChoroplethMap.vue:105-115`

**Step 1: 加入 hover 狀態的亮度提升**

更新 path 的 class：

```vue
<path
  v-for="city in TAIWAN_MAP_PATHS"
  :key="city.id"
  :d="city.path"
  :fill="getCityColor(city.id)"
  :filter="getCityFilter(city.id)"
  :stroke="hoveredCity === city.id ? '#fbbf24' : '#1e293b'"
  :stroke-width="hoveredCity === city.id ? 2 : 0.5"
  class="transition-all duration-200 cursor-pointer hover:brightness-125"
  :class="{ 'scale-[1.02] origin-center': hoveredCity === city.id }"
  @mouseenter="onCityHover(city.id, $event)"
  @mousemove="onCityMove($event)"
/>
```

**Step 2: 優化過渡動畫**

確保 class 包含正確的過渡設定：

```vue
class="transition-all duration-200 ease-out cursor-pointer hover:brightness-125"
```

**Step 3: 測試 hover 互動**

Run: `npm run dev`
測試：
- 滑鼠移入縣市時亮度提升
- 金色邊框出現
- 輕微放大效果
- 過渡流暢無卡頓

**Step 4: Commit**

```bash
git add src/components/charts/TaiwanChoroplethMap.vue
git commit -m "feat(map): enhance hover effects with brightness and scale"
```

---

## Task 6: 升級 Tooltip 為玻璃擬態風格

**Files:**
- Modify: `src/components/charts/TaiwanChoroplethMap.vue:118-131`

**Step 1: 更新 Tooltip 樣式**

替換現有的 tooltip div：

```vue
<div
  v-if="hoveredCity"
  :style="tooltipStyle"
  class="absolute pointer-events-none z-50
         bg-slate-900/80 backdrop-blur-md
         border border-cyan-400/40 shadow-[0_0_20px_rgba(6,182,212,0.3)]
         rounded-xl px-4 py-2.5"
>
  <div class="font-bold text-cyan-100 text-sm">
    {{ getCityName(hoveredCity) }}
  </div>
  <div v-if="getCityCount(hoveredCity) > 0" class="text-white text-xs mt-0.5">
    露營 {{ getCityCount(hoveredCity) }} 次
  </div>
  <div v-else class="text-slate-400 text-xs mt-0.5">
    尚無記錄
  </div>
</div>
```

**Step 2: 測試 tooltip**

Run: `npm run dev`
檢查：
- 毛玻璃背景效果
- 青色發光邊框
- 內容清晰可讀
- 位置跟隨滑鼠且不超出畫面

**Step 3: Commit**

```bash
git add src/components/charts/TaiwanChoroplethMap.vue
git commit -m "feat(map): upgrade tooltip with glassmorphism style"
```

---

## Task 7: 調整容器背景為深色

**Files:**
- Modify: `src/components/charts/TaiwanChoroplethMap.vue:96-97`

**Step 1: 更新容器樣式**

替換外層 div 的 class：

```vue
<div class="relative w-full h-full flex items-center justify-center py-4
            bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900
            rounded-2xl shadow-2xl">
```

**Step 2: 驗證背景效果**

Run: `npm run dev`
檢查：
- 深色背景是否顯示
- 漸層是否自然
- 在淺色主題中是否突出

**Step 3: Commit**

```bash
git add src/components/charts/TaiwanChoroplethMap.vue
git commit -m "feat(map): add dark background with gradient"
```

---

## Task 8: 最終測試與調整

**Files:**
- Modify: 根據測試結果調整任何檔案

**Step 1: 完整功能測試**

Run: `npm run dev`

測試清單：
- [ ] 地圖顯示真實台灣形狀
- [ ] 不同露營次數顯示不同顏色和發光
- [ ] Hover 效果流暢（亮度、邊框、放大）
- [ ] Tooltip 正確顯示且位置合理
- [ ] 深色背景在淺色主題中突出

**Step 2: 建置測試**

Run: `npm run build`

檢查：
- 建置成功無錯誤
- 檔案大小合理

**Step 3: 最終 Commit**

```bash
git add .
git commit -m "chore(map): final adjustments and testing"
```

---

## 驗證標準

完成後應符合以下標準：

- ✅ 地圖使用真實台灣縣市輪廓
- ✅ 實現玻璃擬態視覺效果（半透明、發光、高光）
- ✅ 露營次數視覺分級清晰（0次、1-2次、3-5次、6+次）
- ✅ Hover 互動流暢無卡頓（200ms 過渡）
- ✅ 在淺色主題中深色地圖卡片形成視覺焦點
- ✅ 保持良好效能（60fps、無明顯延遲）
- ✅ 建置成功無錯誤
