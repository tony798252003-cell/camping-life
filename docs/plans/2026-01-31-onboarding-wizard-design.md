# 首次登入引導流程設計

## 概覽

建立全屏 Onboarding Wizard，在使用者首次登入時引導完成基本設定。

## 核心需求

### 引導步驟（依序）

1. **家庭設定**（步驟 1/3）
   - 建立新家庭
   - 加入現有家庭（完成後直接結束引導）
   - 暫時不要

2. **設定起始地點**（步驟 2/3）
   - 地址搜尋 + 地圖確認
   - 保留使用者輸入的文字作為 location_name
   - 可跳過，下次登入會再提示

3. **新增第一頂帳篷**（步驟 3/3）
   - 簡化表單：名稱（必填）、品牌（選填）、圖片（必填）
   - 從系統圖片庫選擇（只有管理員可上傳）
   - 可跳過，下次登入會再提示

### 觸發邏輯

顯示引導的條件（智慧觸發）：
```typescript
shouldShowOnboarding =
  !userProfile.onboarding_completed_at &&
  !userProfile.family_id &&
  (!userProfile.latitude || !userProfile.longitude || !hasTent)
```

### 流程分支

```
步驟 1：家庭設定
├─ 加入現有家庭 → 完成引導（onboarding_completed_at）
├─ 建立新家庭 → 步驟 2
└─ 暫時不要 → 步驟 2

步驟 2：起始地點
├─ 設定地點 → 步驟 3
└─ 跳過 → 步驟 3

步驟 3：新增帳篷
├─ 新增帳篷 → 完成引導
└─ 跳過 → 完成引導
```

## 資料庫變更

### profiles 表

新增欄位：
```sql
ALTER TABLE profiles
ADD COLUMN onboarding_completed_at TIMESTAMP WITH TIME ZONE;
```

### 資料儲存

- **起始地點**：儲存到 `profiles` 表
  - `location_name`：使用者輸入的原始文字
  - `latitude`、`longitude`：從地圖 API 取得

- **帳篷**：儲存到 `camping_gear` 表
  - `category: 'tent'`
  - `image_url`：從 `system_assets` 選擇

## 技術實作

### 元件結構

```
OnboardingWizard.vue (主容器)
├─ OnboardingStepFamily.vue (步驟 1)
├─ OnboardingStepOrigin.vue (步驟 2)
└─ OnboardingStepTent.vue (步驟 3)
```

### 第三方依賴

1. **地圖搜尋**：Google Places Autocomplete API 或 Mapbox Geocoding
2. **地圖顯示**：Leaflet.js + OpenStreetMap

### 狀態管理

```typescript
// OnboardingWizard.vue
const currentStep = ref(1)
const familyChoice = ref<'create' | 'join' | 'skip' | null>(null)
const originData = ref({ location_name: '', latitude: null, longitude: null })
const tentData = ref({ name: '', brand: '', image_url: '' })
```

### 完成邏輯

```typescript
// 步驟 1：加入家庭
if (choice === 'join') {
  await updateProfile({ onboarding_completed_at: now })
  completeOnboarding()
}

// 步驟 3：完成帳篷設定
await updateProfile({
  ...originData,
  onboarding_completed_at: now
})
await createGear({ ...tentData, category: 'tent' })
completeOnboarding()
```

## UI/UX 規範

### 視覺設計

- 全屏 wizard，與 LoginView 相似風格
- 背景：`bg-surface-50` + 漸層裝飾球
- 卡片：`bg-white/80 backdrop-blur-xl rounded-[2.5rem]`
- 最大寬度：`max-w-2xl`

### 進度指示器

頂部顯示 3 條進度條，當前及之前步驟為 `bg-primary-500`

### 按鈕配置

- **主要按鈕**（下一步/完成）：右下角，primary 色
- **跳過按鈕**：右上角，灰色小字
- **返回按鈕**：左下角，從步驟 2 開始顯示

### 步驟過渡

使用 Vue Transition，向左滑出/向右滑入動畫

### 響應式

- 桌面：卡片置中，`p-12`
- 手機：卡片填滿，`p-6`，地圖高度 `200px`

## 錯誤處理

1. **地址搜尋失敗**：顯示錯誤訊息，允許重試或跳過
2. **加入家庭失敗**：顯示「邀請碼無效」，允許重新輸入
3. **建立資料失敗**：保留輸入資料，提供重試或稍後完成選項
4. **網路中斷**：顯示錯誤，提供重試按鈕
5. **中途離開**：下次登入重新觸發（不保留資料）

## 完成後行為

- 關閉 wizard
- 顯示 toast：「設定完成！開始記錄你的露營旅程吧 🏕️」
- 進入主頁（TripListView）

## 測試場景

- [ ] 新用戶首次登入顯示引導
- [ ] 建立新家庭流程完整
- [ ] 加入現有家庭直接完成
- [ ] 跳過家庭設定完成後續步驟
- [ ] 各步驟跳過行為正確
- [ ] 已完成引導不再顯示
- [ ] 已加入家庭不顯示引導
- [ ] 錯誤處理和重試機制
- [ ] 響應式設計在各裝置正常
- [ ] 動畫流暢不卡頓

## 實作順序

### 階段 1：基礎架構（1-2 小時）
1. 資料庫遷移
2. 建立空殼元件
3. 在 App.vue 整合觸發邏輯

### 階段 2：步驟元件（3-4 小時）
1. OnboardingStepFamily.vue
2. OnboardingStepOrigin.vue（含地圖整合）
3. OnboardingStepTent.vue（含圖片選擇器）

### 階段 3：整合與測試（1-2 小時）
1. 資料流串接
2. 錯誤處理
3. 動畫優化
4. 各場景測試
