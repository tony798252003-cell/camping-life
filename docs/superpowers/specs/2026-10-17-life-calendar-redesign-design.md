# 設計文件：搭帳日誌 → 生活行事曆＋露營紀錄（重新設計）

**日期：** 2026-10-17
**分支：** `redesign/life-calendar`
**狀態：** 規格草案（已依三份審查意見修訂，修訂處標「PM 決定（審查）」，總表見 §16）。§14 的疑問已由使用者回答（2026-10-17）；使用者選擇「簡化」路線（只有本人使用，不為多人產品過度設計），刪減內容見 §17，修訂處標「簡化（§17 Sx）」。等使用者確認（確認前不實作）
**來源：** 使用者共識，加上露營專家、UI/UX 設計師、架構師、資深工程師四份報告，由 PM 整合。整合時 PM 重新查證了 router、`supabaseQueries.ts`、`cpblService.ts`、`aiService.ts`、`index.html`、`vite.config.ts`、`utils/holidays.ts`、`useTravelTime.ts`、`HomeView.vue`、`CalendarView.vue`、`NextTripCard.vue`、`database.ts`、`calendar_events` 與 `cpbl_schedule` 的 migration。線上資料庫**沒有連線查證**。

---

## 1. 目的與為什麼

現在的「搭帳日誌」是一個露營 app，行事曆只是附屬功能。使用者實際的需求是**一個手機上的生活行事曆**，露營是其中一個分類，同時保留露營紀錄（行程、照片、裝備、統計、營地圖鑑）。

現況有四個問題，這次一起處理：

1. **核心畫面不對**：首頁是露營統計和回憶小工具，行事曆藏在第四個 tab，而且沒有週檢視和日檢視。
2. **營區資料會越來越亂**：`TripModal.vue:319-333` 存檔時用名稱「完全相等」找營區，找不到就自動新增一筆，名稱差一個字就產生重複資料。AI 自動填寫只靠模型記憶，連座標都用猜的。
3. **安全問題**：前端在 404 時用 `VITE_GEMINI_API_KEY` 直接呼叫 Gemini；`index.html` 載入帶有瀏覽器 key 的 Google Maps JS；`cpbl_schedule` 任何登入者都能寫入，而且同步經過第三方 `corsproxy.io`。
4. **無法維護**：主表的 CREATE 與 `campsites` 的 RLS 都不在版控，手寫型別已經和 schema 不一致，有 187 處 `any`，沒有測試。

## 2. 目標／非目標／反目標

**目標**
- 首頁改成行事曆：上方月曆，下方事件列表，列表頂端置頂「下一趟露營」卡。另有週檢視和日檢視。
- 事件分類可以自訂。中職賽程只顯示樂天桃猿，可以一鍵開關。
- 新增營區：貼上 Google Maps 連結，或輸入名稱後從候選選一個 → 伺服器產生草稿 → 使用者確認後存檔。
- 找新營區：依條件主動搜尋，列出尚未收錄的營區，一鍵產生草稿。
- 清理重複資料：完整備份（驗證可讀）→ 列清單 → 使用者確認 → 合併（行程/照片改指向保留那筆，被合併的那筆只做標記）→ 出問題就從備份整體還原。全程不刪除資料。
- 所有 schema 與 RLS 進版控，型別由資料庫產生；所有 API key 只放在伺服器端。
- 加上 Vitest，純邏輯都要有測試。

**非目標（這次不做）**
- 重複事件、提醒推播、搜尋、待辦、Google 行事曆同步。
- 分享介面（只預留 `visibility` 欄位）、定期掃描新營區（第二階段）。
- 行程訂金/尾款欄位；營區寵物/插電/價格/山路/訊號欄位（§14 Q3 已決定不加，這些資訊放 AI 摘要）。
- 「營地未定」的露營行程（§14 Q5 已決定不做）。
- Cloudinary 改成簽名上傳、GitHub Actions CI、ESLint（見 §13）。

**反目標（明確不能發生）**
- 任何程式自動刪除營區、行程或照片。
- AI 結果沒經過使用者確認就寫進資料庫。
- 前端 bundle 出現任何 Google 或 Gemini key。
- 爬取露營樂、愛露營等第三方露營網站。
- 外觀換風格。必須沿用現有的天藍主色、玻璃感、橘色 FAB、大圓角和小帳篷圖。

## 3. 限制

- 技術棧：Vue 3.5、TS 5.9、rolldown-vite、Tailwind v4、lucide、Supabase（前端直連＋RLS）、Vercel `api/` serverless。**不引入 Pinia、UI 套件或 Supabase Edge Functions**。
- 以手機為主（PWA），QA 尺寸是 375×812 和 390×844。
- 目前只有使用者一人使用。Vercel 為 Hobby 方案（推測），每個部署最多 12 個 function。
- 每月 API 費用越接近 0 越好：Places 用 field mask，Gemini 只在使用者按「產生草稿」時才呼叫。
- **Vercel 預覽環境與正式站共用同一個 Supabase**（§14 Q1 已決定），QA 在正式資料上建立的測試資料，標題一律用 `[QA]` 前綴。migration 只做加法（不改名、不刪除），理由是「所有資料保留」，而且正式站在模組合併前仍跑上一版前端；但**不為舊前端另加相容機制**（§17 S5）。
- 正式庫的 migration 由使用者本人在 Supabase SQL Editor 執行，agent 不持有正式庫的寫入權限。
- **本機沒有 Docker，也不安裝**（§14 Q4）。任何需要 Docker 的指令（`supabase start`、`supabase db reset`、`supabase db diff`、`supabase db dump`）都不使用。

## 4. 使用者已決定的事項（照共識原文，不可推翻）

> 定位：從露營 app 改為「生活行事曆＋露營紀錄」同一個 app，手機為主（PWA）。目前只有使用者一人使用；架構需預留之後與老婆共同編輯行事曆（事件可設定誰看得到），這次不做分享介面。保留 Vue 3 + Supabase，重整架構；外觀維持現有風格，保留裝備管理上傳的小帳篷圖。
>
> 行事曆（核心）：首頁為上方月曆、下方事件列表，列表頂端置頂『下一趟露營』卡（含天氣、車程）。必備：多天/全天事件、分類與顏色（預設 露營/棒球/工作/家庭/個人，可自訂新增與改色）、週檢視、日檢視。不做：重複事件、提醒推播、搜尋、待辦、Google 行事曆同步。中職賽程只顯示樂天桃猿，可一鍵開關。
>
> 營區：新增營區主要靠貼 Google Maps 連結，也可打名稱後選候選（不自動猜）；用 Google Places + Gemini（含 Google 搜尋）產生草稿，使用者看過再存。找新營區：主動搜尋（輸入地區/海拔/設施等條件），列出尚未收錄的營區，一鍵產生草稿；定期掃描不做（第二階段）。不爬露營樂等第三方網站。每月 API 費用越接近 0 越好，所有 key 只在伺服器端。
>
> 功能取捨：砍掉 營地平面圖(/builder, Konva)、Onboarding 精靈、營地審核、Excel 匯入、首頁回憶小工具、家庭共享（之後再做分享）。保留並適度重構：統計（含台灣地圖）、裝備管理（含小帳篷圖）、行程、照片、營地圖鑑、中職賽程。
>
> 資料與安全：所有資料保留；清理重複資料流程＝先完整備份 → 列疑似重複清單給使用者確認 → 確認後才合併並把行程/照片改指向保留的那筆，絕不自動刪除。把所有資料表與 RLS 補進版控，型別改由資料庫產生。修正：Gemini key 被打包進前端、cpbl_schedule 任何登入者可寫。還原未使用的 ajv 變更。
>
> 流程：先規劃（本階段），使用者確認規格後才實作；實作一個模組一個模組來，由 Sonnet 實作、QA 驗證（Vitest 單元測試＋手機尺寸瀏覽器實際操作），使用者在 Vercel 預覽網址確認後才合併；在 redesign/life-calendar 分支開發。

---

## 5. 資訊架構與畫面

### 5.1 路由（PM 決定：沿用現有路徑名稱，只做必要的增刪）

| 路徑 | 畫面 | 變動 |
|---|---|---|
| `/` | 行事曆首頁（月檢視）；`?view=week\|day&date=YYYY-MM-DD` 切換到週或日 | 取代 HomeView 和 CalendarView |
| `/calendar` | 轉址到 `/` | 舊書籤相容 |
| `/list` | 露營紀錄（未來／過去、列表／地圖） | 保留 |
| `/library` | 營地圖鑑 | 保留，移除審核和匯入 |
| `/library/new` | 新增營區（貼連結或打名稱 → 草稿 → 確認） | 新增 |
| `/library/discover` | 找新營區 | 新增 |
| `/stats` | 統計（含台灣地圖）；吸收原首頁的統計摘要 | 保留 |
| `/settings` | 出發地｜分類｜中職｜裝備與帳篷｜帳篷圖庫（僅 admin）｜登出 | 移除家庭、開發工具、批次 GPS |
| `/auth` | 登入 | 保留 |
| ~~`/builder`~~ | — | 刪除 |

除了 `MainLayout` 以外，其他路由一律 lazy import。

### 5.2 底部 tab（PM 決定：採 UI 設計師方案）

```
┌─────────────────────────────────────────┐
│  📅      🏕️      (＋)      🗺️      📊   │
│ 行事曆   露營            營地     統計    │
└─────────────────────────────────────────┘
```
設定入口維持在右上角頭像（現有慣例）。中間的橘色 FAB 會打開「新增」bottom sheet，選項有三個：📅 事件、🏕️ 露營、📍 新增營區。如果在行事曆上已經選了某一天，新增時預設就是那一天。

### 5.3 首頁：月檢視（線框引用 UI/UX 報告 §2-1）

```
┌─────────────────────────────────────┐
│ [logo]                Hi, Tony (●)  │
├─────────────────────────────────────┤
│ 2026年10月      ‹ 今天 ›  [月|週|日] │ ← sticky、玻璃感
│ [⚾ 桃猿 ●ON]  [分類 ▾]               │
├─────────────────────────────────────┤
│  一  二  三  四  五  六  日           │
│  5   6   7   8   9  10  11          │
│                  ━━露營━━━━━        │ ← 多天事件：跨格橫條
│ 12  13  14  15  16 [17] 18          │ ← 今天：sky ring
│  •   ••              •   ⚾          │ ← 單日：色點（最多 3）；⚾ 為角標
├─────────────────────────────────────┤
│ ┌ 🏕️ 下一趟露營 [已訂位] 還有 6 天 ──┐ │ ← 精簡卡（約 160px）
│ │ 雲頂露營區  10/23–10/25 (3天2夜)  │ │
│ │ ☀️ 18–26°  降雨 10%  🚗 約 2h15m  │ │
│ │ 建議 11:45 出發（14:00 進場）       │ │ ← 小字
│ │ 收帳日：可能濕帳 ⚠️                 │ │ ← 小字，只在有風險時出現
│ │ [⛺帳篷小圖]          [導航] [›]  │ │
│ └─────────────────────────────────┘ │
│ 10/17（六）今天                       │
│ ┃ 全天  家庭聚餐                 家庭 │ ← 左側 4px 分類色條
│ ┃ 全天  ⚾ 桃猿 vs 兄弟          棒球 │ ← cpbl_schedule 沒有開賽時間，一律全天
└─────────────────────────────────────┘
```

