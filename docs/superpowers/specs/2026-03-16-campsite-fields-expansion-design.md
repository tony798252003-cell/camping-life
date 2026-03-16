# 設計文件：營地庫欄位擴充 + 資料匯入

**日期：** 2026-03-16
**狀態：** 待實作（v2：加入爬蟲範圍）

---

## 背景

使用者有一份 Google Sheets 記錄著台灣各地待去的露營區，包含設施、景觀、訂位規則等資訊。現有 `campsites` 資料表缺少這些欄位。目標是擴充營地庫的資料模型、將現有 Excel 資料一次性匯入，並透過爬取愛露營（iCamping）和露營樂平台，自動取得各營區的訂位開放週期資訊。

---

## 範圍

1. Supabase Migration：新增欄位至 `campsites` 資料表
2. TypeScript 型別更新：更新 `Campsite` interface
3. UI 擴充：`CampsiteEditModal` 加入新欄位編輯介面（以 Accordion 分組避免 Modal 過長）
4. 一次性資料匯入腳本
5. `CampsiteLibrary` 顯示新欄位
6. 爬蟲：Supabase Edge Function 爬取愛露營/露營樂的訂位開放週期，每週自動執行 + 手動觸發

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
| `booking_available_until` | `date` | 可訂位到期日（Excel「可訂時間」欄，如 2026/9/30）。意思是：這個日期之後暫停開放訂位，不是截止報名。若無限期開放則為 null。 |
| `booking_timing` | `text` | 訂位規則說明（Excel「訂位時間」欄，如「1號」「年底」「180天後」）。儲存原始文字，不轉換。 |
| `booking_difficulty` | `text` | 搶位難度：`normal`（預設）/ `moderate`（△）/ `hard`（O） |
| `booking_window_months` | `integer` | 訂位開放提前幾個月（由爬蟲自動填入，如 6 表示提前6個月開放）。null 表示尚未爬取或不在平台上。 |
| `booking_platform` | `text` | 訂位平台：`icamping`（愛露營）/ `campingfun`（露營樂）/ null（不在平台） |
| `booking_platform_url` | `text` | 營地在平台上的直接連結 |
| `booking_scraped_at` | `timestamptz` | 最後一次爬取時間，用於判斷資料新鮮度 |
| `recommended_spots` | `text` | 推薦營位說明 |
| `campsite_notes` | `text` | 其他備注 |

> `booking_available_until` 與 `booking_timing` 用途不同：前者是日期截止點，後者是週期性規則說明，兩欄不重疊。

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

**`booking_difficulty`**
`normal`（不難）/ `moderate`（稍難搶，Excel △）/ `hard`（需要搶，Excel O）

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
  ADD COLUMN booking_available_until date,
  ADD COLUMN booking_timing text,
  ADD COLUMN booking_difficulty text DEFAULT 'normal',
  ADD COLUMN recommended_spots text,
  ADD COLUMN campsite_notes text,
  ADD COLUMN booking_window_months integer,
  ADD COLUMN booking_platform text,
  ADD COLUMN booking_platform_url text,
  ADD COLUMN booking_scraped_at timestamptz;
