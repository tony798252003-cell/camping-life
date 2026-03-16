# 設計文件：營地庫欄位擴充 + 資料匯入

**日期：** 2026-03-16
**狀態：** 待實作

---

## 背景

使用者有一份 Google Sheets 記錄著台灣各地待去的露營區，包含設施、景觀、訂位規則等資訊。現有 `campsites` 資料表缺少這些欄位。目標是擴充營地庫的資料模型，並將現有 Excel 資料一次性匯入。

---

## 範圍

1. Supabase Migration：新增欄位至 `campsites` 資料表
2. TypeScript 型別更新：更新 `Campsite` interface
3. UI 擴充：`CampsiteEditModal` 加入新欄位編輯介面
4. 一次性資料匯入腳本
5. `CampsiteLibrary` 顯示新欄位

---

## 資料模型設計

### 新增欄位（`campsites` 資料表）

| 欄位名 | 型別 | 說明 |
|--------|------|------|
| `playground_features` | `text[]` | 遊樂設施標籤陣列 |
| `water_features` | `text[]` | 水域設施標籤陣列 |
| `scenery_features` | `text[]` | 自然景觀標籤陣列 |
| `spot_types` | `text[]` | 營位類型標籤陣列 |
| `booking_method` | `text[]` | 訂位方式標籤陣列 |
| `booking_deadline` | `date` | 可訂截止日期 |
| `booking_timing` | `text` | 訂位規則說明（例：1號、年底、180天後） |
| `is_competitive` | `boolean` | 是否難搶（預設 false） |
| `recommended_spots` | `text` | 推薦營位說明 |
| `campsite_notes` | `text` | 其他備注 |

### 欄位允許值

**`playground_features`**
`沙坑` `溜滑梯` `盪鞦韆` `遊戲室` `氣墊城堡` `滑草` `彈簧床` `兒童攀岩` `棒球九宮格`

**`water_features`**
`戲水池` `溪流` `河流` `瀑布` `湖泊` `溫泉` `滑水道` `海邊`

**`scenery_features`**
`櫻花` `落羽松` `桐花` `楓葉` `螢火蟲` `雲海` `夜景` `山景` `海景` `湖景` `森林`

**`spot_types`**
`草地` `碎石` `草地混碎石` `棧板` `免搭帳`

**`booking_method`**
`電話` `FB` `Line` `官網`

### 現有欄位保留不動

`amenities`（has_fridge / has_freezer / has_water_dispenser）維持原有結構，不擴充。

---

## Supabase Migration

```sql
ALTER TABLE campsites
  ADD COLUMN playground_features text[] DEFAULT '{}',
  ADD COLUMN water_features text[] DEFAULT '{}',
  ADD COLUMN scenery_features text[] DEFAULT '{}',
  ADD COLUMN spot_types text[] DEFAULT '{}',
  ADD COLUMN booking_method text[] DEFAULT '{}',
  ADD COLUMN booking_deadline date,
  ADD COLUMN booking_timing text,
  ADD COLUMN is_competitive boolean DEFAULT false,
  ADD COLUMN recommended_spots text,
  ADD COLUMN campsite_notes text;
```

---

## TypeScript 型別更新

在 `src/types/database.ts` 的 `Campsite` interface 新增：

```typescript
playground_features?: string[]
water_features?: string[]
scenery_features?: string[]
spot_types?: string[]
booking_method?: string[]
booking_deadline?: string | null
booking_timing?: string | null
is_competitive?: boolean
recommended_spots?: string | null
campsite_notes?: string | null
```

---

## UI 設計

### CampsiteEditModal 新增區塊

在現有編輯 Modal 裡新增「設施與訂位」區塊，包含：

- **遊樂設施** — Checkbox 群組（多選）
- **水域設施** — Checkbox 群組（多選）
- **自然景觀** — Checkbox 群組（多選）
- **營位類型** — Checkbox 群組（多選）
- **訂位方式** — Checkbox 群組（多選）
- **可訂截止日** — Date picker
- **訂位規則說明** — 單行文字輸入
- **是否難搶** — Toggle
- **推薦營位** — 單行文字輸入
- **其他備注** — 多行文字輸入

### CampsiteLibrary 顯示

在營地卡片上以小標籤（pill）方式顯示：
- 景觀標籤（最多 3 個）
- 水域/遊樂設施 icon 提示
- 若 `is_competitive === true`，顯示「需搶」警示標籤
- 若 `booking_deadline` 快到期，顯示提醒

---

## 一次性資料匯入

撰寫 Node.js 腳本（`scripts/import-campsites.ts`），將 Excel 資料轉換並批次插入 Supabase：

- 地點欄位（如「新竹尖石」）→ 拆分為 `city=新竹`、`district=尖石`
- 遊樂區/水/景文字 → 對應標籤陣列
- 草地/碎石欄位有值 → 對應 `spot_types`
- 可訂時間日期格式 → `booking_deadline`
- 要搶欄位（O/△）→ `is_competitive = true`
- 無法自動對應的資料 → 放入 `campsite_notes`

腳本執行方式：`npx tsx scripts/import-campsites.ts`

---

## 不在範圍內

- 待去清單獨立頁面
- 已去/未去狀態欄位
- CSV 匯入 UI 功能
- amenities 欄位擴充（雨棚、電源、WiFi、烤肉設備）
- 車泊營位類型