規則：
- **月曆格**：單日事件用分類色點表示，最多 3 點。多天事件在週列上畫成 `h-4 rounded-full` 的橫條，跨週時斷開重畫；一週最多 2 條，第 3 條起改成色點。中職比賽只在右上角放 ⚾ 角標（`yellow-400`），不再整格塗球隊漸層。假日的日期數字用 `red-500`，下方加 `text-[8px]` 假日名稱。過去的事件以 `opacity-50` 呈現，仍保留分類色。
- **事件列表（PM 決定）**：只顯示目前切到的月份。當月從今天開始列，其他月份列整個月；依日期分組。**點月曆上某一天的唯一規則（PM 決定（審查），§5.5、計畫 Task 3.8、M3 QA 都以此為準）**：那天在列表範圍內而且有事件 → 列表捲到那一天並高亮 1.5 秒；那天在列表範圍外（例如當月的過去日期）或沒有事件 → 開「當日列表」sheet（沒有事件時顯示空狀態和「＋在這天新增」）。被捨棄的方案：無限往下捲。理由是無限捲和月份切換的狀態同步比較複雜，需求也沒有要求。
- **置頂卡（PM 決定：精簡卡）**：只顯示「下一趟」，不做輪播。挑選規則見 §6.6。卡上依序顯示：營區名、行程狀態 pill（規劃中／已訂位；規劃中用淡色並提示「還沒訂位」）、日期（例如「3天2夜」，有夜衝時「夜衝＋3天2夜」）、倒數天數、每日天氣（最高/最低溫、降雨機率；**溫度一律顯示海拔校正後的數字**，並在天氣旁標示「已依海拔校正」；夜溫低於 10°C 的警告也用校正值判斷，規則見 §5.11，§14 Q7）、車程（前面加「約」，連假有塞車提示）、**建議出發時間**（進場時間或夜衝時間減車程，沿用 `NextTripCard.vue:211-233` 的算法）、**收帳日濕帳提示**（沿用 `useTripWeather.analyzePackUpWeather`，只在有風險時顯示一行）、帳篷小圖、導航按鈕。點卡片開啟 TripModal。舊行程沒有營區也沒有座標時，顯示行程上的營區名稱快照，不查天氣和車程。沒有下一趟時，顯示一行淡色提示「還沒有排下一趟 → 新增露營」。被捨棄的方案：保留現在 300px 以上的大卡，因為月曆會被擠到要捲動才看得到。PM 決定（審查）：建議出發時間和濕帳提示是露營專家指出的「最實用兩項」，各一行小字，卡片高度從約 140px 放寬到約 160px。
- **導航（PM 決定（審查））**：有 `google_place_id` 時用 `https://www.google.com/maps/dir/?api=1&destination=<名稱>&destination_place_id=<id>`，沒有才退回 `destination=lat,lng`。理由：營區 pin 常落在辦公室或沒有路的山坡。
- **行程狀態外觀（PM 決定（審查））**：規劃中的行程在月曆、週、日檢視用虛線框或淡色條，已訂位用實色。已取消的行程不出現。
- **桃猿開關**：pill toggle。ON 時酒紅底白字 `⚾ 桃猿`，OFF 時灰框。狀態存在 `profiles.show_cpbl`。現有的球隊和球場下拉選單刪除。
- **分類篩選**：多選 chip，預設全選。篩選狀態存在 localStorage，屬於個人便利設定。

### 5.4 週檢視、日檢視（引用 UI/UX §2-2、§2-3）

```
週：                                    日：
│ 10/12 – 10/18   ‹ 今天 › [週]  │      │ 10/17（六） 今天   ‹ › [日]   │
│     一 二 三 四 五 六 日        │      │ 一 二 三 四 五 [六] 日          │
│全天 ━━━━━露營━━━━━━         │      │ 全天                           │
│ 08 │▇工│  │  │  │  │  │  │   │      │ ┃ 露營 第1/3天 雲頂露營區 露營  │
│ 19 │  │  │  │  │  │  │  │   │      │ ┃ ⚾ 桃猿 vs 兄弟（全天）     │
│ ──────── 現在時間紅線 ───────  │
```
- **歸類規則（PM 決定（審查））**：「多天事件」只指 `allDay && endDate > startDate`，畫成月格橫條、放在週日檢視的全天區。有時段的事件（包含跨午夜）一律只走時間格，在月格上是每一天各一個色點。中職比賽沒有時間欄位，一律是全天單日。
- **夜衝（PM 決定（審查））**：有夜衝的行程，在 `trip_date - 1` 多畫一段「夜衝」（月格橫條的第一格用淡色，日檢視全天區顯示「夜衝 HH:mm 起」，時間取營區的 `night_rush_time`）。
- 時間軸預設捲到 07:00，可見 06–24，往上捲可以看到 00–06。全天區最多顯示 3 行，可以展開。
- 週檢視每欄約 45px，事件塊只顯示前 2–3 個字，點了開詳情。點日期表頭會跳到日檢視。
- 左右滑動切換週或日。PM 決定：先做 ‹ › 按鈕，swipe 列為加分項（Task 內標註）。理由是 swipe 在 iOS PWA 上容易和返回手勢衝突，按鈕一定可用。
- 重疊的有時段事件要分欄排列；首尾剛好相接的不算重疊；跨午夜的事件在兩天各畫一段。

### 5.5 事件詳情與新增／編輯（引用 UI/UX §2-4、§3）

- 點列表項目會開「事件詳情」bottom sheet（分類、標題、時間、備註、🔒 只有我、刪除和編輯按鈕）。點月曆上的某一天，依 §5.3 的唯一規則決定捲動或開「當日列表」sheet（底部附「＋在這天新增」）。這個 sheet 取代 `CalendarSelectionModal`。點中職比賽開唯讀的比賽 sheet，附「加入我的棒球事件」。
- **新增或編輯事件（全螢幕 sheet）**：標題｜分類 chip（右側 + 可新增分類）｜全天開關＋開始和結束日期（可以跨天），關閉全天時顯示時間｜備註｜如果當天有桃猿比賽，顯示「⚾ 這天有桃猿比賽 [套用]」。結束日期早於開始日期時，自動改成開始日期，只在表單上提示，不跳 alert。
- **顏色完全跟著分類（PM 決定）**，單一事件不能再另外選顏色。舊的 `color` 欄位保留但不再讀取。
- **可見度**：這次不顯示，資料一律寫入 `private`。
- **選了「露營」分類**：關閉事件 sheet，改開 TripModal 的新增模式，並帶入已選的日期。露營資料只存 `camping_trips`，一趟露營只輸入一次。**編輯既有事件時，露營分類 chip 停用**（PM 決定（審查）：避免一筆事件被「轉成」行程的半套狀態）。
- **開啟 TripModal 的方式（PM 決定（審查））**：新增 singleton `useTripModal()`（`openNew(date?: string)`、`openEdit(trip)`、`close()`），`App.vue` 的全域 TripModal 改讀它；TripModal 新增 `initialDate` prop。FAB、行事曆、列表都呼叫它，不再透過 `$emit('add')` 一路往上傳。

### 5.6 新增露營（TripModal 新增模式）

- **必須選一個已收錄的營區（PM 決定）**。搜尋框只搜 `campsites`。找不到時，按「＋新增營區」。移除「自由輸入名稱」模式，也移除存檔時自動新建營區的邏輯。被捨棄的方案：保留只填名稱的露營，因為這是重複資料的根源。舊行程如果沒有 `campsite_id`，仍然照常顯示快照欄位，可以編輯其他欄位。
- **不做「營地未定」（§14 Q5 決定 B）**：新增露營行程**必須選到營區才能存檔**。營區欄位空白，或填了名稱卻沒有 `campsite_id`，一律擋存檔，提示「請從清單選營區，或按＋新增營區」。找不到營區時，在**同一個畫面**開新增營區 sheet，存檔後自動選回。被捨棄的方案：露營專家建議的「先卡日期、營地之後再挑」。
- **時程（PM 決定（審查））**：「停止自動新建營區」**提前到 M0**（Task 0.8），否則 M2 清完重複後到 M4 之間還會繼續產生新的重複。過渡期（M0 到 M4）找不到營區時，「＋新增營區」打開現有的 `CampsiteEditModal`（新增模式，`App.vue` 已經 import），存檔後直接選回 TripModal，不換路由（§14 Q8 使用者已同意）。M4 再把它換成 §5.7 的新流程，同樣以 sheet 的形式開在 TripModal 上面，存檔後 emit `saved(campsite)` 選回，**不用** `/library/new?returnTo=` 往返（換路由會遺失 TripModal 已填的表單）。
- 新增時只顯示規劃用欄位（營區、日期與天數、夜衝、狀態、營位、費用、同行、帳篷小圖）。事後紀錄的欄位（評分、天氣狀況、照片）收合在「出發後再填」區塊。

### 5.7 新增營區（引用 UI/UX §4）

```
輸入：                                  草稿確認：
│ 📋 貼上 Google Maps 連結          │   │ ⓘ 有 3 個欄位請確認              │
│ [ https://maps.app.goo.gl/… ]    │   │ 名稱   雲頂露營區      📍Google  │
│            ── 或 ──              │   │ 海拔   1,200 m         ⛰️計算    │
│ 🔍 [ 雲頂        ] [搜尋]         │   │ ┃雨棚營位 [✓有] ✨AI ⚠️          │
│ ○ 雲頂露營區  新竹縣尖石鄉…       │   │ ┃來源：xx 部落格 ↗ [確認][修改]   │
│ ○ 雲頂山莊    南投縣仁愛鄉…       │   │ ┃夜衝時段 ？查無資料 ✨AI ⚠️      │
│ ○ 都不是 → 換關鍵字               │   │ [捨棄草稿]               [存檔] │
│                 [產生草稿 →]      │
```
- 名稱搜尋要按下「搜尋」才送出，不做即時自動完成。
- **貼連結也不自動猜（PM 決定（審查））**：貼連結後先呼叫 `/api/campsite-draft` 的 `resolveOnly` 模式，只回候選（`placeId`、名稱、地址、座標），**不呼叫 Gemini**。連結只有 `?q=` 時一律列候選讓使用者選。連結有座標時，第一筆候選距離 < 300 m 而且名稱相似（§6.5 `likely` 標準）才預先選取，否則列出候選；不論哪種，都要使用者按「產生草稿」才往下走。草稿頁頂端固定顯示 Places 解析出的名稱和地址，讓使用者確認選對了地點。
- **重複檢查放在入口**：拿到 place_id 或座標後（也就是在呼叫 Gemini 之前），先比對已收錄的營區（§6.5）。比對成功就顯示「這個可能已經收錄：XX [查看] [仍要新增]」。
- 產生中逐步顯示進度：取得地點 ✓ → 查海拔 ✓ → 搜尋設施資訊（約 10–30 秒）[取消]。Gemini 失敗時保留 Places 的資料，其他欄位讓使用者手動補。
- **跳過 AI（PM 決定（審查））**：拿到 Places 資料後就提供「跳過 AI，先存基本資料」按鈕（山上訊號差時用）。之後在營地詳情頁可以按「補查設施」，結果一樣是草稿，確認後才寫入（M5-3）。
- **資料來源預期**：草稿頁固定一行說明「很多營區的設施只在 FB 粉專，查不到的欄位請自己確認」。Gemini 透過 Google 搜尋引用露營樂、愛露營等頁面當來源**可以接受**（§14 Q9），但每個 AI 欄位都必須附來源連結，讓使用者點開查證；prompt 不排除任何網域。這不違反「不爬第三方網站」：我們的伺服器不去抓這些網站，引用的是 Google 搜尋結果。
- **三級標示**：
  1. 📍Google／⛰️計算：灰色 pill，視為可信，不需要確認。
  2. ✨AI（有來源）：紫色 pill，可以展開看來源連結。
  3. ⚠️ AI 不確定或查無資料：左側 4px `amber-400` 色條，`amber-50` 底，需要按「確認」或修改。

  **PM 決定（整合露營專家意見）**：雨棚/營位類型、衛浴熱水時段、夜衝時段、訂位方式與規則這四類欄位，只要是 AI 填的，一律標成 ⚠️，不看 AI 回報的信心度。**PM 決定（審查）**：再加上進場／退場時間（`check_in_time`、`check_out_time`，平日假日常不同）和設備（`amenities`，冰箱、飲水機常過時），共七個欄位。