```

RLS：沿用現有 `campsites` 資料表的 RLS 規則，無需額外設定。新欄位對登入用戶可讀，僅 admin 或 created_by 可寫，與現有行為一致。

---

## TypeScript 型別更新

在 `src/types/database.ts` 的 `Campsite` interface 新增：

```typescript
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
booking_window_months?: number | null
booking_platform?: 'icamping' | 'campingfun' | null
booking_platform_url?: string | null
booking_scraped_at?: string | null
```

**注意：** 陣列欄位在元件初始化時需要加 fallback，例如：
```typescript
const form = reactive({
  playground_features: campsite.playground_features ?? [],
  water_features: campsite.water_features ?? [],
  // ...
})
```

---

## UI 設計

### CampsiteEditModal：Accordion 分組

現有 Modal 已有多個區塊，新增欄位以 **Accordion（可折疊區塊）** 方式加入，避免 Modal 過長。新增一個「設施與訂位資訊」Accordion，包含：

**設施子區塊：**
- 遊樂設施 — Checkbox 群組（多選）
- 水域設施 — Checkbox 群組（多選）
- 自然景觀 — Checkbox 群組（多選）
- 營位類型 — Checkbox 群組（多選）

**訂位子區塊：**
- 訂位方式 — Checkbox 群組（多選）
- 可訂到期日 — Date picker
- 訂位規則說明 — 單行文字輸入（自由填寫，如「每月1號」）
- 搶位難度 — 三選一 Radio（不難 / 稍難搶 / 需要搶）
- 推薦營位 — 單行文字輸入
- 其他備注 — 多行文字輸入

### CampsiteLibrary 顯示

在營地卡片上以 pill 標籤方式顯示：
- 景觀標籤（最多 3 個，超過顯示 +N）
- 水域/遊樂設施 icon 提示
- 搶位難度標籤：`moderate` 顯示橙色「稍難搶」，`hard` 顯示紅色「需搶」
- 若 `booking_available_until` 在 30 天內到期，顯示黃色「訂位快到期」提醒

---

## 一次性資料匯入

撰寫 Node.js 腳本（`scripts/import-campsites.ts`），將 Excel 資料轉換並批次插入 Supabase。

### Excel 來源欄位對應表

| Excel 欄位 | 轉換邏輯 | 目標欄位 |
|-----------|---------|---------|
| 名稱 | 直接對應 | `name` |
| 地點（如「新竹尖石」）| 用空格/縣市名稱清單拆分 | `city` + `district` |
| 海拔 | 數字轉換 | `altitude` |
| 遊樂區（如「溜 沙 盪」）| 空白分隔，對應 mapping table | `playground_features` |
| 水（如「溪 池」）| 空白分隔，對應 mapping table | `water_features` |
| 景（如「櫻 落羽松」）| 空白分隔，對應 mapping table | `scenery_features` |
| 草地、碎石、雨棚、棧板有值 | 欄位有值 → 加入對應 spot_type | `spot_types` |
| 免搭 有值 | → 加入 `免搭帳` | `spot_types` |
| 可訂時間（如「2026/9/30」）| 解析日期 | `booking_available_until` |
| 訂位時間（如「1號」「年底」）| 原始文字 | `booking_timing` |
| 要搶（O / △）| O → `hard`，△ → `moderate`，空 → `normal` | `booking_difficulty` |
| 推薦營位 | 原始文字 | `recommended_spots` |
| 其他 | 原始文字 | `campsite_notes` |

### 遊樂區 Mapping Table（部分）

| Excel 值 | 對應標籤 |
|---------|---------|
| 溜 | 溜滑梯 |
| 沙 | 沙坑 |
| 盪 | 盪鞦韆 |
| 遊戲區 / 遊戲室 | 遊戲室 |
| 氣墊城堡 | 氣墊城堡 |
| 滑草 | 滑草 |
| 彈簧床 | 彈簧床 |
| 兒童攀岩 | 兒童攀岩 |
| 棒球九宮格 | 棒球九宮格 |

### 水域 Mapping Table

| Excel 值 | 對應標籤 |
|---------|---------|
| 池 | 戲水池 |
| 溪 | 溪流 |
| 河 | 河流 |
| 瀑布 | 瀑布 |
| 湖 | 湖泊 |
| 溫泉 | 溫泉 |
| 滑水道 | 滑水道 |
| 海 | 海邊 |

### 景色 Mapping Table

| Excel 值 | 對應標籤 |
|---------|---------|
| 櫻 | 櫻花 |
| 落羽松 | 落羽松 |
| 桐花 | 桐花 |
| 楓 | 楓葉 |
| 螢 / 螢火蟲 | 螢火蟲 |
| 雲 / 雲海 | 雲海 |
| 夜 / 夜景 | 夜景 |
| 山 | 山景 |
| 海景 | 海景 |
| 湖 / 湖景 | 湖景 |
| 林 / 森林 | 森林 |

無法對應的文字值 → 附加至 `campsite_notes`。

### 執行前置準備

```bash
npm install --save-dev tsx xlsx dotenv
```

環境變數（從 `.env.local` 讀取）：
```
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...  # 需 service role，繞過 RLS
```

執行方式：
```bash
npx tsx scripts/import-campsites.ts ./data/campsites.xlsx
```

---

---

## 爬蟲設計：訂位開放偵測器

### 目標

定期爬取愛露營（iCamping）和露營樂平台，偵測各營地是否**開放了新的訂位日期**。一旦偵測到，立即透過 App 內通知 + 手機推播通知使用者。

### 新增資料欄位（`campsites` 資料表）

| 欄位名 | 型別 | 說明 |
|--------|------|------|
| `booking_platform` | `text` | 訂位平台：`icamping` / `campingfun` / null |
| `booking_platform_url` | `text` | 營地在平台上的直接連結 |
| `booking_last_available_date` | `date` | 上次爬取時，平台上最遠可訂的日期 |
| `booking_scraped_at` | `timestamptz` | 最後一次爬取時間 |

> 移除原先設計的 `booking_window_months`，改為儲存實際最遠可訂日期做比較。

### 新增資料表：`booking_alerts`

用來儲存每次偵測到訂位開放的事件，作為 App 內通知的來源：

```sql
CREATE TABLE booking_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  campsite_id integer REFERENCES campsites(id),
  campsite_name text,
  new_available_date date,       -- 新偵測到的最遠可訂日期
  platform text,                 -- icamping / campingfun
  platform_url text,
  is_read boolean DEFAULT false,
  user_id text                   -- 通知對象（家族成員皆通知）
);
```

### 架構

- **Supabase Edge Function**（`supabase/functions/scrape-booking/index.ts`）
- **排程**：pg_cron 每週日凌晨2點自動執行
- **手動觸發**：設定頁面提供「立即檢查」按鈕，呼叫同一 Edge Function

### 爬取流程

1. 取出所有 `booking_platform` 不為 null 的營地
2. 對每筆營地，爬取平台頁面，取得目前**最遠可訂日期**
3. 比較 `booking_last_available_date`：
   - 若新日期 > 舊日期 → **偵測到新訂位開放**
   - 寫入 `booking_alerts` 資料表
   - 觸發 Web Push 通知
4. 更新 `booking_last_available_date` 與 `booking_scraped_at`

### 比對策略（初次設定）

首次使用時，需手動在 CampsiteEditModal 為每個營地設定 `booking_platform` 和 `booking_platform_url`（貼上平台連結）。不做自動名稱比對，避免比對錯誤。

### 通知機制

**App 內通知（In-app）：**
- 在 App 頂部導覽列顯示紅點（未讀 `booking_alerts` 數量）
- 點擊後顯示通知列表，內容：「{營地名稱} 在 {平台} 開放訂位了！最遠可訂到 {日期}」
- 點擊通知直接跳轉平台連結

**手機推播（Web Push）：**
- 使用 Web Push API + VAPID 金鑰
- Service Worker 接收推播（`vite-plugin-pwa` 已有 SW 基礎）
- Edge Function 爬到新訂位後，呼叫 Web Push API 推送
- 使用者需在首次使用時授權推播權限

### CampsiteLibrary 顯示

- 若有 `booking_platform_url`，顯示「前往訂位」連結按鈕
- 若 `booking_last_available_date` 在近 7 天內更新，顯示綠色「訂位剛開放！」標籤
- 若 `booking_scraped_at` 超過 14 天，顯示灰色「資訊可能過時」提示

---

## 不在範圍內

- 待去清單獨立頁面
- 已去/未去狀態欄位
- CSV 匯入 UI 功能
- amenities 欄位擴充（雨棚、電源、WiFi、烤肉設備）
- 車泊營位類型（Excel 中此欄位若出現，匯入時忽略）
- 依標籤篩選/搜尋功能（Phase 2 考慮）