- **AI 摘要（PM 決定（審查），不加欄位）**：Gemini prompt 要求把最後一段山路（小客車能否上、是否需四驅）、手機訊號（分電信）、熄燈與安靜時間、寵物、電源、最近採買點、包區整理成條列摘要，放進 `campsite_notes` 的 AI 摘要段落，整段標 ⚠️。**§14 Q3 已決定**：寵物、插電、價格、山路、訊號都不做成結構化欄位，也不加進篩選條件。
- 存檔時如果還有未確認的 ⚠️ 欄位，跳一次確認「還有 N 個欄位未確認，要直接存嗎？」，不硬擋。未確認狀態寫進 `field_sources`，之後在營地詳情頁看得到，也可以補確認。
- 「沒有」和「不知道」要分得出來：AI 查無資料就留空並標 ⚠️，不填 false 或空陣列。
- 搶位難度、推薦營位、個人備註這三個欄位不給 AI 填。

### 5.8 找新營區（引用 UI/UX §5）

條件：縣市（必選）＋鄉鎮（可不選）｜海拔 chip（不限/500+/800+/1000+/1500+）｜設施關鍵字 chip（雨棚、溪流、森林、遊樂設施…）｜自由描述（選填）。結果卡顯示：名稱、鄉鎮、海拔、Google 評分（是否保留依 M4 前的價目查證，見 §7.3）、地點類型標籤、營業狀態（暫停營業加註）、[地圖↗]、[＋產生草稿]。已經產生過草稿的卡片改顯示狀態，不能重複按。標題列寫「找到 N 個尚未收錄（已排除 M 個收錄過的）」。結果的設施欄一律顯示「未知（產生草稿時才查）」。
**PM 決定**：不做「從出發地 N 小時車程內」條件。被捨棄的理由：要批次算車程，增加呼叫和複雜度；用縣市和鄉鎮已經夠用。
**設施條件只當搜尋關鍵字（§14 Q6 決定 (a)）**：Places Text Search 只把設施當關鍵字放進查詢字串，不會依設施過濾。chip 區塊標題寫「設施關鍵字（只影響搜尋結果，不保證有）」，結果頁標題列下方也固定一行「設施條件不保證有，請產生草稿後確認」。不做「勾選後批次查設施」。
**PM 決定（審查）**：排除 `businessStatus = CLOSED_PERMANENTLY` 的結果；查詢字串用「露營 縣市 鄉鎮 關鍵字」（不用「露營區」，避免漏掉叫「營地」「露營場」的）；`includedType=campground` 實作時查文件後比較一次再決定是否加；多筆結果的海拔用 Open-Meteo 一次查多組座標，合併成一次呼叫。

### 5.9 其他畫面

- `/list`、`/stats`、照片：外觀和行為不變，只修型別和資料存取。統計頁頂端加入原首頁的 StatsHeader。
- TripModal：保留全域 modal 形式（PM 決定，**不**改成 `/trips/:id` 全頁），只依 §8 拆檔。營區配置圖（`layout_image_url`）是使用者上傳的照片，不屬於 /builder，所以保留。
- `index.html` 的 `user-scalable=no` 維持不動（PM 決定，原因是外觀維持現狀）。

### 5.10 設計 token（引用 UI/UX §0）

沿用 `src/style.css` 的 `@theme`。補上隱性 token `primary-200/300/700/800`，用 Tailwind sky 預設值，所以外觀不會變。移除未定義的 `font-display` class。新元件（toggle、chip、bottom sheet）用現有 class 組合，不引入 UI 套件。

預設分類色：

| 分類 | system_key | 顏色 |
|---|---|---|
| 露營 | `camping` | `#10b981` |
| 棒球 | `baseball` | `#9d1c32` |
| 工作 | `work` | `#3b82f6` |
| 家庭 | `family` | `#f59e0b` |
| 個人 | `personal` | `#8b5cf6` |

新增分類時可選的色盤沿用 EventModal 的 7 色：`#3b82f6 #ef4444 #10b981 #f59e0b #8b5cf6 #ec4899 #64748b`。

### 5.11 天氣的海拔校正（§14 Q7 使用者決定）

- 現況：`useTripWeather.ts:281-283` 呼叫 Open-Meteo forecast 時沒有帶 `&elevation=`（之前依使用者要求拿掉），山區營地的溫度可能被高估好幾度。
- 新規則：**畫面上顯示的所有溫度都改成校正後的數字**，夜溫 < 10°C 的警告也用校正值判斷。校正公式：`校正溫度 = 原始溫度 − 0.006 × (營區海拔 − 預報格點海拔)`（約每升高 1000 m 降 6°C）。「預報格點海拔」用 Open-Meteo forecast 回應中的 `elevation` 欄位；營區海拔用 `campsites.altitude`（沒有時退回 `trip.altitude`，再沒有時用現有的 elevation API 自動查到的值）。
- 有做校正時，天氣區塊顯示一行小字「已依海拔校正（營區 1,200 m）」；拿不到營區海拔時不校正，也不顯示這行。
- 校正放在 `useTripWeather` 的資料處理中（不加 `&elevation=` 參數，避免和 Open-Meteo 本身的降尺度重複計算；實作前查 Open-Meteo 文件確認 `elevation` 欄位的意義，見 §15）。因此置頂卡、TripModal 等所有用 `useTripWeather` 的畫面一起生效。

---

## 6. 資料模型與架構決策

### 6.1 原則
- **`camping_trips` 是露營資料唯一的來源**，不複製到 `calendar_events`。行事曆把行程、事件、中職比賽轉成同一種 `ViewEvent` 來顯示。行程固定使用 `system_key='camping'` 分類的顏色。
- **中職賽程是可以開關的疊加圖層，不算事件**。使用者自己要去看的比賽才建成事件，分類是棒球，並可以關聯 `cpbl_game_id`。
- **擁有者加可見度**：`calendar_events.created_by`（沿用現有欄位當 owner，不另外加 `owner_id`）和 `camping_trips.user_id`，兩張表都加 `visibility`。**新表**（`event_categories`）的 RLS 只開放給 owner；**既有表的 policy 不動**，包含 `calendar_events`、`camping_trips` 的家庭讀取 policy（§6.3）。`visibility` 這次只寫入、不參與 RLS。之後要分享時，再加 `calendar_shares` 表和 `can_see()` 函式。**這次不建**。（PM 決定（審查）：原文「這次的 RLS 只開放給 owner」和 §6.3「家庭 policy 全部保留」矛盾，依共識「所有資料保留、這次不做分享」選後者，原文改正。）
- **第二階段設計點（這次不做）**：共編時對方看得到事件，但 `event_categories` 的 RLS 只給擁有者，對方會拿不到分類顏色。屆時要讓分類跟著事件的可見度一起開放，或在事件上冗存顏色。
- **全天和多天事件改用 `date` 存**，有時段的事件繼續用 `timestamptz`。時區固定為 `Asia/Taipei`。

### 6.2 Schema 變更（全部只做加法）

```sql
-- 分類
create table public.event_categories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  color text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  system_key text check (system_key in ('camping','baseball','work','family','personal')),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (owner_id, system_key),
  unique (owner_id, name)
);
-- RLS：owner_id = auth.uid() 才能 select/insert/update/delete；
-- system_key in ('camping','baseball') 的列禁止 delete（policy 條件）
-- 簡化（§17 S6）：不加「禁止變更 system_key」的 trigger；前端本來就不會修改 system_key

alter table public.calendar_events
  add column category_id uuid references public.event_categories(id) on delete set null,
  add column start_date date,
  add column end_date date,
  add column visibility text not null default 'private' check (visibility in ('private','shared')),
  add column cpbl_game_id uuid references public.cpbl_schedule(id) on delete set null;
-- 簡化（§17 S5）：不加 check constraint，也不加補 start_date 的 trigger，不寫收尾 migration。
-- 舊前端在 M3 合併前寫入的全天事件 start_date 會是 null，由讀取端退回 start_time 的台北日期處理，
-- M3 合併後再執行一次「對齊 SQL」（見下方寫入規則）。

alter table public.camping_trips
  add column visibility text not null default 'private' check (visibility in ('private','shared'));  -- M3
alter table public.camping_trips
  add column merged_into_id bigint references public.camping_trips(id);  -- M1（計畫 Task 1.6），M2 軟合併用

alter table public.profiles
  add column show_cpbl boolean not null default true;

-- 以下全部在 M1（計畫 Task 1.6）
alter table public.campsites
  add column google_place_id text unique,
  add column address text,
  add column google_maps_url text,
  add column business_status text check (business_status in ('open','temporarily_closed','closed')),
  add column field_sources jsonb not null default '{}'::jsonb,
  add column merged_into_id bigint references public.campsites(id);
```
簡化（§17 S1）：**不建 `merge_log` 表**，也不寫 `merge_campsites`、`merge_trips`、`unmerge` 這些 DB function。合併的回復手段是「合併前的完整備份」（§8）。

`field_sources` 的格式如下：
```
{ "<欄位名>": { "source": "places"|"elevation"|"gemini"|"manual",
                "confidence": "high"|"low"|"none",
                "urls": string[], "confirmed": boolean } }
```
被捨棄的方案：UI 設計師提出另開一個 `unverified_fields` 欄位。`field_sources` 已經涵蓋這個資訊，不需要兩個欄位。

**全天事件的寫入與讀取規則（簡化（§17 S5），依新版需求設計，不為舊前端相容）**
- 寫入：新版前端寫入全天事件時，填 `start_date`、`end_date`（真正的資料），`start_time`、`end_time` 因為是既有的 NOT NULL 欄位而必須有值，一律寫 `start_date 00:00 +08:00`、`end_date 00:00 +08:00`，新版前端不讀它們。被捨棄的方案：沿用 `EventModal.vue:116-118` 的「存當地中午」。那個慣例只是為了讓舊前端用 `toISOString()` 讀時不偏移；舊前端在 M3 合併後就刪除，不再需要（Rule 7：選新版模型，舊慣例隨 EventModal 一起清掉）。接受的影響：M3 QA 期間在預覽站建立的全天事件，在正式站舊前端看會早一天，M3 合併後就消失。
- 讀取：`is_all_day` 為 true 時看 `start_date`、`end_date`；**為 null 時退回 `start_time`、`end_time` 的台北日期**。這一條**保留**，理由是資料正確性而不是相容：任何沒填 `start_date` 的寫入路徑（M3 合併前正式站舊前端新增的事件、日後在 SQL Editor 手動新增的事件）都不能讓事件從畫面消失。成本是純函式裡的一個分支。
- 對齊 SQL（M3 合併後由使用者執行一次）：`update calendar_events set start_date = (start_time at time zone 'Asia/Taipei')::date, end_date = (end_time at time zone 'Asia/Taipei')::date where is_all_day;`。用途：M3 migration 套用後到 M3 合併前，若在正式站舊前端改過全天事件的日期，`start_date` 會停在舊值，這條 SQL 依 `start_time` 重算。對新版寫入的事件結果不變（`00:00 +08:00` 的台北日期就是 `start_date`），可以重複執行。

**資料回填（同一支 migration）**
1. 為每個 profile 建立 5 個預設分類，`sort_order` 依序為 0 到 4。
2. `is_all_day = true` 的事件：`start_date = (start_time at time zone 'Asia/Taipei')::date`，`end_date = (end_time at time zone 'Asia/Taipei')::date`。
3. `color like 'cpbl:%'` 的事件設為棒球分類，並用「同一天、隊名相符」回填 `cpbl_game_id`，找不到就留 null。其他事件一律設為「個人」分類（PM 決定，不用顏色去猜分類）。
4. migration 結尾印出回填報告（`select` 每筆事件的 id、title、舊 color、新分類、start_date），讓使用者對照。

**保留但不再使用的欄位**（「所有資料保留」）：`calendar_events.color`、`event_type`；`campsites.is_verified`、`booking_platform`、`booking_platform_url`、`booking_last_available_date`、`booking_scraped_at`、`booking_available_until`；`profiles.onboarding_completed_at`；以及所有表的 `family_id` 和 `families` 表。**這次不刪除任何欄位或表**。
- **注意（審查 L4）**：`calendar_events.family_id` 對 `families` 是 `on delete cascade`。保留 `families` 的期間，**禁止 drop 或 delete `families` 的任何列**，否則事件會被連帶刪除。
- **Rollback（§14 Q10 使用者已同意）**：每支新 migration 尾端附 `-- rollback:` 註解區，只 drop 本次新增的欄位、表、function、policy，回填改用「設回 null」復原。註解區不會自動執行，只在使用者決定回復時手動跑。

**中職賽程：「清除整年」改成「重新同步整年」（§14 Q11 決定 (b)）**：`cpbl_schedule` 的唯一鍵是 `(game_sno, game_date)`，延賽改期會多出一列，舊日期那列不會消失。現有「清除整年」會讓使用者事件的 `cpbl_game_id` 被 set null，同一場比賽就會在疊加圖層和使用者事件各出現一次，所以刪除。改成「重新同步整年」：逐月抓官方整年賽程並 upsert，接著只刪除「該年度、官方已經不存在、**而且沒有被任何 `calendar_events.cpbl_game_id` 綁定**」的列。任何一個月份抓取失敗，就整個中止、不刪任何列（不能依不完整的資料刪除）。`cpbl_schedule` 是外部參考資料，不算使用者資料，這是「不刪除資料」規則的唯一例外。因為要檢查 `cpbl_game_id`，這個功能在 M3（欄位建立後）才做；M1 的 `/api/cpbl-sync` 只做單月 upsert。

### 6.3 家庭共享移除（PM 決定：只拆前端，不動資料庫）
- 前端移除家庭的 UI 和寫入操作。`tripQueries.fetchAll` 的查詢在 M1 改成 `user_id = me`，但**前提是**先跑唯讀檢查（計畫 Task 1.3），確認改查詢後不會少看到任何一筆。簡化（§17 S7）：檢查改成使用者在 SQL Editor 執行的唯讀 SQL，不寫腳本。條件用 `family_id = <我的 family_id> and <owner> is distinct from <我的 user id>`（不用 `<>`，因為它遇到 null 不會被計入；用 `is distinct from` 時，owner 為 null 的舊資料也會被算進來），三張表都要是 0 才能改查詢。這就是「舊查詢有、新查詢沒有」的完整集合：舊查詢在有家庭時看 `family_id`、沒有家庭時看 owner，新查詢只看 owner。使用者沒有家庭時兩者相同，不必檢查。有任何差異就停下來問使用者（§14 Q2）。
- 家庭相關的 policy、RPC、欄位和表**全部保留**，等之後做分享功能時，再決定沿用還是 drop。被捨棄的方案：架構師提的第 6 階段不可逆清理。理由：共識是「所有資料保留」，而且分享功能還沒設計。

### 6.4 型別
- `npm run db:types` 會執行 `supabase gen types typescript --project-id <project ref> --schema public > src/types/supabase.ts`（project ref 本來就出現在公開的 `VITE_SUPABASE_URL` 裡，不是秘密；只需要 `supabase login`，不需要 Docker 或 `supabase link`，§17 S3）。
- `src/types/database.ts` 只放衍生型別（`Tables<'campsites'>` 等），**保留現有的 export 名稱**。JSONB 欄位（`amenities`、`capacity_zones`、`field_sources`）手動收窄型別。
- `createClient<Database>()` 套用產生的型別。`any` 不一次清完，每個模組改到哪就清到哪。PM 決定（審查）：套用後如果一次冒出大量型別錯誤，允許在呼叫端加暫時的型別轉換（一律加註解 `// TODO(types): M5`），並在 PR 描述記錄新增的數量，M5 再清。
- `api/**` 和 `scripts/**` 加進型別檢查：新增 `tsconfig.api.json`（`types: ["node"]`），由 `tsconfig.json` 的 references 引用。

### 6.5 營區比對規則（新增入口、找新營區、去重腳本共用 `src/utils/campsiteMatch.ts`）

名稱正規化：去掉空白和全形空白，全形英數轉半形，「台」轉成「臺」，括號內容移除，再移除通用字，最後轉小寫。通用字（PM 決定（審查）補齊，長的先移除）：「露營區、露營場、露營、營地、營區、營場、農場、休閒、園區、山莊、莊園、camping、camp」。

「名稱相似」= 正規化名稱互相包含或編輯距離 ≤ 2；**正規化後是空字串的名稱一律不算相似**（例如只叫「露營區」）。

| 規則 | 結果 |
|---|---|
| `google_place_id` 相同 | `same_place`，確定已收錄 |
| 距離 < 300 m，且名稱相似 | `likely`，視為已收錄並提示 |
| 距離 < 300 m，但名稱不相似 | `nearby`，提示「附近已有 XX」，不自動排除 |
| 正規化名稱**完全相同**，距離 300 m–2 km | `likely`（PM 決定（審查）：舊營區座標品質不可靠，寧可提示讓使用者判斷） |
| 任一方沒有座標，正規化名稱相同，且鄉鎮相同 | `likely` |
| 名稱相同，但距離 > 2 km | 不是重複 |
| 名稱相似但不相同，距離 ≥ 300 m | 不是重複 |

- **括號（入口比對專用）**：兩筆的括號內容都存在而且不同（例如「雲頂（A區）」和「雲頂（B區）」），`likely` 降級成 `nearby`。
- **去重報告額外列出（只列不併）**：正規化名稱相同而且鄉鎮相同，不論距離（因為舊營區的座標是 `scripts/geocode-campsites.ts` 用名稱查的，可能落在同名的其他地點）。

已經被合併的營區（`merged_into_id` 不為 null）不參與比對。PM 決定採 300 m 閾值（露營專家和架構師），被捨棄的是 UI 設計師的 200 m。

### 6.6 下一趟露營的挑選規則（`src/utils/nextTrip.ts`）
- 排除 `status = 'cancelled'`。
- 行程區間是 `trip_date` 到 `trip_date + duration_days - 1`。`duration_days` 是天數（含頭尾），沿用 `CalendarView.vue:137` 的語意。
- 優先順序：(1) 今天是出發前一天而且有夜衝的行程；(2) 正在進行中的行程（區間包含今天）；(3) `trip_date` 大於今天且最近的行程。同一天有多筆時，取 id 最小的。
- 和現有行為的差異：(2) 是新增的。現有程式只看 `trip_date >= today`，行程第二天卡片就會跳到下一趟。
- 行事曆顯示時，有夜衝的行程區間從 `trip_date - 1` 開始（§5.4）；`pickNextTrip` 的 (1) 已經涵蓋同一件事。

### 6.7 前端架構
- **State**：繼續用 composable，不導入 Pinia。需要共用的資料（`useTrips`、`useUserProfile`、`useEventCategories`、`useCalendarEvents`）改成模組層級 singleton，沿用 `useNotification.ts` 的寫法，並提供 `load()` 和 `reset()`。PM 決定（審查）：`reset()` 掛在 `supabase.auth.onAuthStateChange` 的 `SIGNED_OUT` 事件，因為現在 `SettingsView.vue:522` 直接呼叫 `signOut()`，不一定經過 `App.vue` 的 `handleLogout`。`App.vue` 透過 `<router-view>` 傳十幾個 props 的作法，改到哪個頁面就拿掉哪個（M3 先處理首頁，M5 處理其他頁）。
- **資料存取**：新寫或重寫的 code 一律經過 `src/services/db/*.ts`，延續 `supabaseQueries.ts` 的 `xxxQueries` 物件模式。component 不直接 import supabase。伺服器 API 的呼叫統一放在 `src/services/api.ts`，會自動帶上 Bearer token。
- **目錄（PM 決定）**：沿用 `src/components/<子資料夾>`（現有 `charts/` 的慣例），新增 `calendar/`、`campsite/`、`trip/`、`settings/`。純函式放 `src/utils/`。**不開 `src/features/`**。頁面元件維持現有位置，不搬家（Rule 3）。

---

## 7. 伺服器端 API 與費用

### 7.1 共用守門 `api/_lib/auth.ts`
`requireUser(req)` 會讀取 `Authorization: Bearer <supabase access token>`，用 `supabase.auth.getUser(token)` 驗證。沒帶 token 或 token 無效回 401。簡化（§17 S4）：**不做 `ALLOWED_USER_IDS` 白名單**，改由使用者在 Supabase → Authentication 關閉「允許新使用者註冊」，並確認 Users 列表裡只有自己（或信任的家人）。這樣任何有效的 JWT 都屬於既有帳號；順帶也擋住陌生 Google 帳號註冊後寫入共用的 `campsites` 表。之後若要開放老婆註冊，先在後台手動邀請，或屆時再加白名單。所有下游 key 都用 header 傳遞（Gemini 用 `x-goog-api-key`，Places 用 `X-Goog-Api-Key`），不放進 URL。PM 決定（審查）：既有的 `api/camping-info.ts` 在 M1 就套上 `requireUser`（前端改用 `apiPost` 帶 token），不等到 M4 才刪。

**`api/` 的工程規則（PM 決定（審查））**
- 只有 `api/` 底下**不以底線開頭**的檔案會被 Vercel 部署成 function。所以**測試檔一律放在 `api/_lib/`**，endpoint 檔案只做薄薄一層（解析 body → 呼叫 `_lib` → 回應），邏輯和測試都在 `_lib`。
- `package.json` 是 `"type": "module"`，`api/` 的相對 import **一律寫 `.js` 副檔名**（例如 `import { requireUser } from './_lib/auth.js'`）。
- 被 `api/` import 的 `src/` 檔案（`src/utils/campsiteMatch.ts`、`src/utils/campsiteName.ts`、`src/constants/campsiteOptions.ts`、`src/utils/googleMaps.ts` 中被用到的純函式）必須是純 TS：不得使用 DOM、`window`、`import.meta.env` 或 Vite 專屬 API，也不得 import supabase client。
- 本機不跑 `/api`（Rule 2）：API 邏輯靠 Vitest（mock fetch）驗證，整合驗證在 Vercel 預覽網址做。需要時使用者可以自行 `vercel dev`，但不列為必要。
- `vite.config.ts` 的 `'/api/cpbl'` dev proxy 是前綴比對，會攔截 `/api/cpbl-sync`，在 Task 1.5 刪除（同步已經改到伺服器端，這個 proxy 不再需要）。

### 7.2 端點（共 4 個 function，`api/_lib/` 不算 function）

| 端點 | 輸入 | 做什麼 | 下游 |
|---|---|---|---|
| `POST /api/places-search` | `{ query }` | 名稱 → 最多 5 個候選 `{placeId,name,address,lat,lng}` | Places Text Search (New)，field mask `places.id,places.displayName,places.formattedAddress,places.location` |
| `POST /api/campsite-draft` | `{ mapsUrl, resolveOnly: true }` → `{ candidates: PlaceLite[], preselectId?: string }`；`{ placeId, skipAi?: boolean }` → 草稿 | resolveOnly：短網址轉址（**只允許 google 網域，防 SSRF**）→ 解析 → Text Search 列候選（§5.7，不呼叫 Gemini）。placeId：Place Details → 海拔 → Gemini（`skipAi` 時略過）→ 回傳草稿 | Places Details field mask `id,displayName,formattedAddress,location,addressComponents,googleMapsUri,businessStatus,nationalPhoneNumber,websiteUri`；Open-Meteo elevation；Gemini＋`google_search` tool |
| `POST /api/campsite-discover` | `{ city, district?, altitudeMin?, keywords[], freeText? }` | Text Search「露營 縣市 鄉鎮 關鍵字」最多 2 頁 → 排除歇業和已收錄 → 一次查海拔並篩選 | Places Text Search（`places.id,displayName,formattedAddress,location,googleMapsUri,businessStatus,primaryTypeDisplayName`，`rating,userRatingCount` 依 §7.3 查證結果決定是否加）；Open-Meteo |
| `POST /api/cpbl-sync` | `{ year, month }`（M1）；`{ year, resyncYear: true }`（M3 加入） | 伺服器端抓 cpbl.com.tw（不經過 corsproxy），再用 service role upsert；`resyncYear` 依 §6.2 重新同步整年 | cpbl.com.tw |

- Runtime 用 Node，`maxDuration` 設 60 秒（實作時依 Vercel 當下的 Hobby 上限確認）。
- Gemini 模型用環境變數 `GEMINI_MODEL`，預設是固定版本名稱（實作時查官方文件，選一個非 `-latest` 的 Flash 版本）。用結構化輸出限制欄位，每個欄位回傳 `{ value, confidence, sources[] }`。標籤只能從 `src/constants/campsiteOptions.ts` 的固定選項中挑。
- 草稿的名稱：保留 Places 的 `displayName` 原文，另外提供 `cleanCampsiteName()` 的結果當作預設值，規則是砍掉第一個 `｜`、`|`、`-` 之後的行銷字。使用者可以再改。
- **CPBL 同步（PM 決定）**：由設定頁按鈕觸發 `/api/cpbl-sync`，沿用現在手動觸發的行為。被捨棄的方案：架構師提的 Vercel Cron。理由是 cron 需要額外的 `CRON_SECRET` 和設定，賽程每季同步一兩次就夠了。
- 刪除 `api/camping-info.ts` 和 `src/services/aiService.ts`。前端完全移除 Google Maps JS（`index.html` 的 script、`vite.config.ts` 的 html transform、`GooglePlaceSearch.vue`、`types/google-maps.d.ts`、`@types/google.maps`）。設定頁的出發地改用 `/api/places-search`。

### 7.3 費用（**數字依專家既有知識，實作 M4 前必須重查官方價目**）
- Places API (New)：每個 SKU 每月有免費額度，一人每月幾十次，預期 0 元。**PM 修正（審查）**：原文「只用 Essentials 和 Pro 欄位」可能不正確。兩位審查者都認為 `nationalPhoneNumber`、`websiteUri`（Details）和 `rating`、`userRatingCount`（discover）屬於 Enterprise 等級，免費額度較低（**未查證**）。M4 前查價目時逐欄核對，把每個 field mask 實際落在哪個 SKU、每月免費額度多少，寫回本節。取捨規則：Details 的電話和網站保留（每次新增營區才呼叫一次）；discover 的評分如果讓搜尋落入 Enterprise，就拿掉。
- Gemini Flash＋Google Search grounding：用免費層。**PM 決定接受免費層的資料使用條款**，理由是查詢內容只有公開的營區名稱，不含個人資料。
- Open-Meteo、OSRM 公開伺服器、Cloudinary 免費層、Vercel Hobby：都是 0 元。
- 防止爆量：API 一律要有效 JWT（Supabase 已關閉新註冊，§7.1），加上使用者在 Google Cloud 設定每日 quota 和 US$1 budget alert。**PM 決定不建 `api_usage` 計數表**（Rule 2）。

---

## 8. 資料清理流程（M2，腳本為主，不做 app 內介面）

簡化（§17 S1）：流程只有五步：**備份（驗證可讀）→ 報告 → 使用者確認 → 合併 → 出問題就從備份整體還原**。不建 `merge_log`、不做 `unmerge`、不做還原演練、不寫 DB function。

0. **先堵住來源**：M0 的 Task 0.8 已經停止 TripModal 自動新建營區；M0 也刪除了會刪掉未審核營區的 `scripts/cleanup-empty-city.ts`。M2 開始前這兩件必須已在正式站上線。
1. **備份** `scripts/backup/backup-all.ts`（計畫 Task 1.0，M1 最前面就建好，之後每次動正式庫前都跑）：用 service role 把所有 public 表匯出成 JSON，放到 **repo 外**的 `~/camping-life-backups/<YYYYMMDD-HHmm>/`（目錄權限 `chmod 700`）。腳本寫完檔案後**自己驗證**：重新讀回每個檔案、`JSON.parse` 成功、筆數和線上筆數相同，才 exit 0。Supabase 免費方案沒有每日備份和時間點還原，所以這份備份就是唯一的回復手段。
   - **驗證可讀＝實際跑一次還原的 dry-run**：`scripts/backup/restore.ts <備份目錄> --tables campsites,camping_trips,trip_photos[,其他外鍵表]` 預設只比對、不寫入，印出「備份和線上不同的列數」。合併前剛備份完執行，結果必須是 0（代表備份讀得回來，而且還原腳本能正確比對）。
2. **列清單** `scripts/dedupe/report.ts`（唯讀）：用 `campsiteMatch` 分群，加上「電話相同」也分到同一群，以及 §6.5 的「同名同鄉鎮不論距離」。另外找重複的行程（`trip_date` 相同，且 `campsite_id` 或正規化的 `campsite_name` 相同）。輸出 `report.html`（手機可讀）和 `decisions.json` 範本。每群列出各筆的欄位、引用的行程數、照片數，並預設保留：引用行程最多 > 有照片 > 有座標 > 非空欄位最多 > id 最小。`is_verified=false` 而且幾乎是空白的營區（TripModal 自動建立的）也會出現在報告裡。同一園區的不同分區（名稱主幹相同、距離 < 500 m）標註「可能是同園區不同營區，建議不合併」。
   - 信心等級：`high` = 群內有 `same_place`，或 `likely` 而且距離 < 300 m；`medium` = 只靠「沒座標同名同鄉鎮」或「同名 300 m–2 km」；`low` = 只靠電話相同，或「同名同鄉鎮、距離 > 2 km」。
   - 「名稱主幹」= 正規化前先移除括號內容和結尾的分區字樣（`[A-Za-z0-9一二三四五六七八九十]+區$`）再正規化。
3. **使用者確認**：使用者看完報告，在對話裡告訴 Claude 每一群的決定（合併／不是重複／之後再說），也可以自己改 `decisions.json`。格式：
   ```json
   { "campsites": [ { "groupId": 3, "action": "merge", "keepId": 12, "dropIds": [40, 41] } ],
     "trips":     [ { "groupId": 1, "action": "merge", "keepId": 88, "dropIds": [90] } ] }
   ```
4. **合併** `scripts/dedupe/apply.ts`：預設 dry-run，列出會改動的每一筆。加上 `--apply` 時**由使用者本人執行**，而且必須同時給 `--backup <目錄>`（當天剛做、還原 dry-run 為 0 的那份），腳本開頭印出萬一失敗要用的還原指令。前提：含「前端隱藏已合併資料」的 M2 PR 已經合併並部署到正式站。用 service role 逐群執行：
   - **營區群**：所有參照 `campsites.id` 的外鍵（清單由計畫 Task 1.1 從 `pg_constraint` 查出，寫成腳本內的常數）從 drop 改指向 keep；keep 的欄位是 null、空字串或空陣列時，依 `dropIds` 順序取第一個非空值補上（不補 `id, created_at, created_by, updated_at, is_verified, merged_into_id, google_place_id, field_sources`）；drop 設 `merged_into_id = keepId`。不做 `google_place_id` 搬移：M2 時舊營區都還沒有 place_id（M4 才開始寫入）。
   - **行程群**：`trip_photos.trip_id` 以及其他參照 `camping_trips.id` 的外鍵改指向 keep；drop 設 `camping_trips.merged_into_id = keepId`。被合併的行程**不刪除**。前端查詢行程一律加上 `merged_into_id is null`。
   - 先處理全部營區群，再處理行程群。**任何一步失敗就停止**，印出已完成的群組和還原指令。
5. **合併後驗證**（腳本結尾自動跑，使用者在正式站再看一次）：各表總筆數和合併前相同（沒有刪除任何列）；沒有任何行程指向 `merged_into_id is not null` 的營區；照片總數不變。
6. **出問題就整體還原**：`restore.ts <備份目錄> --tables campsites,camping_trips,trip_photos[,其他外鍵表] --apply`，把這幾張表依備份內容以 id upsert 回去（依外鍵順序：營區 → 行程 → 照片）。因為合併不刪除任何列，upsert 就能把所有被改過的列（外鍵、補值、`merged_into_id`）恢復成備份當下的樣子；備份之後新增的列不在備份裡，不受影響。接受的風險見 §17 S1。
7. **行程上的營區名稱快照不改**（PM 決定，保留當時的紀錄）。
8. **防止再發生**：TripModal 不再自動建立營區（§5.6，M0）；`google_place_id` 設 unique；新增營區的入口做比對（§5.7）；`scripts/cleanup-all-campsites.ts`、`scripts/cleanup-empty-city.ts` 刪除（M0）。

## 9. 安全修正

| 問題 | 修正 | 模組 |
|---|---|---|
| 前端 Gemini 直連 | 刪除 `fetchFromGeminiDirectly` 和兩處 `VITE_GEMINI_API_KEY` 分支（M0）；M4 刪除整支 aiService。使用者 rotate key，並刪掉 Vercel 上的 `VITE_GEMINI_API_KEY` | M0 |
| 瀏覽器端 Google Maps key | 移除 Maps JS，改走伺服器端（§7.2）。使用者停用舊的瀏覽器 key | M4 |
| `cpbl_schedule` 任何人可寫 | drop 兩條舊 policy，只建 `authenticated` select；寫入只靠 service_role。**順序：含 `/api/cpbl-sync` 的 PR 合併、正式站部署完成之後，使用者才套用 RLS migration**（否則正式站舊前端的同步按鈕會先壞） | M1 |
| `/api/camping-info` 沒有守門 | M1 先套 `requireUser`，M4 整支刪除 | M1 |
| 瀏覽器端 Maps key 在 M4 前仍存在 | 使用者在 M0 前確認這把 key 已設定 HTTP referrer 限制（只允許正式和預覽網域） | M0 前 |
| 本機 secrets | 腳本從 `.env.local` 讀 service role key（`.gitignore` 已含 `.env*`）；Task 0.2 補上 `!.env.example`，否則 `.env.example` 也會被忽略。agent **不持有** service role key，所有用到它的腳本由使用者執行 | M0 |
| corsproxy.io | 同步改到伺服器端 | M1 |
| `exec_sql` RPC（如果存在） | baseline 時查證。如果存在，並且 authenticated 或 anon 有執行權限，就 drop | M1 |
| API 被外人刷用 | `requireUser`（有效 JWT）＋使用者在 Supabase 關閉新使用者註冊（§7.1，簡化 §17 S4） | M1 起 |
| 陌生 Google 帳號可以註冊並寫入共用的 `campsites` | 同上：關閉新使用者註冊 | M1 前 |
| RLS 不在版控 | M1 baseline 用 `pg_dump --schema-only`（保留權限）把 public 的表、RLS policy、GRANT 進版控 | M1 |
| 危險腳本 | 刪除 `cleanup-all-campsites.ts`、`add-capacity-column.ts`、`cleanup-empty-city.ts`（會刪除所有 `is_verified=false` 的營區，PM 查證） | M0 |
| 預覽站登入被導回正式站 | Supabase Redirect URLs 加入預覽網址 wildcard；`redirectTo` 用 `window.location.origin` | M0 |

## 10. 模組切分與順序

```
M0 止血＋砍功能＋停止自動新建營區＋測試基礎
  → M1 備份腳本＋Schema 基線＋型別＋RLS＋CPBL 伺服器同步
  → M2 重複清理（腳本）
  → M3 行事曆（核心）
  → M4 新增營區（貼連結/名稱 → 候選 → 草稿）→ M4b 找新營區
  → M5 其他功能適度重構（5-1 設定、5-2 行程、5-3 營地圖鑑、5-4 統計/裝備/照片）
```
**PM 決定**：採用資深工程師的模組順序；migration 只做加法。被捨棄的方案：架構師的「第 6 階段不可逆清理」，這次不做（§6.3）。簡化（§17 S5）：不再有「M5 結束後才套用的收尾 migration」。

**PM 決定（審查）：全部依序執行，取消「M2 ∥ M3 平行」。** 理由：M3 的 migration 需要 M1 的備份腳本、兩者都改 `supabaseQueries.ts` 和 `useTrips`、migration 檔名時間戳要和實際套用順序一致。一人專案平行的收益很小。

**分支與 PR（PM 決定（審查））**：照共識在 `redesign/life-calendar` 開發。每個模組（M5 每個子項）完成後，從 `redesign/life-calendar` 開 PR 到 `main`，Vercel 會為這個 PR 產生預覽網址；使用者確認後用 **merge commit**（不 squash）合併，再把 `main` fast-forward 回 `redesign/life-calendar`，接著做下一個模組。同一時間只有一個開著的模組 PR。正式站永遠是 `main`，所以「正式站舊前端」指的就是上一個已合併模組的狀態。推送和開 PR 用私人帳號 `tony798252003-cell`（origin 屬於它），帳號切換方式依使用者既有設定。

**migration 套用方式與順序（簡化（§17 S3））**：使用者在 Supabase SQL Editor 貼上 migration 檔內容執行，不使用 `supabase db push`、不追蹤 `schema_migrations`。檔名時間戳 = 實際套用順序；每支套用後，在該 PR 描述勾選「已套用到正式庫（日期）」，這就是唯一的套用紀錄。每支套用前先跑備份（計畫 Task 1.0）。含新欄位的 migration 先套用、再合併使用它的前端；含「收緊權限」的 migration（cpbl RLS）反過來，前端先上線、再套用。

## 11. 每個模組的完成標準

| 模組 | 完成標準（全部達成才算完成） |
|---|---|
| **M0** | `git diff main -- package.json` 不含 ajv；build 後 `grep -rE "generativelanguage\|VITE_GEMINI" dist/` 沒有結果；`npm test`、`npm run typecheck`、`npm run build` 全部通過；/builder 導回首頁；新帳號登入不會跳 onboarding；設定頁沒有家庭、開發工具、批次 GPS；圖鑑沒有匯入和審核按鈕；首頁沒有回憶小工具；**使用者帳號的行程總數和改版前相同**；konva、vue-konva、xlsx 不在 package.json；**TripModal 新增露營時必須選到營區才能存檔，不會再自動建立營區**（找不到時可在同一畫面用 CampsiteEditModal 新增後自動選回）；`cleanup-empty-city.ts` 已刪除；使用者在預覽網址確認 |
| **M1** | `backup-all.ts`、`restore.ts` 存在；第一次備份在任何 migration 之前完成，自我驗證 exit 0，`restore.ts` dry-run 顯示 0 筆差異；`supabase/migrations/20261017000000_baseline.sql`（含 RLS 和權限）進版控；`npm run typecheck` 涵蓋 `api/**`、`scripts/**`；`/api/camping-info` 不帶 token 回 401；`src/types/supabase.ts` 由 `npm run db:types` 產生；`npm run typecheck` 通過，`any` 數量記錄改版前後；cpbl RLS migration 上線後，用一般 JWT `insert` 會被拒絕（curl 驗證）；設定頁按同步仍然成功；家庭資料檢查 SQL 有結果並回報給使用者；Supabase 已關閉新使用者註冊；所有頁面行為不變；每支 migration 的套用狀態記在 PR 描述；使用者確認 |
| **M2** | 合併前的新備份存在於 repo 外，自我驗證通過，`restore.ts` dry-run 為 0；M2 PR（含前端隱藏已合併資料）已在正式站上線；報告 HTML 給使用者看過；決定寫進 `decisions.json`；dry-run 輸出經使用者同意；使用者本人 `--apply`；合併後驗證的三項全部通過；圖鑑看不到被合併的營區；舊行程仍然能打開 |
| **M3** | 首頁：月曆＋列表＋置頂卡（有天氣、車程、帳篷小圖）；全天單日、跨週多天、跨月、有時段的事件，在月、週、日三個檢視都正確；分類可以新增、改名、改色，月曆顏色即時更新，露營和棒球分類不能刪除；桃猿開關即時生效，重新整理後保持；假日標示正常；舊事件日期沒有偏移（和回填報告對照）；`start_date` 為 null 的全天事件仍正確顯示（退回 `start_time`）；天氣溫度為海拔校正後的數字並標示「已依海拔校正」，夜溫警告用校正值；「重新同步整年」只刪除官方已不存在而且沒被綁定的比賽；把手機時區改成 UTC 再看一次，結果相同；夜衝行程在前一天有標示；FAB sheet 選露營會開 TripModal 並帶入日期；Vitest 全部通過；QA 截圖附在 PR；使用者確認；M3 合併後使用者已執行對齊 SQL（§6.2） |
| **M4** | 貼短網址、完整網址、無效網址都有正確結果或友善錯誤；貼連結和名稱搜尋都先列候選，使用者按「產生草稿」前不呼叫 Gemini（Network 驗證）；草稿每個欄位都有來源標示，AI 欄位附來源連結，七個高風險欄位一律 ⚠️；「跳過 AI」可以只存基本資料；不存檔直接關閉，DB 不會多一筆；貼已收錄營區的連結會提示已存在；前端 bundle 和 `index.html` 都沒有 `maps.googleapis.com`、`AIza`；API 沒帶 token 回 401；TripModal 必須選營區，「＋新增營區」改開新流程的 sheet；使用者確認 |
| **M4b** | 條件搜尋只列出未收錄的營區，並顯示排除數；海拔篩選生效；設施條件標示「不保證有」；產生草稿走 M4 的流程，回到列表時狀態保留；一次搜尋最多 2 頁；使用者確認 |
| **M5-x** | 各畫面和改版前截圖一致（基準＝該 PR 開工前從正式站截的圖，含帳篷小圖、台灣地圖、裝備 ROI、照片上傳）；目標檔案行數下降；該範圍內的 `supabase.from` 都移到 services；`any` 數量下降；使用者確認 |

## 12. 需要使用者手動做的事

| 時機 | 動作 |
|---|---|
| M0 前 | Google AI Studio：rotate Gemini key。Vercel：刪除 `VITE_GEMINI_API_KEY`，確認 `GEMINI_API_KEY` 有設在 Production 和 Preview。Google Cloud：確認瀏覽器 Maps key 已設定 HTTP referrer 限制 |
| M0 | Supabase → Authentication → URL Configuration：Redirect URLs 加入 `https://*-<vercel team>.vercel.app/**`。Vercel → Deployment Protection：關閉預覽保護，或提供 Protection Bypass token 給 QA（否則 QA 的 curl 會被擋在 Vercel 登入頁） |
| 每個模組 QA 前 | 在 Chrome 用 Google 登入預覽網址，並讓 QA 透過 claude-in-chrome 接上這個已登入的瀏覽器（QA 沒辦法自己做 Google OAuth）；需要 JWT 的 curl 驗證由 QA 從該瀏覽器 localStorage 的 `sb-*-auth-token` 取得 |
| M1 前 | Supabase → Authentication：關閉「允許新使用者註冊」，並在 Users 列表確認只有自己（有其他帳號時告訴 PM）。`brew install supabase/tap/supabase libpq`，確認 `pg_dump --version` 主版本和 Supabase 的 Postgres 主版本相同（只有 baseline dump 會用到）；`supabase login`；在 repo 根目錄建立 `.env.local` 放 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`DB_URL`（已被 gitignore） |
| M1 起，**每次動正式庫前**（套用 migration、合併、還原） | 執行 `npx tsx scripts/backup/backup-all.ts`（一個指令，含自我驗證） |
| M1 | 執行 baseline dump 和計畫提供的唯讀查詢（含家庭資料檢查 SQL），結果貼回；Vercel 新增 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`（**不加** `VITE_` 前綴）；在 SQL Editor 套用 migration；cpbl RLS migration 要等 Task 1.5 的 PR 在正式站部署完成之後才套用 |
| M2 | M2 PR 合併後：備份並跑 `restore.ts` dry-run（應為 0）；看報告並做決定；本人執行 `apply.ts --apply --backup <目錄>`；出問題時執行 `restore.ts … --apply` |
| M3 | 正式庫套用 M3 的 migration；對照回填報告；M3 合併後執行一次對齊 SQL（§6.2） |
| M4 前 | Google Cloud：伺服器 key 啟用 Places API (New)，限制只能呼叫 Places API (New) 和 Generative Language API；設定 budget alert（US$1）和每日 quota；Vercel 新增 `GOOGLE_PLACES_SERVER_KEY`、`GEMINI_MODEL` |
| M4 後 | 停用舊的瀏覽器 Maps key，刪除 Vercel 上的 `VITE_GOOGLE_MAPS_API_KEY` |
| 每個模組 | 在 Vercel 預覽網址確認後，同意合併；QA 在畫面上刪不掉的 `[QA]` 測試資料，由使用者在 table editor 刪除 |

## 13. PM 代為決定的事項

| # | 決定 | 理由 | 被捨棄的方案 |
|---|---|---|---|
| D1 | 模組順序 M0→M1→M2→M3→M4→M4b→M5，全部依序（審查後取消 M2∥M3） | M0 先砍功能，可以讓後面需要處理的程式碼面積少 3000 行以上；cpbl RLS 和伺服器同步要同一批上線；依序才能讓 migration 順序和備份前置條件成立 | 架構師的 6 階段順序；M2∥M3 平行 |
| D2 | 露營行程不複製成事件，行事曆用虛擬事件顯示 | 一趟露營只輸入一次；統計、天氣、照片完全不受影響 | 統一成一張表 |
| D3 | 共編預留只做 `visibility` 加既有的 owner 欄位，家庭的表和欄位全部保留但不使用 | 共識要求所有資料保留，分享功能還沒設計 | 沿用 families 實作 RLS（工程師）；drop families（架構師） |
| D4 | 全天事件新增 `start_date/end_date`；舊的 `timestamptz` 因為 NOT NULL 仍寫入 `00:00 +08:00`，但新版不讀（§17 S5 修訂） | 解決時區跨日問題；不為舊前端另做相容 | 直接改欄位型別；存當地中午 |
| D5 | 事件顏色跟著分類；舊事件除了 cpbl 以外全部歸到「個人」 | 用顏色猜分類不可靠，事件數量少，使用者看回填報告後可以自己改 | 依顏色推測分類 |
| D6 | 新增露營必須選已收錄的營區，移除自動新建營區，**提前到 M0**；不做「營地未定」（§14 Q5 使用者決定 B） | 這是重複資料的根源，晚移除就會在清理後繼續產生重複 | 允許只填名稱；等到 M4 才移除；營地未定 |
| D7 | 名稱候選用伺服器端 Text Search，按下按鈕才搜尋；前端完全移除 Maps JS | 符合「key 只在伺服器端」與「不自動猜」 | Autocomplete＋session token；保留瀏覽器 key |
| D8 | 找新營區的候選來源是 Places Text Search，Gemini 只在產生草稿時呼叫；不做車程半徑條件 | 便宜、結果穩定，有 place_id 可以比對 | 架構師的 Gemini 列候選 |
| D9 | `is_verified` 不再過濾，所有營區都顯示，名稱也不再鎖定；欄位保留 | 只有一個使用者，審核已經砍掉；殘缺資料由 M2 報告處理 | 維持隱藏 |
| D10 | 重複清理用腳本＋HTML 報告＋`decisions.json`，在對話中確認；軟合併用 `merged_into_id`；回復靠合併前備份整體還原（§17 S1 修訂）；行程上的名稱快照不改 | 只做一次，做成 app 介面是過度設計 | CSV（工程師）；app 內介面；`merge_log`＋`unmerge` |
| D11 | CPBL 繼續抓 cpbl.com.tw（改到伺服器端），由設定頁手動觸發 | 「不爬第三方」在共識中指的是露營網站；cron 是過度設計 | Vercel Cron；另找資料來源 |
| D12 | 底部 tab：行事曆/露營/(+)/營地/統計；設定維持從頭像進入；TripModal 維持 modal 形式；路由路徑沿用 | 改動最小，符合現有慣例 | `/trips/:id` 全頁；裝備放 tab |
| D13 | 置頂卡用精簡版；事件列表以月份為範圍 | 月曆不會被擠出畫面；邏輯簡單 | 大卡；無限捲動 |
| D14 | 目錄沿用 `components/<子資料夾>`；state 用 singleton composable，不用 Pinia | Rule 11 | `src/features/`；Pinia |
| D15 | 只加 Vitest＋`typecheck` script，不加 ESLint 和 CI；Vercel build 本身就是關卡 | Rule 2，共識只要求 Vitest | ESLint＋GitHub Actions |
| D16 | Gemini 用免費層；不建 API 用量表，用 JWT＋關閉新註冊＋Google quota 限制（§17 S4 修訂） | 查詢的是公開資料；費用接近 0 | 付費層；`api_usage` 表；`ALLOWED_USER_IDS` 白名單 |
| D17 | 營區只新增流程必要的欄位（place_id、address、maps_url、business_status、field_sources、merged_into_id）；選項常數統一到 `src/constants/campsiteOptions.ts` | 範圍控制；兩處重複定義的選項本來就會造成篩選結果不一致 | 露營專家的完整欄位擴充 |
| D18 | 連假清單統一用 `utils/holidays.ts`，`useTravelTime` 不再寫死 2026，補上 2027 年資料 | 寫死的清單 2027 年就會失效 | 維持寫死 |
| D19 | 刪除設定頁的「批次更新 GPS」；保留 `scripts/geocode-campsites.ts` 作為維運腳本 | 一次性的維運工具不該放在 UI 上 | 保留在 UI |
| D20 | 保留 `SystemAssetManager` 和 `is_admin`，只用於帳篷圖庫 | 小帳篷圖依賴它 | 隨審核功能一起刪除 |
| D21（審查，§17 S2 修訂） | 備份移到 M1 最前面（Task 1.0），每次動正式庫前都先備份；只有 JSON 一層，腳本自我驗證，再用還原 dry-run 證明讀得回來 | 第一個不可逆變更（drop policy、alter table）在 M1；免費方案沒有 PITR | 備份留在 M2；JSON＋verify＋`pg_dump` 三層 |
| D22（審查，**已由 §17 S5 取代**） | ~~M3 migration 用 trigger 補 `start_date`；check 留到收尾 migration；`start_time` 寫台北 12:00~~ → 不加 trigger、不加 check、不寫收尾 migration；讀取端退回 `start_time`；M3 合併後跑一次對齊 SQL | 只有使用者一人，舊前端只在 M3 QA 期間短暫共存 | 原 D22 |
| D23（審查，**已由 §17 S1 取代**） | ~~`merge_log`＋`unmerge(log_id)`＋還原演練~~ → 合併前完整備份，出問題整體還原 | 一次性操作，單人使用；備份還原已足夠 | 原 D23 |
| D24（審查，§17 S1 修訂） | 外鍵清單從 `pg_constraint` 查（保留）；補值用簡單黑名單；不做 `google_place_id` 搬移（M2 時舊營區都沒有 place_id） | 避免漏掉未知的外鍵 | 寫死兩張表；補值白名單＋`field_overrides` |
| D25（審查） | 貼連結也先列候選（`resolveOnly`），不自動選第一筆；重複比對在 Gemini 之前 | 符合共識「不自動猜」，也省一次 Gemini | 自動取 Text Search 第一筆 |
| D26（審查） | `api/` 測試只放 `_lib/`、import 寫 `.js`、新增 `tsconfig.api.json`、本機不跑 `/api` | 測試檔會被部署成 function；ESM 執行期找不到模組；api 原本不在型別檢查範圍 | `.vercelignore`；`vercel dev` 列為必要 |
| D27（審查，§17 S6 修訂） | `ensureDefaults` 只在使用者完全沒有分類時建立 5 個預設；露營、棒球分類靠 delete policy＋UI 不顯示刪除鍵保護，不加 `system_key` trigger | 避免把使用者刪掉的分類加回來、撞名稱唯一 | upsert 補齊 5 個 |
| D28（審查） | TripModal 用 `useTripModal()` singleton 開啟；新增營區以 sheet 疊在 TripModal 上，不換路由 | 換路由會遺失已填表單；FAB 需要帶日期 | `/library/new?returnTo=` 往返 |
| D29（審查） | 行事曆顯示夜衝（前一天）、行程狀態外觀；置頂卡加建議出發時間、濕帳提示、狀態 pill；導航優先用 place_id | 露營專家指出的實用資訊，不需改 schema | 只顯示溫度和車程 |
| D30（審查） | 高風險欄位加 `check_in_time`、`check_out_time`、`amenities`；路況、訊號等寫進 AI 摘要段落，不加欄位（§14 Q3 確認）；提供「跳過 AI」 | 這些資訊常變動或常查不到 | 新增結構化欄位 |

## 14. 使用者疑問（已決定，2026-10-17）

| # | 問題 | 使用者的答案 | 影響的段落 |
|---|---|---|---|
| Q1 | Vercel 預覽要連哪一個資料庫？ | **連正式庫**。QA 測試資料標題一律用 `[QA]` 前綴，測完刪除 | §3、計畫 Global Constraints |
| Q2 | 家庭資料：查到別人建立、掛在你家庭底下的資料時怎麼處理？ | **尚未回答（條件式）**：M1 Task 1.3 的檢查 SQL 若三張表都是 0，就不用回答；不是 0 時停下來問 | §6.3、計畫 Task 1.3 |
| Q3 | 要不要加寵物、插電、價格、山路、訊號欄位？ | **不加**，放 AI 摘要 | §2、§5.7 |
| Q4 | 本機有 Docker 嗎，或願意安裝嗎？ | **不裝 Docker**。移除所有依賴 Docker／本機 `supabase start` 的步驟（`db reset`、`db diff`、`db dump`、本機還原演練） | §3、§8、§10、§17 S3 |
| Q5 | 新增露營要不要允許「營地未定」？ | **選 B：不允許**。新增露營行程必須選營區才能存；找不到時在同一畫面開新增營區 sheet（M4 之前用現有的營區編輯視窗手動新增，即 Q8） | §2、§5.3、§5.6、D6 |
| Q6 | 找新營區的設施條件怎麼處理？ | **(a) 只當搜尋關鍵字**，畫面註明「不保證有」 | §5.8 |
| Q7 | 天氣要不要做海拔校正？ | **顯示的溫度也改成校正後的數字**（約每 1000 m 降 6°C），夜溫 < 10°C 警告也用校正值，並標示「已依海拔校正」 | §5.3、§5.11 |
| Q8 | 過渡期（M0 到 M4）用現有營區編輯視窗手動新增營區？ | **可以** | §5.6 |
| Q9 | Gemini 透過 Google 搜尋引用露營樂、愛露營頁面當來源？ | **可以，但要附來源連結** | §5.7 |
| Q10 | migration 的 rollback 註解區可以 drop 本次新增的東西？ | **可以** | §6.2 |
| Q11 | 中職「清除整年」？ | **改成「重新同步整年」** | §6.2、§7.2 |

## 15. 假設（未驗證，實作時第一步查證）

- 線上 DB 有 `total_capacity`、`capacity_zones`、`campsite_quick_chips`、`layout_image_url`，以及 `handle_new_user` trigger；`exec_sql` 是否存在不確定。這些都等 M1 的 baseline 確認。
- `campsites` 是全站共用表；Supabase Auth 裡除了使用者以外沒有其他帳號（M1 前關閉註冊時順便確認，§7.1）。
- `src/vite-env.d.ts` 目前**沒有**宣告 `VITE_GEMINI_API_KEY`，但 `aiService.ts` 仍然有使用（PM 查證，修正專家報告的說法）。
- 本機 `dist/` 裡 grep 不到 `AIza`。Vercel 正式站的 bundle 有沒有 key **沒有驗證**，所以一律 rotate。
- `utils/holidays.ts` 只有 2025 和 2026 年的資料（PM 查證）。
- 費用數字、Vercel Hobby 的 function 時間上限、Gemini 模型名稱，都依專家既有知識，**沒有查證 2026-10 當下的資訊**。
- rolldown-vite 和 Vitest 的相容性沒有驗證，M0 第一個測試任務就會驗證。
- 舊的計畫 `docs/superpowers/plans/2026-03-16-booking-availability-monitor.md`（爬蟲）已經被本規格取代，不實作。
- （審查新增）campsites 的 RLS 可能本身就擋掉未審核的營區；若 M0 移除前端 `is_verified` 過濾後仍看不到，記錄下來留給 M1 baseline 後處理，M0 不改 RLS。
- （審查新增）主表 CREATE 不在版控，可能還有其他表用外鍵參照 `campsites` 或 `camping_trips`（例如裝備關聯表）。Task 1.1 會從 `pg_constraint` 查出完整清單，M2 的合併與還原腳本都用這份清單。
- （審查新增）Vercel Node function 對 `"type": "module"` 專案的 TS 編譯和 `.js` 副檔名 import 行為，Task 1.4 部署預覽後用 curl 驗證（回 401 而不是 500）。
- （簡化新增）`supabase db dump` 需要 Docker，所以 baseline 改用本機 `pg_dump`；`supabase gen types typescript --project-id <ref>` 只需要 `supabase login`，不需要 Docker 和 `supabase link`。實作時以當下 CLI 文件確認。
- （簡化新增）Open-Meteo forecast 回應中的 `elevation` 欄位，是預報實際使用的海拔（§5.11 用它當校正基準）。實作前查文件確認；若不是，改用 elevation API 查格點座標的海拔，並回報 PM。
- （已不適用）原假設「遠端 `schema_migrations` 可能記錄舊的 8 碼日期 migration」：簡化後不使用 `supabase db push`（§10），不需要處理。

## 16. 審查修訂紀錄（2026-10-17，PM）

三份審查（PM 審查、露營專家、實作工程師視角）的處理結果。採納的已寫進上方各節並標「PM 決定（審查）」；需要使用者決定的列在 §14 Q4–Q11（已於 2026-10-17 回答，見 §14）；沒採納的如下：

| 意見 | 不採納的理由 |
|---|---|
| 去重報告標出每筆座標的來源（手動／geocode／Places） | 舊資料沒有記錄座標來源，做不到；改用「同名同鄉鎮不論距離一律列出」達到同樣目的 |
| 加一支腳本替舊營區批次查 Places place_id | 需要 M4 的伺服器 key 和 Places 包裝，M2 時還沒有；每筆一次 Text Search，費用和範圍都超出本次。列為第二階段；新收錄的營區都會有 place_id |
| 找新營區用「露營區」「營地」各查一頁 | 呼叫次數加倍，和「費用接近 0」衝突；改用較寬的「露營」關鍵字 |
| CampsiteEditModal 改成「用 Google 資料補齊」按鈕 | 二選一時選直接刪除 Autocomplete 和 AI 按鈕（Rule 2）；「補查設施」放在營地詳情頁（M5-3）一處就好 |
| 本機用 `vercel dev` 跑 API 列為必要 | 多一套工具和登入；API 邏輯用 Vitest 驗證、整合用預覽網址驗證已足夠 |
| ensureDefaults 改成只確保 camping、baseball 存在 | 這兩個由 migration 回填，又有 delete policy 禁止刪除（簡化後不再有 `system_key` trigger，§17 S6），不會消失；只需處理「完全沒有分類的新帳號」 |

## 17. 簡化決策（2026-10-17，使用者選擇「簡化」路線）

前提：這個 app 只有使用者本人使用，不為多人產品或高可靠性設計。以下是刪掉或合併的東西、理由，以及**接受的風險**。安全修正（key 不進前端、`cpbl_schedule` 寫入權限、RLS 進版控）全部保留，不在簡化範圍內。

| # | 刪掉／合併了什麼 | 為什麼 | 接受的風險 |
|---|---|---|---|
| S1 | **合併重複資料**：拿掉 `merge_log` 表、`merge_campsites`／`merge_trips`／`unmerge` DB function、還原演練、`field_overrides`、`google_place_id` 搬移。改成 TS 腳本用 service role 逐群改外鍵、補空白欄位、設 `merged_into_id`；出問題就用 `restore.ts` 從合併前的備份把相關表整體 upsert 回去。計畫原 Task 2.2（佔位）、2.3、2.4、2.5 重整為新的 Task 2.2、2.3；`merged_into_id` 兩個欄位併入 M1 Task 1.6 的 migration | 合併只做一次；不刪除任何列，所以「備份 upsert 回去」就能完整復原；`google_place_id` 在 M2 時根本沒有值 | (1) 合併不在 transaction 內，中途失敗會留下半套狀態，必須整體還原，不能只還原單一群。(2) 整體還原會把備份之後對營區／行程／照片的修改一起蓋掉，所以備份後要立刻合併，合併期間不要在 app 裡編輯。(3) 沒有逐筆的合併紀錄，事後想知道「哪筆被併到哪筆」只能看 `merged_into_id` 和當時的備份檔。 |
| S2 | **備份只留一層**：JSON 匯出＋自我驗證（讀回、parse、筆數相符）。拿掉 `pg_dump --format=custom` 整庫備份、獨立的 `verify-backup.ts`。「驗證可讀」改成跑一次 `restore.ts` dry-run，差異必須是 0 | 三層備份對單人自用過重；dry-run 直接證明備份讀得回來，也證明還原腳本可用 | 沒有 auth schema、Storage 和整庫層級的備份；如果 Supabase 專案本身損壞，只能從 baseline＋migration 重建 schema，再用 JSON 灌回 public 表的資料。auth 使用者 id 若改變，資料的 owner 要手動對回。 |
| S3 | **不用 Docker、不追蹤 migration 歷史**（§14 Q4）：拿掉 `scripts/check-schema-drift.sh`、`supabase db diff`／`db reset`／`db dump`、`supabase/config.toml`（`supabase init`）、`supabase link`、`migration repair`、`migration list`、`db push`。baseline 用 `pg_dump --schema-only`；migration 由使用者在 SQL Editor 執行；型別用 `supabase gen types --project-id` | 沒有 Docker 時 drift 檢查只在 baseline 剛建立的那一刻有意義；SQL Editor 一次貼上就好，不需要處理舊 migration 歷史 | 沒有自動化方式確認「版控裡的 migration ＝ 正式庫實際狀態」，只靠每個 PR 描述勾選「已套用」。baseline 是否完整無法用重播驗證。 |
| S4 | **`ALLOWED_USER_IDS` 白名單改成「Supabase 關閉新使用者註冊」**，`requireUser` 只驗證 JWT 有效；拿掉 403 的測試與 QA 項目 | 一個後台開關就達成同樣效果，還順便擋住陌生帳號註冊後寫入共用的 `campsites` 表；少一個環境變數 | Supabase Auth 裡既有的帳號（若有家人帳號）都能呼叫 API。日後若重新開放註冊，API 會對任何註冊者開放，屆時必須加回白名單（寫在 §7.1）。 |
| S5 | **過渡期不為舊前端做相容**：拿掉 `calendar_events_fill_dates` trigger、收尾 migration（原計畫 Task 3.13，含 check constraint）、全天事件「存當地中午」慣例、M3 在正式站舊前端測試的步驟和完成標準。**保留**：(a) migration 只做加法（理由：所有資料保留，而且正式站在模組合併前仍在跑）；(b) 讀取時 `start_date` 為 null 退回 `start_time`（理由：資料正確性，任何漏填的寫入都不能讓事件消失）；(c) cpbl RLS 在新前端上線後才套用（理由：只是先後順序，不需要額外程式）。新增：M3 合併後跑一次對齊 SQL | 舊前端只在 M3 QA 期間（幾天）和新版共存，使用者只有一人 | M3 QA 期間在預覽站建立的全天事件，在正式站舊前端會顯示早一天（合併後消失）。資料庫不再擋「全天事件沒有日期」的寫入，靠讀取端退回和對齊 SQL 處理。 |
| S6 | 拿掉「禁止變更 `system_key`」的 trigger | 前端不會修改 `system_key`；delete policy＋UI 不顯示刪除鍵已足夠 | 有人手動呼叫 API 先改 `system_key` 再刪除，就能刪掉露營或棒球分類（事件會變成無分類，顯示個人色）。只有使用者本人能做到。 |
| S7 | 家庭資料檢查從 `scripts/check-family-data.ts` 改成一段在 SQL Editor 執行的唯讀 SQL；差集比對簡化成單一條件（§6.3） | SQL Editor 本來就繞過 RLS，不需要 service role 腳本；條件推導後就是完整差集 | 無（檢查結果相同）。 |
| S8 | M2 不再為「前端隱藏已合併資料」單獨先開 PR，和合併腳本放同一個 M2 PR；PR 合併後才執行 `--apply` | 隱藏條件在沒有合併資料時不改變畫面，跟腳本一起上線即可 | 無（順序仍是「前端先上線、再合併」）。 |
| S9 | 只有 M5（標準是「畫面不變」）需要改版前截圖；其他模組的 PR 只附改版後截圖 | M0–M4 本來就是要改畫面，前後對照沒有判定作用 | 少了 M0–M4 的改版前存檔，事後想對照舊畫面只能看 git 歷史。 |

被刪除的計畫任務：原 Task 2.2（佔位）、原 Task 2.3（合併 schema 與 DB function）、原 Task 2.5（併入新 Task 2.3）、Task 3.13（收尾 migration）。原 Task 2.4 拆成新 Task 2.2（報告）和新 Task 2.3（合併）。修訂後共 42 個任務。
