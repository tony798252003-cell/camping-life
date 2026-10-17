# 搭帳日誌 → 生活行事曆 重新設計 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal：** 把搭帳日誌改成「生活行事曆＋露營紀錄」。首頁是月曆、事件列表和置頂的下一趟露營卡，另有週檢視和日檢視；營區改由伺服器端的 Places＋Gemini 產生草稿；資料清理過程不刪除任何資料；schema 和 RLS 進版控；所有 key 只放在伺服器端。

**Architecture：** 維持 Vue 3＋Supabase 前端直連（靠 RLS 保護），需要 key 的工作改走 Vercel `api/` 的 Node function，並用 Supabase JWT 守門（Supabase 關閉新使用者註冊，所以有效 JWT 只屬於既有帳號）。行事曆把 `calendar_events`、`camping_trips`、`cpbl_schedule` 三個來源，透過純函式轉成同一種 `ViewEvent` 來顯示。共用資料改成模組層級的 singleton composable。schema 只做加法，因為 Vercel 預覽環境和正式站共用同一個資料庫，而且所有資料保留。

**簡化路線（規格 §17）：** 只有使用者一人使用。不為舊前端加相容機制、不做 merge_log／unmerge、備份只有一層、不用 Docker、不追蹤 migration 歷史。安全修正全部保留。

**Tech Stack：** Vue 3.5、TypeScript 5.9、rolldown-vite 7.2.5、Tailwind v4、lucide-vue-next、supabase-js 2、Vitest（新增）、Supabase CLI（只用來產生型別）、`pg_dump`（只用來產生 baseline）、Vercel serverless（Node runtime）、Google Places API (New)、Gemini＋Google Search grounding、Open-Meteo。

**Spec：** `docs/superpowers/specs/2026-10-17-life-calendar-redesign-design.md`（以下稱「規格」，章節寫作 §x）。執行每個任務前，必須先讀規格中對應的章節。規格 §14 的疑問已全部回答（Q2 為條件式，見 Task 1.3）。

## Global Constraints

- **分支與 PR（PM 決定（審查），規格 §10）**：所有工作在 `redesign/life-calendar` 進行，模組**依序**執行（沒有平行）。每個模組（M5 每個子項）完成後，從 `redesign/life-calendar` 開 PR 到 `main`；使用者在該 PR 的 Vercel 預覽網址確認後，以 merge commit 合併，再 `git checkout redesign/life-calendar && git merge --ff-only main`，才開始下一個模組。推送和開 PR 用私人帳號 `tony798252003-cell`（帳號切換依使用者既有設定，不確定時先問）。
- 回覆、註解、commit 訊息用繁體中文或英文都可以，但 UI 文案一律用繁體中文。
- **不得**刪除資料庫中的任何資料列、欄位或表。migration 只能做加法（例外：cpbl 的 policy 和 `exec_sql`，見 Task 1.5；每支 migration 尾端的 `-- rollback:` 註解區，規格 Q10 已同意；「重新同步整年」刪除官方已不存在且未被綁定的 `cpbl_schedule` 列，規格 Q11，見 Task 3.12）。
- **不得**由 agent 對正式庫執行寫入或 migration，agent 也**不持有** service role key。用到 service role 的腳本（備份、還原、去重報告與合併）由使用者本人執行，從 `.env.local` 讀 key（沿用 `scripts/` 現有的 `dotenv` 寫法）。**migration 由使用者在 Supabase SQL Editor 貼上執行**（不用 `supabase db push`，規格 §10）；每支套用後，在該 PR 描述勾選「已套用到正式庫（日期）」。
- **不使用 Docker**（規格 Q4）：不得出現 `supabase start`、`supabase db reset`、`supabase db diff`、`supabase db dump`，也不寫需要本機資料庫的步驟。
- **每次動正式庫前（套用 migration、執行合併、執行還原），使用者先跑 `npx tsx scripts/backup/backup-all.ts`（Task 1.0），exit 0 才繼續。** migration 檔名時間戳＝實際套用順序。
- **`api/` 規則（規格 §7.1）**：測試只放在 `api/_lib/`（`api/` 根目錄非底線檔案都會被部署成 function）；endpoint 檔只做薄層，邏輯放 `_lib`；相對 import 一律寫 `.js` 副檔名；被 api import 的 `src/` 檔案不得使用 DOM、`window`、`import.meta.env`、Vite API 或 supabase client。
- 前端不得出現任何 Google 或 Gemini key。新的環境變數一律**不加** `VITE_` 前綴（`VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY` 除外）。
- 不引入 Pinia、UI 元件庫、ESLint 或 CI。新元件放在 `src/components/<calendar|campsite|trip|settings>/`，純函式放在 `src/utils/`，測試和原始檔放同一層，檔名用 `*.test.ts`。
- 時區一律是 `Asia/Taipei`。日期字串格式是 `YYYY-MM-DD`，`endDate` 包含當天。`duration_days` 代表天數（含頭尾），結束日 = `trip_date + duration_days - 1`。
- 外觀沿用規格 §5.10 的 token。預設分類色：露營 `#10b981`、棒球 `#9d1c32`、工作 `#3b82f6`、家庭 `#f59e0b`、個人 `#8b5cf6`。色盤：`#3b82f6 #ef4444 #10b981 #f59e0b #8b5cf6 #ec4899 #64748b`。
- QA 的手機尺寸是 375×812 和 390×844。每個模組的 PR 附上改版後截圖；只有 M5 需要改版前截圖（規格 §17 S9）。
- **QA 測試資料（規格 Q1）**：預覽站連正式庫。QA 建立的任何測試資料，標題或名稱一律以 `[QA]` 開頭，測完由 QA 在畫面上刪除；畫面上刪不掉的列給使用者在 table editor 刪除。
- **QA 怎麼登入（PM 決定（審查））**：QA 沒辦法自己做 Google OAuth。使用者先在 Chrome 登入預覽網址，QA 用 claude-in-chrome 接上這個已登入的瀏覽器操作。需要使用者 JWT 的 curl，從該瀏覽器 localStorage 的 `sb-*-auth-token` 取 `access_token`。打預覽網址 `/api/*` 的 curl 若被 Vercel Deployment Protection 擋住，使用者需關閉預覽保護或提供 bypass token（加 header `x-vercel-protection-bypass`）。
- 每個任務完成時必須通過：`npm test`、`npm run typecheck`、`npm run build`（Task 0.1 豁免 `npm test`，因為 Vitest 在 Task 0.2 才安裝）。

## Review Focus

1. **系統時區不是台北**（例如 QA 機器或 CI 是 UTC）時，全天事件和行程不能偏移一天。→ 在 Task 0.2 加入 `test:tz` 腳本，所有日期相關測試都要在 `TZ=UTC` 和 `TZ=America/Los_Angeles` 下各跑一次，對應 Task 3.2、3.3 的測試。
2. **舊資料欄位不完整**：`calendar_events` 的 `start_date` 為 null（M3 合併前正式站舊前端寫入的，或日後在 SQL Editor 手動新增的）、舊行程的 `campsite_id` 為 null、`duration_days` 為 0 或 null 時，畫面不能壞，也不能消失。→ Task 3.3 `eventToView` 退回 `start_time` 的測試；`tripToView` 對 `duration_days` 為 0 或 null 時當作 1 天的測試。（簡化：不再要求新版寫入的資料在正式站舊前端顯示正確，規格 §17 S5。）
3. **使用者貼上的不是 Google Maps 連結**（例如 FB 網址、內網 IP、會轉址到其他網域的短網址）時，要回友善錯誤，伺服器也不能去抓非 Google 的網址。→ Task 4.1 `isAllowedMapsHost` 和 `resolveShortUrl` 的「轉址到其他網域」測試。
4. **同名但不同地點的營區**（全台有很多「XX農場」）不能被判成重複，否則會被誤合併；但改名或少一個字的營區要能抓到。→ Task 2.1 `matchCampsite` 的「同名距離 > 2km 不算重複」測試。
5. **使用者綁定某場比賽的事件**和桃猿賽程的疊加圖層不能在同一天重複出現；關閉開關後，使用者自建的棒球事件仍然要顯示。→ Task 3.3 `buildFeed` 的兩個測試；Task 3.12「重新同步整年」不得刪除被 `cpbl_game_id` 綁定的比賽，任何月份抓取失敗就不刪任何列的測試。
6. **合併出問題時能從備份整體還原**：備份讀得回來，而且還原只把備份裡有的列 upsert 回去，備份之後新增的資料不受影響。→ Task 1.0 `restore.ts` 的比對與 upsert 測試，以及合併前 dry-run 差異為 0 的檢查（Task 2.3）。
7. **資料總數在每個模組都不變**：家庭查詢改寫（Task 1.3）、隱藏已合併資料（Task 2.3）都不能讓任何一筆行程從畫面消失（`user_id` 為 null 的舊行程尤其要注意）。

---

## 檔案結構總覽

**新增**
```
vitest.config.ts
tsconfig.api.json
.env.example
supabase/migrations/20261017000000_baseline.sql            (使用者 pg_dump，含權限與 RLS)
supabase/migrations/20261017000100_cpbl_rls.sql
supabase/migrations/20261017000200_campsite_fields.sql     (營區新欄位＋campsites/camping_trips 的 merged_into_id)
supabase/migrations/20261017000300_calendar_categories.sql
supabase/archive/legacy/README.md                           (舊 SQL 搬來這裡)
scripts/backup/backup-all.ts, scripts/backup/restore.ts(+ restoreCore.ts + restoreCore.test.ts)   (M1 Task 1.0)
scripts/dedupe/plan.ts(+ .test.ts), scripts/dedupe/report.ts, scripts/dedupe/apply.ts
api/_lib/http.ts, auth.ts(+test), supabaseAdmin.ts, cpbl.ts(+test), mapsUrl.ts(+test), places.ts(+test),
        placesSearch.ts(+test), gemini.ts, draft.ts(+test), discover.ts(+test)    (測試只放 _lib)
api/cpbl-sync.ts, api/places-search.ts, api/campsite-draft.ts, api/campsite-discover.ts   (薄層，無測試檔)
src/composables/useTripModal.ts
src/types/supabase.ts                                       (產生)
src/constants/campsiteOptions.ts
src/services/api.ts
src/services/db/categories.ts, events.ts, profile.ts
src/utils/dateRange.ts(+test)
src/utils/nextTrip.ts(+test)
src/utils/altitudeTemp.ts(+test)
src/utils/campsiteMatch.ts(+test)
src/utils/campsiteName.ts(+test)
src/utils/calendar/viewEvent.ts, eventSources.ts(+test), monthLayout.ts(+test),
                  timeGridLayout.ts(+test), eventRow.ts(+test)
src/composables/useEventCategories.ts, useCalendarFeed.ts
src/components/calendar/CalendarHome.vue, CalendarHeader.vue, MonthGrid.vue, AgendaList.vue,
                  WeekView.vue, DayView.vue, EventEditorSheet.vue, EventDetailSheet.vue,
                  DayListSheet.vue, NewItemSheet.vue, CpblToggle.vue, CpblGameSheet.vue, PinnedTripCard.vue
src/components/settings/CategorySettings.vue
src/components/campsite/AddCampsiteFlow.vue, AddCampsiteView.vue, DraftFieldRow.vue, DiscoverCampsitesView.vue
```

**刪除**
`src/views/CampsiteBuilder.vue`、`src/components/onboarding/`、`src/composables/useOnboarding.ts`、`src/components/ImportCampsites.vue`、`src/components/TripMemoryWidget.vue`、`src/components/SettingsModal.vue`、`src/components/HelloWorld.vue`、`scripts/cleanup-all-campsites.ts`、`scripts/cleanup-empty-city.ts`、`scripts/add-capacity-column.ts`、`scripts/import-campsites.ts`、`scripts/update-capacity.ts`、`scripts/verify-import.ts`、`scripts/verify-all-imported.ts`（M0）；`src/components/CalendarView.vue`、`CalendarSelectionModal.vue`、`CalendarEventList.vue`、`EventModal.vue`、`src/types/calendarView.ts`、`src/components/HomeView.vue`（M3）；`api/camping-info.ts`、`src/services/aiService.ts`、`src/components/GooglePlaceSearch.vue`、`src/types/google-maps.d.ts`（M4）。

## 任務總覽（共 42 個）

| 模組 | 任務 |
|---|---|
| M0（8） | 0.1 還原 ajv、0.2 Vitest 與 typecheck、0.3 移除前端 Gemini 直連、0.4 刪除 /builder、0.5 刪除 Onboarding、0.6 刪除匯入/審核/回憶小工具/危險腳本、0.7 移除家庭 UI、0.8 TripModal 必須選營區 |
| M1（7） | 1.0 備份與還原腳本、1.1 Baseline、1.2 型別、1.3 家庭資料檢查與查詢改寫、1.4 API 守門、1.5 CPBL 伺服器同步＋RLS、1.6 營區新欄位與合併標記 |
| M2（3） | 2.1 營區比對純函式、2.2 分群與重複報告、2.3 合併腳本與隱藏已合併資料 |
| M3（12） | 3.1 分類與回填 migration、3.2 日期純函式、3.3 ViewEvent 等轉換、3.4 月格排版、3.5 時間格排版、3.6 資料層、3.7 分類管理、3.8 首頁、3.9 事件 sheet、3.10 週日檢視、3.11 置頂卡＋海拔校正＋2027 假日、3.12 桃猿開關＋重新同步整年＋移除舊行事曆 |
| M4（6） | 4.1 Maps URL 解析、4.2 Places 與名稱候選 API、4.3 草稿 API、4.4 Gemini、4.5 新增營區畫面、4.6 TripModal 改接新流程並移除 Maps JS |
| M4b（2） | 4b.1 搜尋 API、4b.2 搜尋畫面 |
| M5（4） | 5-1 設定頁、5-2 TripModal、5-3 營地圖鑑、5-4 統計/裝備/照片/App.vue |

---

# M0：止血、砍功能、測試基礎

**模組完成標準：** 見規格 §11 M0。

### Task 0.1：還原 ajv

**Files:** Modify: `package.json`、`package-lock.json`

- [ ] **Step 1：確認未提交的變更只有 ajv**
  Run: `git diff -- package.json`
  Expected：唯一的變動是新增 `"ajv": "^8.18.0"`。**如果還有其他變動，停下來回報，不要還原。**
- [ ] **Step 2：還原**
  Run: `git checkout -- package.json package-lock.json && npm ci`
- [ ] **Step 3：驗證**
  Run: `git diff main -- package.json | grep ajv; npm run build`
  Expected：grep 沒有輸出，build 成功。
- [ ] **Step 4：Commit** `chore: revert unused ajv dependency`

### Task 0.2：加入 Vitest 與 typecheck 腳本

**Files:**
- Create: `vitest.config.ts`、`src/utils/holidays.test.ts`、`.env.example`
- Modify: `package.json`（scripts、devDependencies）

**Interfaces:**
- Produces：`npm test`（`vitest run`）、`npm run test:tz`（`TZ=UTC vitest run && TZ=America/Los_Angeles vitest run`）、`npm run typecheck`（`vue-tsc -b --noEmit`，如果 `-b` 和 `--noEmit` 不能一起用，就改成 `vue-tsc -b`）

- [ ] **Step 1：安裝**
  `npm i -D vitest`（版本要相容 rolldown-vite 7.2.5。如果 overrides 造成衝突，`vitest.config.ts` 就不要 import `vite.config.ts`，改成獨立設定，`test.environment = 'node'`，`include: ['src/**/*.test.ts','api/**/*.test.ts','scripts/**/*.test.ts']`）。
- [ ] **Step 2：寫測試** `src/utils/holidays.test.ts`
  ```ts
  // 為什麼：首頁和車程估算都依賴假日判斷，日期錯了會誤報塞車或漏標連假
  it('國慶日是假日', () => expect(isHoliday('2026-10-10')).toBeTruthy())
  it('一般平日不是假日', () => expect(isHoliday('2026-10-14')).toBeFalsy())
  ```
- [ ] **Step 3：Run** `npm test && npm run test:tz`。Expected：PASS（兩個 TZ 都要過）。
- [ ] **Step 4：** 新增 `.env.example`，只列變數名稱，不填值：`VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`、`SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`DB_URL`、`GEMINI_API_KEY`、`GEMINI_MODEL`、`GOOGLE_PLACES_SERVER_KEY`，檔頭註解「本機腳本讀 `.env.local`（已 gitignore），不要 commit 真的值」。`.gitignore` 現有 `.env.*` 會連 `.env.example` 一起忽略，所以在 `.gitignore` 加一行 `!.env.example`，並用 `git check-ignore .env.example; echo $?` 確認結果是 1。
- [ ] **Step 5：** Run `npm run typecheck && npm run build`。Expected：PASS。
- [ ] **Step 6：Commit** `chore: add vitest, typecheck script and .env.example`

### Task 0.3：移除前端 Gemini 直連

**Files:** Modify: `src/services/aiService.ts`

- [ ] **Step 1：** 刪除 `fetchFromGeminiDirectly`，以及 `import.meta.env.VITE_GEMINI_API_KEY` 的兩個分支（大約在第 21 和 28 行）。`/api/camping-info` 失敗時改成直接 throw，讓呼叫端顯示錯誤（Rule 12）。
- [ ] **Step 2：驗證**
  Run: `npm run build && grep -rE "generativelanguage|VITE_GEMINI" dist/ src/ ; echo "exit=$?"`
  Expected：沒有任何命中（`exit=1`）。
- [ ] **Step 3：Commit** `fix(security): remove client-side Gemini fallback`

### Task 0.4：刪除營地平面圖 /builder 與 Konva

**Files:** Delete `src/views/CampsiteBuilder.vue`；Modify `src/router/index.ts`（移除 `/builder` route，加上 `{ path: '/builder', redirect: '/' }`）、`src/components/HomeView.vue`（移除入口按鈕）、`package.json`（移除 `konva`、`vue-konva`）

- [ ] **Step 1：** 刪除檔案和引用。執行 `grep -rn "builder\|konva\|Konva" src/`，結果只能剩下 `redirect`。
- [ ] **Step 2：** `npm uninstall konva vue-konva && npm run build && grep -rl konva dist/ ; echo $?`。Expected：build 成功，grep 結果為 1。
- [ ] **Step 3：Commit** `feat!: remove campsite builder (konva)`

### Task 0.5：刪除 Onboarding 精靈

**Files:** Delete `src/components/onboarding/`、`src/composables/useOnboarding.ts`；Modify `src/App.vue`（移除 OnboardingWizard import、區塊和 `handleOnboardingComplete`）、`src/views/SettingsView.vue`（移除「重設 onboarding」）、`src/composables/useUserProfile.ts`（select 不再讀 `onboarding_completed_at`；欄位保留在 DB）

- [ ] **Step 1：** 刪除。執行 `grep -rn "onboarding\|Onboarding" src/`，結果只能剩下 `src/types/database.ts` 的 `onboarding_completed_at` 型別定義（欄位依規定保留）。
- [ ] **Step 2：** `npm run typecheck && npm run build` PASS。
- [ ] **Step 3：Commit** `feat!: remove onboarding wizard`

### Task 0.6：刪除 Excel 匯入、審核、回憶小工具、死碼和危險腳本

**Files:**
- Delete：`src/components/ImportCampsites.vue`、`TripMemoryWidget.vue`、`SettingsModal.vue`、`HelloWorld.vue`、`scripts/import-campsites.ts`、`scripts/update-capacity.ts`、`scripts/cleanup-all-campsites.ts`、`scripts/add-capacity-column.ts`、`scripts/cleanup-empty-city.ts`（會刪除所有 `is_verified=false` 的營區）、`scripts/verify-all-imported.ts`（會把所有營區改成 `is_verified=true`，抹掉 M2 報告用來辨識 TripModal 自動建立營區的線索）、`scripts/verify-import.ts`（只服務已砍掉的匯入功能）
- Modify：`src/components/CampsiteLibrary.vue`（移除匯入入口、審核按鈕（約在 `:249`、`:496`），以及 `is_verified` 的可見度過濾（約在 `:137-144`），所有營區一律顯示，規格 D9）、`src/components/TripModal.vue`（移除「依 `is_verified` 鎖名稱」的邏輯，約在 `:168`）、`src/components/HomeView.vue`（移除 TripMemoryWidget）、`src/views/SettingsView.vue`（移除「批次更新 GPS」`startBatchUpdateGPS` 和開發工具區）、`package.json`（移除 `xlsx`）
- 保留：`data/campsites.xlsx`、`scripts/geocode-campsites.ts`、`SystemAssetManager.vue`、`is_admin`

- [ ] **Step 1：** 刪除前先執行 `grep -rln "xlsx" scripts src`，確認只有上面列出的檔案用到 xlsx。如果還有其他檔案，停下來回報。
- [ ] **Step 2：** 刪除與修改，然後 `npm uninstall xlsx`。
- [ ] **Step 3：** `npm run typecheck && npm run build` PASS。執行 `grep -rn "ImportCampsites\|TripMemoryWidget\|SettingsModal\|HelloWorld\|startBatchUpdateGPS" src/`，應該沒有命中。
- [ ] **Step 4：** 如果移除前端 `is_verified` 過濾後，預覽站仍然看不到之前未審核的營區，代表 campsites 的 RLS 本身就擋掉了。**記錄在 PR 描述，留給 M1 baseline 之後處理，M0 不改 RLS**。
- [ ] **Step 5：Commit** `feat!: remove excel import, review flow, memory widget, dead code and destructive scripts`

### Task 0.7：移除家庭共享 UI（保留讀取邏輯）

**Files:** Modify `src/views/SettingsView.vue`（移除家庭按鈕和 `currentView === 'family'` 整個區塊）、`src/composables/useUserProfile.ts`（移除建立、加入、離開、踢除家庭的函式；**保留** `family_id` 的讀取）

- [ ] **Step 1：** 移除 UI 和寫入函式。`src/services/supabaseQueries.ts` 的 `tripQueries.fetchAll(userId, familyId)` **完全不動**（規格 §6.3，等到 Task 1.3 才改）。
- [ ] **Step 2：** `npm run typecheck && npm run build` PASS。
- [ ] **Step 3：Commit** `feat!: remove family sharing UI (data untouched)`

### Task 0.8：TripModal 必須選營區、停止自動新建營區（PM 決定（審查），規格 §5.6、Q5、Q8）

**Files:** Create `src/composables/useTripModal.ts`；Modify `src/components/TripModal.vue`（刪除 `handleSubmit` 中約 `:319-333` 的「用名稱找營區、找不到就 insert」區塊；新增「＋新增營區」按鈕；新增 `initialDate` prop）、`src/App.vue`（全域 TripModal 改讀 `useTripModal`；`handleAdd` 改呼叫 `openNew()`；在 TripModal 之上疊開現有的 `CampsiteEditModal` 新增模式）

**Interfaces:**
- Produces：`useTripModal(): { isOpen: Ref<boolean>; activeTrip: Ref<CampingTripWithCampsite|null>; initialDate: Ref<string|null>; openNew(date?: string): void; openEdit(trip): void; close(): void }`（模組層級 ref，沿用 `useNotification.ts` 的寫法）。M3 的 FAB 和行事曆也用它。
- TripModal 新增模式的營區欄位規則（規格 Q5 決定 B，不做「營地未定」）：(1) 選了已收錄營區 → 正常存檔；(2) 填了營區名稱但沒有 `campsite_id`，或營區欄位完全空白 → **擋存檔**，提示「請從清單選營區，或按＋新增營區」。
- 「＋新增營區」：打開 `CampsiteEditModal`（`id: 0` 的新增模式，預先帶入使用者已打的名稱），存檔成功後把新營區的 id 和名稱選回 TripModal。**不換路由**，在同一個畫面完成，TripModal 已填的表單不能遺失（規格 Q8 使用者已同意用這個過渡做法，M4 Task 4.6 換成新流程）。

- [ ] **Step 1：** 先記下 TripModal 現有的營區選取流程（搜尋框、`campsite_id`、`campsite_name` 如何寫入），不更動編輯既有行程的行為：舊行程沒有 `campsite_id` 時照樣可以存檔。
- [ ] **Step 2：** 實作上述 Interfaces。`grep -n "from('campsites').insert" src/components/TripModal.vue` 沒有命中。
- [ ] **Step 3：** `npm run typecheck && npm run build` PASS。
- [ ] **Step 4：Commit** `fix(trip): stop auto-creating campsites from trip modal`

### M0 QA 驗證清單（手機尺寸，用預覽網址）
- [ ] 從預覽網址用 Google 登入後，會回到**預覽網址**（`useAuth.ts:70` 已經使用 `window.location.origin`；如果被導回正式站，代表使用者還沒設定 Redirect URLs）
- [ ] `/builder` 會導回首頁；設定頁沒有家庭、開發工具、批次 GPS；圖鑑沒有匯入和審核按鈕；首頁沒有回憶小工具
- [ ] 清除 localStorage 後重新登入，不會跳 onboarding
- [ ] **行程總數和改版前一致**（QA 先在正式站記下總數再比對）；之前未審核的營區現在看得到（看不到時依 Task 0.6 Step 4 記錄）
- [ ] 新增露營：營區欄位空白 → 無法存檔並出現提示；打一個不存在的營區名稱、不選清單 → 無法存檔並出現提示；按「＋新增營區」→ 存檔後自動選回、TripModal 已填的日期還在；在 Supabase table editor 確認只多一筆營區（測試營區和行程名稱以 `[QA]` 開頭，測完刪除，見 Global Constraints）
- [ ] 編輯一筆沒有 `campsite_id` 的舊行程，仍然可以存檔
- [ ] DevTools Sources 搜尋 `generativelanguage`、`VITE_GEMINI`，沒有結果
- [ ] Console 沒有 error；沒有水平捲軸
- [ ] **檢查點：使用者在預覽網址確認後才合併**

---

# M1：Schema 基線、型別、RLS、CPBL 伺服器同步

**前置（使用者手動）：** 規格 §12 的「M1 前」項目（關閉 Supabase 新使用者註冊並確認 Users 列表、安裝 supabase CLI 與 libpq、`supabase login`、建立 `.env.local`）。Vercel 環境變數 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`。

**每支 migration 的共同格式：** 檔尾附 `-- rollback:` 註解區（規格 Q10 已同意：只 drop 本次新增的欄位、表、function、policy，回填改設回 null；只是註解，不執行）。

### Task 1.0：備份與還原腳本（必須在任何正式庫變更之前完成）

**Files:** Create `scripts/backup/backup-all.ts`、`scripts/backup/restoreCore.ts`、`scripts/backup/restoreCore.test.ts`、`scripts/backup/restore.ts`

**Interfaces:**
- Produces：
  - `npx tsx scripts/backup/backup-all.ts [--out ~/camping-life-backups]` → 建立 `<out>/<YYYYMMDD-HHmm>/<table>.json`（分頁抓取，每次 1000 筆）以及 `counts.json`。寫完後**自我驗證**：重新讀回每個檔案、`JSON.parse` 成功、陣列長度等於線上筆數。全部相符才 exit 0，否則 exit 1 並印出哪張表不符。
  - `restoreCore.ts`（純函式，給測試用）：`diffRows(backup: Row[], live: Row[]): { changed: Row[]; missing: Row[] }`（以 `id` 對齊；`changed`＝兩邊都有但任一欄位不同的備份列，`missing`＝備份有、線上沒有的列；**線上有、備份沒有的列不列入**）；`RESTORE_ORDER`（父表在前：`campsites` → `camping_trips` → `trip_photos` → 其他外鍵表）。
  - `npx tsx scripts/backup/restore.ts <備份目錄> --tables a,b,c [--apply]`：預設 dry-run，依 `RESTORE_ORDER` 逐表印出 `changed`、`missing` 的筆數和前 20 個 id。`--apply` 時把 `changed`＋`missing` 以 `id` upsert 回去（每批 500 筆），完成後重新比對，差異必須為 0。
- 表的清單：`campsites, camping_trips, trip_photos, camping_gear, profiles, system_assets, calendar_events, cpbl_schedule, families`。Task 1.1 拿到 baseline 後，如果還有其他 public 表，要回來加進清單；之後新增的 `event_categories`（Task 3.1）也要加。
- 讀 `.env.local` 的 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`（沿用 `scripts/` 現有的 `dotenv` 寫法）。

- [ ] **Step 1：寫失敗測試** `restoreCore.test.ts`
  ```ts
  // 為什麼：合併出問題時，這是唯一的回復手段（規格 §8 步驟 6）；備份之後新增的資料不能被動到
  diffRows([{id:1,a:1},{id:2,a:2}], [{id:1,a:1},{id:2,a:9},{id:3,a:3}]) → changed [{id:2,a:2}]、missing []   // id 3 是備份後新增的，不列入
  diffRows([{id:1,a:1}], []) → missing [{id:1,a:1}]
  // jsonb 欄位的鍵順序不同不算差異（例如 {x:1,y:2} vs {y:2,x:1}）
  RESTORE_ORDER.indexOf('campsites') < RESTORE_ORDER.indexOf('camping_trips') < RESTORE_ORDER.indexOf('trip_photos')
  ```
- [ ] **Step 2：** FAIL → 實作 `restoreCore.ts`、`backup-all.ts`、`restore.ts`。預設輸出目錄是 `~/camping-life-backups`，建立後 `chmod 700`。**如果輸出路徑位於 repo 內，就拒絕執行，exit 2**。→ `npm test` PASS。
- [ ] **Step 3（使用者執行）：** `npx tsx scripts/backup/backup-all.ts`，Expected：exit 0，並印出各表筆數。接著 `npx tsx scripts/backup/restore.ts <剛才的目錄> --tables campsites,camping_trips,trip_photos`，Expected：每張表差異都是 0（證明備份讀得回來，還原腳本比對正確）。
- [ ] **Step 4：Commit** `chore(scripts): add backup and restore scripts`
- 之後**每次動正式庫前**（套用 migration、執行合併、執行還原），使用者都重跑 `backup-all.ts`。

### Task 1.1：Baseline 進版控、整理舊 SQL

**Files:** Create `supabase/migrations/20261017000000_baseline.sql`、`supabase/archive/legacy/README.md`；Move `sql/*`、`setup_auth.sql`、`supabase/*.sql`、`supabase/migrations/2026*.sql`（舊的 8 碼日期檔）、`supabase/SQL_ORGANIZATION.md` → `supabase/archive/legacy/`

不使用 Docker（規格 Q4）、不使用 `supabase db push`／`migration repair`（規格 §17 S3）。

- [ ] **Step 1（使用者執行）：** 先確認 `pg_dump --version` 的主版本和 Supabase 的 Postgres 主版本（Dashboard → Settings → Infrastructure）相同；不同時改裝相符版本（例如 `brew install postgresql@<主版本>`）。然後執行 `pg_dump "$DB_URL" --schema-only --schema=public --no-owner > supabase/migrations/20261017000000_baseline.sql`（**保留權限**，不加 `--no-privileges`，這樣 RLS policy 和 GRANT/REVOKE 都進版控）。
- [ ] **Step 2（使用者在 SQL Editor 執行，agent 提供 SQL）：** 查出 public 以外的關鍵物件和外鍵清單，結果貼回給 agent：
  ```sql
  select tgname, pg_get_triggerdef(oid) from pg_trigger where tgrelid='auth.users'::regclass and not tgisinternal;
  select proname, pg_get_function_identity_arguments(oid) args, has_function_privilege('authenticated', oid, 'execute') auth_exec, has_function_privilege('anon', oid, 'execute') anon_exec from pg_proc where proname='exec_sql';
  -- 所有參照 campsites / camping_trips 的外鍵（M2 的合併腳本和還原清單都依這份清單）
  select conrelid::regclass tbl, conname, pg_get_constraintdef(oid) def
  from pg_constraint where contype='f' and confrelid in ('public.campsites'::regclass,'public.camping_trips'::regclass);
  ```
  如果有 auth trigger，就把它的定義附加到 baseline 檔案結尾，並加註解 `-- from auth schema`。外鍵清單貼進 PR 描述。
- [ ] **Step 3：** 搬移舊 SQL。`README.md` 寫一句話：「已被 20261017000000_baseline.sql 取代，僅供歷史參考」。
- [ ] **Step 4：** 在 PR 描述記下 baseline 中確認到的事實：是否有 `total_capacity`、`capacity_zones`、`exec_sql`（含簽名）、`handle_new_user`，campsites 的 RLS 內容（是否擋未審核營區），以及外鍵清單。如果和規格 §15 的假設不同，回報 PM。baseline 不需要套用（它描述的就是正式庫現況），在 PR 描述註明「baseline：不套用」。
- [ ] **Step 5：Commit** `chore(db): add schema baseline and archive legacy SQL`

### Task 1.2：型別由資料庫產生

**Files:** Create `src/types/supabase.ts`（產生）、`tsconfig.api.json`；Modify `package.json`（`"db:types": "supabase gen types typescript --project-id <project ref> --schema public > src/types/supabase.ts"`，project ref 取自 `VITE_SUPABASE_URL` 的子網域）、`tsconfig.json`（references 加 `./tsconfig.api.json`）、`src/types/database.ts`、`src/lib/supabase.ts`、`src/services/supabaseQueries.ts`、`src/composables/useCalendarEvents.ts`

`tsconfig.api.json`：`types: ["node"]`、`include: ["api/**/*.ts", "scripts/**/*.ts"]`、`moduleResolution: "bundler"`、`noEmit`（與 `tsconfig.node.json` 同風格）。如果 `scripts/` 現有檔案因此冒出型別錯誤，只修到能過，或在該檔加 `// @ts-nocheck` 並記錄在 PR 描述（M0 已刪除大部分舊腳本）。

**Interfaces:**
- Produces：`src/types/database.ts` 保留現有所有 export 名稱（`Profile`、`Campsite`、`CampingTrip`、`CampingTripWithCampsite`、`NewCampingTrip`、`CapacityZone`、`GearItem`…），改寫成 `Tables<'x'>`、`TablesInsert<'x'>` 衍生型別。`CapacityZone`、`amenities` 這類 JSONB 欄位，用 `Omit<…> & { capacity_zones: CapacityZone[] | null }` 收窄。

- [ ] **Step 1：** 執行 `grep -rcE "\bany\b|as any|@ts-expect-error" src --include=*.ts --include=*.vue | awk -F: '{s+=$2} END{print s}'`，把數字記在 PR 描述（改版前）。
- [ ] **Step 2：** `npm run db:types`（需要使用者已 `supabase login`；agent 無法登入時，請使用者執行並 commit 產生的檔案），然後改寫 `database.ts`，並在 `createClient<Database>` 套用。
- [ ] **Step 3：** 只拿掉因為型別替換而變得多餘的 `@ts-expect-error` 和 `as any`，其他不動。套用 `createClient<Database>` 後如果冒出大量型別錯誤，允許在呼叫端加暫時的型別轉換，每一處都加註解 `// TODO(types): M5`，並把新增的數量記在 PR 描述（M5 再清，規格 §6.4）。
- [ ] **Step 4：** `npm run typecheck && npm run build` PASS。重跑 Step 1 的指令，記下改版後的數字。
- [ ] **Step 5：Commit** `refactor(types): generate supabase types from database`

### Task 1.3：家庭資料檢查與查詢改寫

**Files:** Modify `src/services/supabaseQueries.ts`（`tripQueries.fetchAll`）、gear 和 events 的對應查詢（實作前先 `grep -rn "family_id" src/services src/composables` 列出實際檔案與行號，寫進 PR 描述）

owner 欄位：`camping_trips.user_id`、`camping_gear.user_id`、`calendar_events.created_by`（`camping_trips`、`camping_gear` 的 `user_id` 都允許 null）。

- [ ] **Step 1（使用者在 SQL Editor 執行，唯讀，規格 §6.3）：** 先 `select id, family_id from profiles;` 找到自己的 user id 和 family id。`family_id` 為 null → 舊查詢和新查詢相同，跳到 Step 2 的第一個分支。不為 null → 執行：
  ```sql
  -- 「舊查詢看得到、新查詢看不到」的筆數；用 is distinct from，owner 為 null 的舊資料也會算進來
  select 'camping_trips' t, count(*) from camping_trips  where family_id = '<fam>' and user_id    is distinct from '<me>'
  union all select 'camping_gear',   count(*) from camping_gear   where family_id = '<fam>' and user_id    is distinct from '<me>'
  union all select 'calendar_events',count(*) from calendar_events where family_id = '<fam>' and created_by is distinct from '<me>';
  ```
  結果貼回給 agent。
- [ ] **Step 2：分支**
  - 三張表都是 0（或沒有家庭）：把 `fetchAll(userId, familyId)` 改成只用 `.eq('user_id', userId)`，簽名改為 `fetchAll(userId: string)`，並更新所有呼叫端；gear 和 events 也同樣改成只看 owner。
  - 任何一張表大於 0：**停下來**，把數字回報給使用者（規格 Q2），請使用者再跑一次同一段 SQL 但把 `count(*)` 換成 `id, title/name` 列出明細；這個 task 先不改查詢。
- [ ] **Step 3：** `npm run typecheck && npm run build` PASS。
- [ ] **Step 4：Commit** `refactor(trips): query by owner only after family data check`

### Task 1.4：API 共用守門與前端呼叫器

**Files:** Create `api/_lib/http.ts`、`api/_lib/auth.ts`、`api/_lib/auth.test.ts`、`api/_lib/supabaseAdmin.ts`、`src/services/api.ts`；Modify `package.json`（如果還沒有，加入 `@vercel/node` 型別；runtime 寫法以 Vercel 當下文件為準）、`api/camping-info.ts`（套上 `requireUser`，其他不動）、`src/services/aiService.ts`（呼叫 `/api/camping-info` 改用 `apiPost` 帶 token）

`api/` 內所有相對 import 一律寫 `.js` 副檔名（例如 `from './_lib/auth.js'`），規格 §7.1。

**Interfaces:**
- Produces：
  - `api/_lib/http.ts`：`class HttpError extends Error { status: number }`、`json(status: number, body: unknown): Response`、`withErrors(handler: (req: Request) => Promise<Response>): (req: Request) => Promise<Response>`（遇到 HttpError 就回傳它的 status 和 `{error}`；其他錯誤回 500，並 log）
  - `api/_lib/auth.ts`：`requireUser(req: Request, deps?: { getUser?: (token: string) => Promise<{ id: string } | null> }): Promise<{ userId: string }>`。預設 `getUser` 用 `supabaseAdmin.auth.getUser(token)`。**不做白名單**（規格 §7.1、§17 S4：Supabase 已關閉新使用者註冊）。
  - `api/_lib/supabaseAdmin.ts`：`export const supabaseAdmin`（service role client，讀取 `SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY`）
  - `src/services/api.ts`：`apiPost<T>(path: string, body: unknown): Promise<T>`，會自動帶上 `Authorization: Bearer <session.access_token>`；回應不是 2xx 時 throw `Error(body.error ?? status)`。
  - 每個 endpoint 的寫法：`export const config = { maxDuration: 60 }`，加上 `export async function POST(req: Request): Promise<Response>`（Web 標準簽名；寫之前先查 Vercel 文件，確認 Node runtime 支援這種寫法）。

- [ ] **Step 1：寫失敗測試** `api/_lib/auth.test.ts`
  ```ts
  // 為什麼：這是防止外人用光 Places/Gemini 額度的唯一防線
  it('沒帶 Authorization 回 401', …expect status 401)
  it('Authorization 不是 Bearer 格式回 401', …)
  it('token 無效（getUser 回 null）回 401', …)
  it('getUser 丟例外時回 401，不是 500', …)
  it('合法 token 回 userId', () => requireUser(req('Bearer t'), { getUser: async()=>({id:'u1'}) }) → resolves { userId:'u1' })
  ```
- [ ] **Step 2：** `npx vitest run api/_lib/auth.test.ts`，Expected：FAIL。
- [ ] **Step 3：** 實作 `http.ts`、`auth.ts`、`supabaseAdmin.ts`、`api.ts`。
- [ ] **Step 4：** 重跑測試，Expected：PASS；再跑 `npm run typecheck && npm run build`（typecheck 已涵蓋 `api/**`）。
- [ ] **Step 5（部署驗證）：** push 後在預覽網址執行 `curl -i -X POST <preview>/api/camping-info`（需要時加 bypass header），Expected：**401**。如果是 500 而且 log 出現 `ERR_MODULE_NOT_FOUND`，就是 import 副檔名或打包問題，修好才能往下。另外在預覽站用營區的 AI 填寫功能試一次，確認帶 token 後仍然正常。
- [ ] **Step 6：Commit** `feat(api): add JWT guard and client api helper`

### Task 1.5：CPBL 伺服器同步＋RLS 修正（同一個 PR 上線）

**Files:** Create `api/_lib/cpbl.ts`、`api/_lib/cpbl.test.ts`、`api/cpbl-sync.ts`、`supabase/migrations/20261017000100_cpbl_rls.sql`；Modify `src/services/cpblService.ts`、設定頁中呼叫清除的 UI（移除「清除整年」按鈕；M3 Task 3.12 會加上「重新同步整年」）、`vite.config.ts`（刪除 `'/api/cpbl'` dev proxy：它是前綴比對，會攔截 `/api/cpbl-sync`；同步改到伺服器後也不再需要）

**Interfaces:**
- Consumes：`requireUser`、`withErrors`、`json`、`supabaseAdmin`（Task 1.4）
- Produces：`POST /api/cpbl-sync` body `{ year: number, month: number }` → `{ upserted: number }`。`cpblService.syncCpblScheduleForYearMonth(year, month)` 的簽名不變，內部改成 `apiPost('/api/cpbl-sync', {year, month})`。
- `clearCpblScheduleForYear` 和它的按鈕在這個 task 移除（規格 Q11：改成「重新同步整年」，因為要檢查 `calendar_events.cpbl_game_id`，等 M3 Task 3.12 欄位建立後才做）。
- `api/_lib/cpbl.ts`：`fetchCpblMonth(year, month, fetchImpl?): Promise<CpblRecord[]>`（抓取和轉換的純邏輯）。`api/cpbl-sync.ts` 只做守門、呼叫、upsert。

- [ ] **Step 1：** 把 `cpblService.ts` 中抓 cpbl.com.tw 的邏輯（取得 anti-forgery token → getgamedatas → 轉成 records）搬到 `api/_lib/cpbl.ts`，並改成直接連 `https://cpbl.com.tw`，不再經過 corsproxy。`api/_lib/cpbl.test.ts` 用 mock fetch 測「回傳資料轉成 records 的欄位對應」和「token 取得失敗時 throw」。`api/cpbl-sync.ts` 用 `supabaseAdmin` upsert，`onConflict: 'game_sno, game_date'`。抓取失敗時回 502，並附上原因（Rule 12）。body 不是 `{year, month}`（整數、month 1–12）時回 400。
- [ ] **Step 2：** migration：
  ```sql
  drop policy if exists "Enable write access for authenticated users" on public.cpbl_schedule;
  drop policy if exists "Enable read access for all users" on public.cpbl_schedule;
  create policy "authenticated read" on public.cpbl_schedule for select to authenticated using (true);
  ```
  如果 Task 1.1 確認 `exec_sql` 存在，而且 `auth_exec` 或 `anon_exec` 為 true，就在同一支 migration 加上 `drop function public.exec_sql(text);`（簽名以 baseline 為準）。
- [ ] **Step 3：** 改 `cpblService.ts`，然後 `grep -rn corsproxy src/ api/` 和 `grep -n "/api/cpbl'" vite.config.ts`，都應該沒有命中。
- [ ] **Step 4：** `npm test && npm run typecheck && npm run build` PASS。
- [ ] **Step 5：Commit** `fix(security): move CPBL sync server-side and restrict cpbl_schedule writes`
- [ ] **Step 6：上線順序（寫進 PR 描述）**：這支 migration 要在 PR 合併、正式站部署完成之後才套用（否則正式站舊前端的同步按鈕會先壞）。順序：PR 合併 → 正式站用新版按一次同步成功 → 使用者備份（Task 1.0）→ 在 SQL Editor 套用 `20261017000100_cpbl_rls.sql` → QA 跑 curl 驗證。預覽站 QA 在套用前只驗證「同步走 API 成功」，RLS 拒絕寫入的 curl 在套用後補驗。

### Task 1.6：營區新欄位與合併標記欄位（給 M2、M4 使用，一次把型別補齊）

**Files:** Create `supabase/migrations/20261017000200_campsite_fields.sql`；重新產生 `src/types/supabase.ts`；Modify `src/types/database.ts`（收窄 `field_sources` 型別）

**Interfaces:**
- Produces：
  ```ts
  export type FieldSource = { source: 'places'|'elevation'|'gemini'|'manual'; confidence: 'high'|'low'|'none'; urls: string[]; confirmed: boolean }
  export type FieldSources = Record<string, FieldSource>
  ```
  `Campsite` 新增 `google_place_id`、`address`、`google_maps_url`、`business_status`、`field_sources: FieldSources`、`merged_into_id`；`CampingTrip` 新增 `merged_into_id`。

- [ ] **Step 1：** migration 內容照規格 §6.2：`alter table public.campsites`（含 `merged_into_id`），以及 `alter table public.camping_trips add column merged_into_id bigint references public.camping_trips(id)`（規格 §17 S1：原本放在 M2 的獨立 migration，併到這裡）。
- [ ] **Step 2：** 使用者先備份（Task 1.0），再在 SQL Editor 套用 migration，然後執行 `npm run db:types && npm run typecheck`，PASS。（只做加法，套用後正式站舊前端不受影響，可以在 PR 合併前套用。）
- [ ] **Step 3：Commit** `feat(db): add place fields, field_sources and merged_into_id`

### M1 QA 驗證清單
- [ ] 第一次備份（Task 1.0）在任何 migration 之前完成，`backup-all` exit 0，`restore.ts` dry-run 差異為 0
- [ ] 所有頁面的行為和 M0 一樣（行程數、營區數、裝備、統計地圖、照片）
- [ ] 設定頁按「同步中職」成功，月曆上看得到比賽；Network 看不到 corsproxy；設定頁沒有「清除整年」
- [ ] （cpbl RLS 套用後）`curl -X POST "$SUPABASE_URL/rest/v1/cpbl_schedule" -H "apikey: $ANON" -H "Authorization: Bearer <使用者 JWT>" -d '{…}'` 回 401 或 403（RLS 拒絕）
- [ ] `curl -X POST <preview>/api/cpbl-sync` 和 `<preview>/api/camping-info` 不帶 token，都回 401（不是 500）
- [ ] Supabase 已關閉新使用者註冊（使用者截圖或口頭確認）
- [ ] 家庭資料檢查的結果已經回報給使用者
- [ ] PR 描述列出每支 migration 的套用狀態（baseline：不套用；cpbl_rls、campsite_fields：已套用＋日期）
- [ ] **檢查點：使用者在預覽網址確認後才合併**

---

# M2：重複資料清理（腳本為主；依序在 M1 之後、M3 之前）

**前置：** M0 的 Task 0.8（停止自動新建營區）和刪除 `cleanup-empty-city.ts` 已在正式站上線；Task 1.0 的備份與還原腳本可用；Task 1.6 的 `merged_into_id` 欄位已套用。

**流程（規格 §8，簡化 §17 S1）：** 備份（驗證可讀）→ 報告 → 使用者確認 → 合併 → 出問題就從備份整體還原。不建 `merge_log`、不做 `unmerge`、不做還原演練、不寫 DB function。

**任務順序：** 2.1 → 2.2 → 2.3 → M2 PR 合併並部署到正式站 → 使用者流程（Task 2.3 Step 5）。

### Task 2.1：營區比對純函式（M4 也會用）

**Files:** Create `src/utils/campsiteMatch.ts`、`src/utils/campsiteMatch.test.ts`

**Interfaces:**
- Produces：
  ```ts
  export interface MatchableCampsite { id: number; name: string; district: string | null; latitude: number | null; longitude: number | null; google_place_id?: string | null; phone?: string | null; merged_into_id?: number | null }
  export type MatchLevel = 'same_place' | 'likely' | 'nearby'
  export interface CampsiteMatch { campsite: MatchableCampsite; level: MatchLevel; distanceM: number | null }
  export function normalizeCampsiteName(name: string): string
  export function bracketContent(name: string): string | null          // 第一組括號（半形或全形）內的文字
  export function isNameSimilar(a: string, b: string): boolean          // 正規化後互相包含或編輯距離 ≤ 2；任一方正規化後為空字串 → false
  export function distanceMeters(a: {latitude:number;longitude:number}, b: {latitude:number;longitude:number}): number   // haversine
  export function editDistance(a: string, b: string): number
  export function matchCampsite(candidate: Omit<MatchableCampsite,'id'>, existing: MatchableCampsite[], opts?: { bracketAware?: boolean }): CampsiteMatch[]  // 依 level 嚴重度、距離排序；bracketAware 給新增入口用（規格 §6.5 括號規則）
  ```
  規則和數值以規格 §6.5 的表格為準（含 300 m–2 km 同名、空字串、單邊缺座標等邊界）。座標欄位一律用 `latitude`/`longitude`，測試也一樣。這支檔案會被 `api/` import，必須是純 TS（Global Constraints）。

- [ ] **Step 1：寫失敗測試**（每個 case 都附「為什麼」的註解）
  ```ts
  expect(normalizeCampsiteName('雲頂露營區（原山林）')).toBe('雲頂')
  // 主幹前綴不能被移除：「拉拉山雲頂」和「雲頂」正規化後不相等（但 likely 規則的「互相包含」仍可能命中，交給距離判斷）
  expect(normalizeCampsiteName('拉拉山 雲頂營地')).toBe('拉拉山雲頂')
  expect(normalizeCampsiteName('台灣ＡＢＣ 營地')).toBe('臺灣abc')
  expect(normalizeCampsiteName('雲頂 Camping')).toBe('雲頂')
  expect(normalizeCampsiteName('露營區')).toBe('')
  // 空字串不算相似（否則只叫「露營區」的資料會和所有營區「互相包含」）
  expect(isNameSimilar('露營區', '雲頂露營區')).toBe(false)
  // same_place
  matchCampsite({…, google_place_id:'P1'}, [{id:1, google_place_id:'P1', …遠處座標}]) → [{level:'same_place'}]
  // likely：120m 內、少一個字
  matchCampsite({name:'雲頂露營', 相距 120m}, [{name:'雲頂露營區'}]) → level 'likely'
  // nearby：250m 內、名稱完全不同
  → level 'nearby'
  // 同名、距離 1.2km → likely（舊座標不可靠，寧可提示）
  // 名稱相似但不相同、距離 1.2km → []
  // 同名但距離 5km：不算重複（Review Focus 4）
  matchCampsite({name:'快樂農場', 台中座標}, [{name:'快樂農場', 苗栗座標}]) → []
  // 任一方沒有座標：同名、同鄉鎮 → likely；同名、不同鄉鎮 → []
  // bracketAware：'雲頂（A區）' vs '雲頂（B區）'、相距 100m → nearby（不是 likely）
  // 已經合併的營區不參與比對
  existing[0].merged_into_id = 9 → []
  ```
- [ ] **Step 2：** Run `npx vitest run src/utils/campsiteMatch.test.ts`，FAIL。
- [ ] **Step 3：** 實作。正規化步驟依規格 §6.5 的順序：trim 空白與全形空白 → 全形英數轉半形 → 「台」轉「臺」 → 移除括號（半形和全形）及括號內容 → 移除通用字（依規格 §6.5 清單，長的先移除，英文不分大小寫）→ 轉小寫。
- [ ] **Step 4：** `npm test && npm run test:tz` PASS。
- [ ] **Step 5：Commit** `feat(campsite): add campsite matching utilities`

### Task 2.2：分群純函式與重複報告

**Files:** Create `scripts/dedupe/plan.ts`、`scripts/dedupe/plan.test.ts`、`scripts/dedupe/report.ts`

**Interfaces:**
- Consumes：`matchCampsite`、`normalizeCampsiteName`（Task 2.1）
- Produces（TS）：
  ```ts
  export interface CampsiteStats { tripCount: number; photoCount: number; filledFields: number }
  export interface DuplicateGroup { groupId: number; confidence: 'high'|'medium'|'low'; members: Array<MatchableCampsite & CampsiteStats>; suggestedKeepId: number; samePark: boolean }
  export function pickKeeper(members: Array<MatchableCampsite & CampsiteStats & { created_at?: string }>): number
  export function nameStem(name: string): string   // 規格 §8：先移除括號和結尾分區字樣，再正規化
  export function groupDuplicates(all: Array<MatchableCampsite & CampsiteStats>): DuplicateGroup[]   // union-find：任何一對 matchCampsite 命中、電話相同（正規化去掉 -、空白）、或同名同鄉鎮（不論距離）就分到同一群；confidence 依規格 §8 步驟 2
  export interface MergeDecision { groupId: number; action: 'merge'|'not_duplicate'|'later'; keepId: number; dropIds: number[] }
  export interface Decisions { campsites: MergeDecision[]; trips: MergeDecision[] }   // decisions.json 的格式，範例見規格 §8 步驟 3
  ```
- `npx tsx scripts/dedupe/report.ts --out <dir>`（**唯讀**，使用者執行）→ `<dir>/report.html`（手機可讀；每一群的卡片顯示所有欄位並排、行程數、照片數、信心等級、建議保留哪一筆、差異欄位、samePark 警告）以及 `<dir>/decisions.json`（`{campsites:[…], trips:[…]}`，每群預設 `action:'later'`）。重複行程另外列一節：`trip_date` 相同，且 `campsite_id` 或正規化的 `campsite_name` 相同。

- [ ] **Step 1：寫失敗測試** `plan.test.ts`
  ```ts
  // pickKeeper 順序：行程數 > 有照片 > 有座標 > 欄位完整 > id 小（為什麼：保留被引用最多的，改動的行程最少）
  pickKeeper([{id:5,tripCount:1,…},{id:3,tripCount:4,…}]) === 3
  pickKeeper(行程數相同，id:8 有照片，id:2 沒有) === 8
  pickKeeper(全部相同) === 最小 id
  // groupDuplicates：A~B、B~C 時，A、B、C 同一群（遞移）
  // same_place 或 likely<300m → 'high'；只靠同名 300m–2km 或沒座標同名同鄉鎮 → 'medium'
  // 電話相同但名稱不同、距離 5 km → 同一群，confidence 'low'
  // 同名同鄉鎮、距離 8 km → 同一群，confidence 'low'（只列不併，交給使用者）
  // nameStem('雲頂A區') === nameStem('雲頂（B區）') === '雲頂'；距離 < 500 m → samePark = true
  ```
- [ ] **Step 2：** FAIL → 實作 `plan.ts` → PASS（`npm test && npm run test:tz`）。
- [ ] **Step 3：** 實作 `report.ts`。使用者對正式庫執行，確認可以產生檔案（M2 PR 合併前就可以先跑，它是唯讀的）。
- [ ] **Step 4：Commit** `feat(dedupe): add duplicate grouping and report`

### Task 2.3：合併腳本與前端隱藏已合併資料（同一個 M2 PR）

**Files:** Create `scripts/dedupe/apply.ts`；Modify `src/services/supabaseQueries.ts`（`tripQueries.fetchAll` 加上 `.is('merged_into_id', null)`）、`src/components/CampsiteLibrary.vue` 以及所有 `from('campsites')` 的列表查詢（加上 `.is('merged_into_id', null)`；**以 id 直接取得單筆時不加**，舊行程仍然要能顯示當時連結的營區）

**Interfaces:**
- Consumes：`Decisions`（Task 2.2）；Task 1.1 Step 2 查出的外鍵清單；`restore.ts`（Task 1.0）
- Produces：`npx tsx scripts/dedupe/apply.ts <decisions.json> [--apply --backup <備份目錄>]`
  - 預設 dry-run：逐群列出「哪幾筆行程（及其他外鍵表）的 campsite_id 會從 X 改成 Y」、「keep 的哪些空白欄位會補值、值從哪一筆來」、行程群的照片改指向，以及每一筆 drop 會被設 `merged_into_id`。
  - `--apply`：沒有 `--backup` 或目錄不存在就拒絕執行。開頭印出萬一失敗要用的還原指令（`restore.ts <備份目錄> --tables <campsites, camping_trips, trip_photos 和外鍵清單中的表> --apply`）。用 service role 先處理全部營區群，再處理行程群（規格 §8 步驟 4）：
    - 營區群：外鍵清單中每張表的 `campsite_id` 從 drop 改成 keep → keep 的欄位是 null、空字串或空陣列時，依 `dropIds` 順序取第一個非空值補上（不補 `id, created_at, created_by, updated_at, is_verified, merged_into_id, google_place_id, field_sources`）→ drop 設 `merged_into_id = keepId`。
    - 行程群：`trip_photos.trip_id` 以及其他參照 `camping_trips.id` 的外鍵從 drop 改成 keep → drop 設 `merged_into_id = keepId`。
    - **任何一步失敗就停止**，印出已完成的群組和還原指令。
    - 結尾自動驗證（規格 §8 步驟 5）：各表總筆數和執行前相同；`select count(*) from camping_trips t join campsites c on c.id=t.campsite_id where c.merged_into_id is not null` 等於 0；照片總數不變。任一項不符就印出還原指令並 exit 1。
  - 不做 `google_place_id` 搬移（M2 時舊營區都還沒有 place_id，規格 §17 S1）。
  - 外鍵清單、補值排除欄位寫成腳本內的常數，PR 描述列出。

- [ ] **Step 1：** 實作 `apply.ts`。補值的「哪些欄位要補」抽成純函式 `fillEmptyFields(keep, drops, excluded)` 寫在 `plan.ts`，在 `plan.test.ts` 加測試：keep 的 null 被第一個 drop 的非空值補上；keep 已有值不覆蓋；排除欄位不補；空陣列視為空（為什麼：合併不能蓋掉保留那筆已有的資料）。
- [ ] **Step 2：** 前端隱藏：執行 `grep -rn "from('campsites')\|from('camping_trips')" src/`，逐一處理列表類查詢。此時還沒有任何合併資料，畫面應該和 M1 完全相同（行程數、營區數不變）。
- [ ] **Step 3：** `npm test && npm run typecheck && npm run build` PASS。
- [ ] **Step 4：Commit** `feat(dedupe): add merge script and hide merged campsites and trips`
- [ ] **Step 5（使用者流程，M2 PR 合併並部署到正式站之後；agent 不執行 `--apply`）：** 使用者看 `report.html` → 在對話中告訴 Claude 各群的決定 → Claude 更新 `decisions.json` → 使用者跑 dry-run，把輸出給 Claude 和使用者一起看 → 使用者執行 `backup-all.ts`，接著 `restore.ts <該目錄> --tables …` dry-run，差異必須是 0 → **立刻**執行 `apply.ts <decisions.json> --apply --backup <該目錄>`（合併期間不要在 app 裡編輯）→ 出問題時執行腳本印出的還原指令。

### M2 QA 驗證清單
- [ ] 合併前的新備份位於 repo 外，`backup-all` exit 0，`restore.ts` dry-run 差異為 0
- [ ] M2 PR（含前端隱藏已合併資料）已在正式站上線後才執行 `--apply`
- [ ] 使用者已經看過 `report.html`，決定也寫進了 `decisions.json`
- [ ] `apply.ts` 結尾的三項自動驗證全部通過（各表總筆數相同、沒有行程指向已合併營區、照片總數不變）
- [ ] 正式站：圖鑑看不到被合併的營區；被改指向的舊行程打開正常，名稱仍是當時的快照
- [ ] **檢查點：使用者在預覽網址確認 M2 PR 後才合併；合併結果由使用者在正式站確認**

---

# M3：行事曆（核心）

### Task 3.1：分類、事件新欄位、回填

**Files:** Create `supabase/migrations/20261017000300_calendar_categories.sql`；重新產生型別；Modify `src/types/database.ts`（export `EventCategory = Tables<'event_categories'>`、`CalendarEventRow = Tables<'calendar_events'>`）、`scripts/backup/backup-all.ts`（表清單加上 `event_categories`）

- [ ] **Step 1：** 依規格 §6.2 撰寫 migration：`event_categories`（含 RLS：owner 可以做所有操作；delete policy 加上 `system_key is null or system_key not in ('camping','baseball')`；**不加** `system_key` trigger，規格 §17 S6）、`calendar_events` 新欄位、`camping_trips.visibility`、`profiles.show_cpbl`。
- [ ] **Step 2：** 回填（同一支 migration，依規格 §6.2 的回填 1～3）。**不加 check constraint，也不加補 `start_date` 的 trigger**（規格 §17 S5）。
- [ ] **Step 3：** 在 migration 檔尾端以註解附上兩段 SQL（使用者手動執行）：
  ```sql
  -- (1) 回填報告（套用後執行，和舊畫面對照）
  select e.id, e.title, e.color old_color, c.name category, e.start_date, e.end_date, e.cpbl_game_id
  from calendar_events e left join event_categories c on c.id = e.category_id order by e.start_time;
  -- (2) 對齊 SQL（M3 PR 合併、正式站換成新前端之後執行一次；規格 §6.2）
  update calendar_events set start_date = (start_time at time zone 'Asia/Taipei')::date,
                             end_date   = (end_time   at time zone 'Asia/Taipei')::date
  where is_all_day;
  ```
- [ ] **Step 4：** 使用者先執行 Task 1.0 的備份，再在 SQL Editor 套用 migration、執行回填報告，和舊畫面對照沒有偏移。
- [ ] **Step 5：** `npm run db:types && npm run typecheck` PASS。
- [ ] **Step 6：Commit** `feat(db): add event categories, all-day dates, visibility and show_cpbl`

### Task 3.2：日期純函式

**Files:** Create `src/utils/dateRange.ts`、`src/utils/dateRange.test.ts`

**Interfaces:**
- Produces：
  ```ts
  export function taipeiYmd(d: Date | string): string          // 用 Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei'})
  export function taipeiMinutes(d: Date | string): number      // 台北當日 00:00 起算的分鐘數
  export function todayYmd(now?: Date): string
  export function addDays(ymd: string, n: number): string      // 純字串運算（Date.UTC），不受系統 TZ 影響
  export function diffDays(a: string, b: string): number       // b - a
  export function eachDay(start: string, end: string): string[] // 含頭尾
  export function weekdayMon0(ymd: string): number             // 0=週一 … 6=週日
  export function taipeiIso(ymd: string, hhmm: string): string // `${ymd}T${hhmm}:00+08:00`
  export function tripRange(trip_date: string, duration_days: number | null): { start: string; end: string } // duration ≤ 0 或 null 時當作 1 天；不含夜衝（夜衝在 tripToView 處理）
  ```
- [ ] **Step 1：寫失敗測試**（為什麼：差一天是行事曆最傷信任的 bug）
  ```ts
  expect(taipeiYmd('2026-10-16T16:30:00Z')).toBe('2026-10-17')   // UTC 晚上 = 台北隔天
  expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  expect(eachDay('2026-10-30','2026-11-02')).toEqual(['2026-10-30','2026-10-31','2026-11-01','2026-11-02'])
  expect(weekdayMon0('2026-10-19')).toBe(0)   // 週一
  expect(tripRange('2026-10-23', 3)).toEqual({ start:'2026-10-23', end:'2026-10-25' })
  expect(tripRange('2026-10-23', 0)).toEqual({ start:'2026-10-23', end:'2026-10-23' })
  expect(tripRange('2026-10-23', null)).toEqual({ start:'2026-10-23', end:'2026-10-23' })
  expect(taipeiMinutes('2026-10-17T11:05:00Z')).toBe(19*60+5)
  ```
- [ ] **Step 2：** FAIL → 實作 → `npm test && npm run test:tz` PASS。
- [ ] **Step 3：Commit** `feat(calendar): add Taipei date utilities`

### Task 3.3：ViewEvent、事件來源轉換、下一趟露營、寫入列轉換

**Files:** Create `src/utils/calendar/viewEvent.ts`、`eventSources.ts`、`eventSources.test.ts`、`eventRow.ts`、`eventRow.test.ts`、`src/utils/nextTrip.ts`、`src/utils/nextTrip.test.ts`

**Interfaces:**
- Consumes：Task 3.2 的所有函式；`EventCategory`、`CalendarEventRow`（Task 3.1）；`CpblSchedule`（`cpblService.ts` 現有的型別）
- Produces：
  ```ts
  // viewEvent.ts
  export type ViewEventSource = 'event' | 'trip' | 'cpbl'
  export interface ViewEvent {
    key: string                 // `${source}:${sourceId}`
    source: ViewEventSource; sourceId: string | number
    title: string; color: string; categoryId: string | null
    allDay: boolean
    startDate: string; endDate: string       // 含頭尾，台北時間
    startMin?: number; endMin?: number       // 只有 timed 事件有：startDate 當日分鐘數、endDate 當日分鐘數
    past: boolean                            // endDate < today
    tripStatus?: 'planning' | 'booked'       // 只有 trip 有；planning 用虛線/淡色（規格 §5.3）
    nightRushDate?: string                   // 只有夜衝的 trip 有＝trip_date - 1；此時 startDate 也等於它
  }
  // 「多天事件」＝ allDay && endDate > startDate（規格 §5.4）。timed 事件即使跨午夜也不是多天事件。
  // eventSources.ts
  export function isRakutenGame(g: { home_team_name: string; visiting_team_name: string }): boolean   // 任一隊名包含「樂天」
  export function eventToView(e: CalendarEventRow, cats: Map<string, EventCategory>, personalColor: string, today: string): ViewEvent
  export function tripToView(t: { id:number; trip_date:string; duration_days:number|null; status:string; night_rush:boolean|null; campsite_id:number|null; campsite_name:string|null; campsites?: {name:string}|null }, campingColor: string, campingCategoryId: string|null, today: string): ViewEvent   // allDay true；有夜衝時 startDate = trip_date - 1
  export function gameToView(g: CpblSchedule, baseballColor: string, today: string): ViewEvent   // 全天單日；title = `⚾ ${visiting} vs ${home}`
  export interface FeedInput { events: CalendarEventRow[]; trips: TripLike[]; games: CpblSchedule[]; categories: EventCategory[]; showCpbl: boolean; hiddenCategoryIds: Set<string>; today: string }
  export function buildFeed(i: FeedInput): ViewEvent[]   // 依 startDate、allDay 優先、startMin 排序
  // eventRow.ts
  export interface EventInput { title: string; description: string | null; categoryId: string; allDay: boolean; startDate: string; endDate: string; startTime?: string; endTime?: string; cpblGameId?: string | null }  // HH:mm
  export function toEventRow(i: EventInput): Pick<TablesInsert<'calendar_events'>, 'title'|'description'|'category_id'|'is_all_day'|'start_date'|'end_date'|'start_time'|'end_time'|'cpbl_game_id'|'visibility'>
  export function fromEventRow(e: CalendarEventRow): EventInput
  // nextTrip.ts
  export interface TripLike { id: number; trip_date: string; duration_days: number | null; status: string; night_rush: boolean | null; merged_into_id?: number | null }
  export function pickNextTrip<T extends TripLike>(trips: T[], today: string): T | null
  ```

- [ ] **Step 1：寫失敗測試** `eventSources.test.ts`
  ```ts
  // 全天事件讀 start_date/end_date
  eventToView({is_all_day:true,start_date:'2026-10-17',end_date:'2026-10-19',…}) → {allDay:true,startDate:'2026-10-17',endDate:'2026-10-19'}
  // Review Focus 2：start_date 為 null 時（M3 合併前舊前端寫入、或 SQL Editor 手動新增），退回用 start_time 的台北日期，事件不能消失
  eventToView({is_all_day:true,start_date:null,start_time:'2026-10-17T04:00:00Z',end_time:'2026-10-17T04:00:00Z'}) → startDate '2026-10-17', endDate '2026-10-17'
  // 有時段的跨午夜事件：不是多天事件
  eventToView({is_all_day:false,start_time:'2026-10-17T14:00:00Z',end_time:'2026-10-17T17:00:00Z'}) → allDay false, startDate '2026-10-17', endDate '2026-10-18', startMin 1320, endMin 60
  // 顏色跟著分類；category_id 為 null 時用 personalColor
  // 行程：duration_days 3 → endDate +2；status cancelled 和 merged_into_id 不為 null 的行程不出現在 buildFeed
  // 夜衝（為什麼：前一晚就要出發，月曆空白會排到別的事）：trip_date '2026-10-23'、night_rush true → startDate '2026-10-22'、nightRushDate '2026-10-22'；buildFeed 中 10/22 有這趟
  // status 'planning' → tripStatus 'planning'
  // 舊行程 campsite_id 為 null：title 用 campsite_name 快照；兩者都空時 title 為「露營」，不能從 feed 消失
  // 只保留樂天的比賽：兄弟 vs 統一 不出現
  // Review Focus 5：showCpbl=false → 沒有 source 'cpbl' 的項目，但 category=棒球的使用者事件仍在
  // Review Focus 5：使用者事件 cpbl_game_id = G1 時，比賽 G1 的疊加項目不出現
  // hiddenCategoryIds 包含露營分類的 id → 行程不出現
  // past：endDate < today → true
  ```
  `eventRow.test.ts`
  ```ts
  // 為什麼：全天事件的真正資料是 start_date/end_date；start_time/end_time 是 NOT NULL 舊欄位，寫台北 00:00，
  // 而且它的台北日期必須等於 start_date，M3 合併後的對齊 SQL 才不會改到新版寫入的事件（規格 §6.2，§17 S5）
  toEventRow({allDay:true,startDate:'2026-10-17',endDate:'2026-10-18',…}) → start_time '2026-10-17T00:00:00+08:00', end_time '2026-10-18T00:00:00+08:00', start_date '2026-10-17', end_date '2026-10-18', visibility 'private'
  taipeiYmd(toEventRow(全天 x).start_time) === x.startDate；end_time 同理
  toEventRow({allDay:false,startDate:'2026-10-17',endDate:'2026-10-17',startTime:'09:00',endTime:'10:00'}) → start_date null, start_time '2026-10-17T09:00:00+08:00'
  fromEventRow(toEventRow(x)) 的關鍵欄位和 x 相同（round trip）
  ```
  `nextTrip.test.ts`（為什麼：這張卡置頂在首頁，挑錯會直接誤導出發安排）
  ```ts
  today '2026-10-17'
  // 進行中的行程優先於未來的行程：{trip_date:'2026-10-16',duration_days:3} vs {trip_date:'2026-10-20'} → 前者
  // 夜衝的前一天：{trip_date:'2026-10-18',night_rush:true} vs 進行中的行程 → 夜衝那一趟
  // cancelled 不算；昨天已經結束的不算；沒有符合的回 null
  // 同一天有兩筆 → id 小的
  ```
- [ ] **Step 2：** FAIL → 實作 → `npm test && npm run test:tz` PASS。
- [ ] **Step 3：Commit** `feat(calendar): add event source mapping, row conversion and next-trip picker`

### Task 3.4：月格與多天橫條排版

**Files:** Create `src/utils/calendar/monthLayout.ts`、`monthLayout.test.ts`

**Interfaces:**
- Consumes：`ViewEvent`、`addDays`、`weekdayMon0`、`diffDays`
- Produces：
  ```ts
  export function buildMonthWeeks(year: number, month: number /*1-12*/): string[][]  // 週一起始，只產生必要的週數（4–6），前後補鄰月日期
  export interface WeekBar { event: ViewEvent; row: number; startCol: number; span: number; continuesBefore: boolean; continuesAfter: boolean }
  export interface WeekLayout { bars: WeekBar[]; dots: Record<string, ViewEvent[]>; cpblDays: Set<string> }
  export function layoutWeek(week: string[], events: ViewEvent[], maxBars?: number /*=2*/): WeekLayout
  ```
  規則：`allDay && endDate > startDate` 的事件畫成 bar；其餘畫成 dot，timed 事件在它涵蓋的**每一天**各一個 dot（跨午夜就兩天各一個）；`source==='cpbl'` 不畫 dot，只放進 `cpblDays`。夜衝行程的 bar 第一格（`nightRushDate`）用淡色；`tripStatus==='planning'` 的 bar 用虛線框。bar 的排序是 startDate 早的優先、天數長的優先、最後比 key，採 greedy 分配第一個可用的 row；row ≥ maxBars 的 bar 改成每天一個 dot。

- [ ] **Step 1：寫失敗測試**
  ```ts
  buildMonthWeeks(2026, 10)[0][0] === '2026-09-28'   // 10/1 是週四
  buildMonthWeeks(2026, 2).length === 5    // 2026-02-01 是週日 → 第一週 1/26–2/1，最後一週 2/23–3/1
  buildMonthWeeks(2026, 2)[4][6] === '2026-03-01'
  // 跨週的 bar：10/23(五)–10/27(二) → 第一週 startCol 4、span 3、continuesAfter；第二週 startCol 0、span 2、continuesBefore
  // 三個重疊的多天事件、maxBars=2 → 第 3 個變成每天一個 dot
  // 首尾不重疊的兩個 bar 共用 row 0
  // cpbl 比賽只出現在 cpblDays
  // timed 22:00–02:00（10/17–10/18）→ 不是 bar；10/17 和 10/18 的 dots 各有一個
  ```
- [ ] **Step 2：** FAIL → 實作 → PASS。
- [ ] **Step 3：Commit** `feat(calendar): add month grid and multi-day bar layout`

### Task 3.5：週檢視、日檢視時間格排版

**Files:** Create `src/utils/calendar/timeGridLayout.ts`、`timeGridLayout.test.ts`

**Interfaces:**
- Produces：
  ```ts
  export interface PositionedEvent { event: ViewEvent; top: number; bottom: number; col: number; cols: number }  // top/bottom 是分鐘數 0–1440
  export function layoutDay(ymd: string, events: ViewEvent[]): PositionedEvent[]   // 只處理 allDay=false 且涵蓋 ymd 的事件；跨日事件截到當日範圍
  export function allDayFor(ymd: string, events: ViewEvent[]): ViewEvent[]        // 只收 allDay=true 且涵蓋 ymd 的事件（含多天、行程、cpbl）
  ```
  演算法：依 top 排序，分成重疊群（`a.bottom > b.top` 才算重疊，**首尾剛好相接不算**），群內 greedy 分欄，`cols` 等於該群的最大欄數。長度小於 30 分鐘的事件顯示高度最少 30（只在呈現時處理，`bottom` 不改）。

- [ ] **Step 1：寫失敗測試**
  ```ts
  // 09–10 和 10–11 → 兩個都是 col 0、cols 1（首尾相接不算重疊）
  // 09–11 和 10–12 → cols 2，col 分別是 0 和 1
  // 跨午夜 22:00–02:00：10/17 那天 top 1320、bottom 1440；10/18 那天 top 0、bottom 120
  // 全天事件不在 layoutDay 的結果裡，而在 allDayFor 的結果裡
  // 跨午夜 22:00–02:00 不在 10/17、10/18 的 allDayFor 結果裡
  ```
- [ ] **Step 2：** FAIL → 實作 → PASS。
- [ ] **Step 3：Commit** `feat(calendar): add time grid overlap layout`

### Task 3.6：資料層與 singleton composable

**Files:** Create `src/services/db/categories.ts`、`categories.test.ts`、`events.ts`、`profile.ts`、`src/composables/useEventCategories.ts`、`src/composables/useCalendarFeed.ts`；Modify `src/composables/useTrips.ts`、`useUserProfile.ts`、`useCalendarEvents.ts`（改成 singleton）、`src/App.vue`（在 `supabase.auth.onAuthStateChange` 的 `SIGNED_OUT` 事件呼叫各 composable 的 `reset()`；現在 `SettingsView.vue:522` 直接 `signOut()`，不會經過 `App.vue` 的 `handleLogout`）

**Interfaces:**
- Consumes：`buildFeed`、`toEventRow`、`EventInput`（Task 3.3）；`getCpblSchedule(start, end)`（現有）
- Produces：
  ```ts
  // services/db/categories.ts
  export const categoryQueries = { list(): Promise<EventCategory[]>; ensureDefaults(): Promise<void>; create(name: string, color: string): Promise<EventCategory>; update(id: string, patch: { name?: string; color?: string; sort_order?: number }): Promise<void>; remove(id: string): Promise<void> }
  // ensureDefaults（PM 決定（審查））：先 list；使用者**完全沒有任何分類**時才 insert 5 個預設分類，否則什麼都不做。
  //   理由：用 upsert 補齊會把使用者刪掉的工作/家庭/個人加回來，也會撞 unique(owner_id,name)；
  //   露營、棒球由 migration 回填，又有 delete policy 禁止刪除、UI 不提供修改 system_key，不會消失（規格 §17 S6）。
  //   呼叫時機：useEventCategories.load() 第一次執行時（list 回傳空陣列才呼叫）。
  // services/db/events.ts
  export const eventQueries = { listAll(): Promise<CalendarEventRow[]>; create(i: EventInput): Promise<CalendarEventRow>; update(id: string, i: EventInput): Promise<void>; remove(id: string): Promise<void> }
  // services/db/profile.ts
  export const profileQueries = { setShowCpbl(userId: string, v: boolean): Promise<void> }
  // composables（模組層級 ref；做法參考 useNotification.ts）
  useEventCategories(): { categories: Ref<EventCategory[]>; bySystemKey: ComputedRef<Record<string, EventCategory>>; load(): Promise<void>; create; update; remove; reset() }
  useCalendarEvents(): { events: Ref<CalendarEventRow[]>; load(); create(i); update(id,i); remove(id); reset() }
  useUserProfile(): 既有欄位 + { showCpbl: Ref<boolean>; setShowCpbl(v: boolean): Promise<void> }   // 樂觀更新，失敗時復原並 notify
  useCalendarFeed(): { feed: ComputedRef<ViewEvent[]>; hiddenCategoryIds: Ref<Set<string>>; loadGames(fromYmd: string, toYmd: string): Promise<void> }  // hiddenCategoryIds 存在 localStorage key 'cal.hiddenCategories'，讀寫都要包 try/catch
  ```
  `listAll` 會抓使用者的全部事件，不做範圍查詢（單一使用者、資料量小，Rule 2）。`useTrips` 改成 singleton，但保留它現有的回傳形狀，`App.vue` 仍然可以照舊把它傳給舊頁面。

- [ ] **Step 1：** 實作。component 裡不可以出現 `supabase.from`，這一層全部放在 services。
- [ ] **Step 1b：寫測試** `categories.test.ts`（mock supabase client）：沒有任何分類 → insert 5 筆；已有任一分類（例如使用者刪掉「工作」後只剩 4 筆）→ 不 insert（為什麼：使用者刪掉的分類不能被加回來）；連續呼叫兩次只 insert 一次。
- [ ] **Step 2：** `npm test && npm run typecheck && npm run build` PASS。
- [ ] **Step 3：Commit** `feat(calendar): add data services and singleton composables`

### Task 3.7：分類管理

**Files:** Create `src/components/settings/CategorySettings.vue`；Modify `src/views/SettingsView.vue`（加上一個 `currentView === 'categories'` 的選單項目）

**Interfaces:** Consumes `useEventCategories`（Task 3.6）

- [ ] **Step 1：** 介面：列表（色點、名稱、排序的上下箭頭）→ 點一筆可以改名，並從 7 色色盤挑顏色 → 「新增分類」。`system_key` 是 camping 或 baseball 的分類不顯示刪除按鈕。刪除其他分類前用 `useConfirm` 確認，提示文字是「這個分類的事件會變成無分類（顯示為個人色）」。名稱重複時，顯示 DB unique 錯誤轉成的友善訊息。
- [ ] **Step 2：** `npm run build` PASS；在預覽環境手動新增、改色、刪除各一次。
- [ ] **Step 3：Commit** `feat(settings): add category management`

### Task 3.8：行事曆首頁（月檢視、列表、tab、FAB）

**Files:** Create `src/components/calendar/CalendarHome.vue`、`CalendarHeader.vue`、`MonthGrid.vue`、`AgendaList.vue`、`NewItemSheet.vue`、`DayListSheet.vue`；Modify `src/router/index.ts`（`''` 改成 lazy `CalendarHome`、`calendar` 改成 `redirect: '/'`、其他路由改成 lazy import）、`src/layouts/MainLayout.vue`（tab 改成 行事曆/露營/(+)/營地/統計；FAB 開 `NewItemSheet`）、`src/style.css`（補上 `primary-200/300/700/800`；`font-display` 改由 MainLayout 移除）

**Interfaces:**
- Consumes：`useCalendarFeed`、`buildMonthWeeks`、`layoutWeek`、`isHoliday`、`todayYmd`、`useTripModal`（Task 0.8）
- Produces：`CalendarHome` 讀取 query `view`（`month`|`week`|`day`，預設 `month`）和 `date`（YYYY-MM-DD，預設今天），用 `router.replace` 更新 query。`NewItemSheet` emit `pick: 'event' | 'trip' | 'campsite'`，並帶上 `date?: string`。`AgendaList` props 是 `{ items: ViewEvent[]; from: string; to: string; highlight?: string }`，emit `open(ev: ViewEvent)`。選中的日期存在模組層級 ref `selectedDate`（`useCalendarFeed` 內），FAB 讀它當預設日期。

- [ ] **Step 1：** 依規格 §5.3 實作：月格（dot 最多 3 個、bar `h-4 rounded-full`、⚾ 角標、假日紅字和小字、今天加 ring、過去的事件 `opacity-50`、規劃中行程虛線、夜衝第一格淡色）。列表依日期分組，範圍規則見規格 §5.3。點某一天**只依規格 §5.3 的唯一規則**：那天在列表範圍內且有事件 → 捲過去並高亮 1.5 秒；範圍外或沒有事件 → 開 `DayListSheet`（空狀態附「＋在這天新增」）。
- [ ] **Step 2：** FAB 的處理：`MainLayout` 的 FAB 改成打開 `NewItemSheet`，不再 `$emit('add')`。選 `event` 開 Task 3.9 的 `EventEditorSheet`（這個 task 先放 TODO 佔位並 emit）；選 `trip` 呼叫 `useTripModal().openNew(selectedDate)`，TripModal 用 `initialDate` 帶入日期；「新增營區」選項在 M3 **先不渲染**（由 Task 4.5 加回 `NewItemSheet`）。
- [ ] **Step 3：** `npm run build` PASS；在 375px 寬度下確認沒有水平捲軸。
- [ ] **Step 4：Commit** `feat(calendar): add calendar home with month grid and agenda`

> Step 2 的 TODO 佔位必須在 Task 3.9 移除，Task 3.9 的驗證會檢查這一點。

### Task 3.9：事件詳情與新增／編輯 sheet

**Files:** Create `src/components/calendar/EventEditorSheet.vue`、`EventDetailSheet.vue`、`CpblGameSheet.vue`（唯讀比賽資訊＋「加入我的棒球事件」）；Modify `CalendarHome.vue`（接上這三個 sheet）

**Interfaces:** Consumes `useCalendarEvents`、`useEventCategories`、`EventInput`/`fromEventRow`、`getCpblSchedule`、`isRakutenGame`

- [ ] **Step 1：** 依規格 §5.5 實作。表單欄位有標題（必填）、分類 chip（右側 + 會開一個小 sheet，可以直接新增分類）、全天開關、開始和結束日期、時間（全天開關關閉時顯示）、備註。結束日期早於開始日期時，自動改成開始日期，並在下方顯示提示文字。如果開始日期當天有樂天比賽，顯示「⚾ 這天有桃猿比賽：客 vs 主 [套用]」，按下套用後：標題改成 `⚾ 客 vs 主`、分類設為棒球、`cpblGameId` 設為該場比賽。新增模式選了露營分類時，關閉這個 sheet，呼叫 `useTripModal().openNew(startDate)`。**編輯模式下露營分類 chip 停用**（規格 §5.5）。
- [ ] **Step 2：** 點 `source==='trip'` 的項目呼叫 `useTripModal().openEdit(trip)`；點 `event` 開 `EventDetailSheet`（有編輯和刪除；刪除前用 `useConfirm` 確認）；點 `cpbl` 開 `CpblGameSheet`，附「加入我的棒球事件」按鈕（開 EditorSheet 並預先套用比賽資料）。
- [ ] **Step 3：** `grep -rn "TODO" src/components/calendar/` 沒有命中；`npm run build` PASS。
- [ ] **Step 4：Commit** `feat(calendar): add event editor and detail sheets`

### Task 3.10：週檢視、日檢視

**Files:** Create `src/components/calendar/WeekView.vue`、`DayView.vue`；Modify `CalendarHeader.vue`（月、週、日切換，以及 ‹ 今天 ›）

**Interfaces:** Consumes `layoutDay`、`allDayFor`、`eachDay`、`addDays`

- [ ] **Step 1：** 依規格 §5.4 實作。時間軸每小時 48px，預設捲到 07:00；只有今天顯示紅色的現在時間線（每分鐘更新）；全天區最多顯示 3 行，可以展開；週檢視點日期表頭就切到 `?view=day&date=`。日檢視的多天事件標示「第 n/N 天」。行程事件在日檢視的全天區要顯示當天天氣：沿用 `useTripWeather` 的資料，抓不到就不顯示。swipe 不是必做項目。
- [ ] **Step 2：** `npm run build` PASS；建立以下三種事件，在 375px 下檢查：09–10、09:30–11、22:00 到隔天 02:00。
- [ ] **Step 3：Commit** `feat(calendar): add week and day views`

### Task 3.11：置頂下一趟露營卡、天氣海拔校正與假日資料

**Files:** Create `src/components/calendar/PinnedTripCard.vue`、`src/utils/altitudeTemp.ts`、`src/utils/altitudeTemp.test.ts`；Modify `src/composables/useTripWeather.ts`（溫度改用校正值，規格 §5.11）、`src/utils/holidays.ts`（補上 2027 年的資料）、`src/utils/holidays.test.ts`、`src/composables/useTravelTime.ts`（刪除 `HOLIDAYS_2026`，改用 `isHoliday`）、`AgendaList.vue`（頂端放卡片）

**Interfaces:**
- Consumes `pickNextTrip`、`useTripWeather`、`useTravelTime`；從 `NextTripCard.vue` 沿用天氣和車程的呈現邏輯（可以抽出子元件，也可以直接複製必要的部分；`NextTripCard.vue` 在 Task 3.12 刪除前仍然存在）
- Produces：
  ```ts
  // altitudeTemp.ts（規格 §5.11，§14 Q7）
  export const LAPSE_RATE_C_PER_M = 0.006   // 約每 1000 m 降 6°C
  export function correctTemp(tempC: number, siteAltitudeM: number | null, gridElevationM: number | null): number  // 任一海拔為 null 時原值回傳
  export function isAltitudeCorrected(siteAltitudeM: number | null, gridElevationM: number | null): boolean
  ```
  `useTripWeather` 新增 `altitudeCorrected: Ref<boolean>` 和 `siteAltitude: Ref<number | null>`；`processWeatherData` 把每個小時的 `temperature_2m` 先經過 `correctTemp(溫度, 營區海拔, data.elevation)`，之後的每日最高/最低溫、夜溫 < 10°C 判斷、濕帳分析都用校正後的值。**不加** `&elevation=` 參數（避免重複校正）。

- [ ] **Step 0（查證）：** 查 Open-Meteo forecast API 文件，確認回應中的 `elevation` 欄位是預報實際使用的海拔，結果和查證日期寫進 PR 描述。如果不是，停下來回報 PM（規格 §15）。
- [ ] **Step 1：寫失敗測試**
  - `altitudeTemp.test.ts`（為什麼：山區營地夜溫被高估，低溫警告會漏報，使用者可能沒帶夠保暖裝備）：`correctTemp(15, 1500, 500)` ≈ 9；`correctTemp(15, 300, 500)` ≈ 16.2（營區比格點低時溫度上修；數值比較用 `toBeCloseTo`）；`correctTemp(15, null, 500) === 15`、`isAltitudeCorrected(null, 500) === false`；夜溫原始 12°C、營區比格點高 800 m → 校正後 7.2°C，低於 10°C 會觸發警告。
  - `holidays.test.ts` 加上：`isHoliday('2027-01-01')` 為 truthy；`isHoliday('2027-10-10')` 為 truthy。為什麼：2027 年的連假如果沒有資料，車程的塞車提示會全部失效。
- [ ] **Step 2：** 依照**人事行政總處公告的 2027 年辦公日曆表**補上資料，並在檔案中以註解寫明資料來源網址。如果查不到正式公告，**停下來回報**，不要用猜的。實作 `altitudeTemp.ts` 並接進 `useTripWeather`。
- [ ] **Step 3：** 實作 PinnedTripCard。高度大約 160px，內容依規格 §5.3：營區名、狀態 pill（規劃中／已訂位；規劃中提示「還沒訂位」）、`M/D（週）–M/D（週）`、`N天N-1夜`（有夜衝時前面加「夜衝＋」）、`還有 N 天` 或 `進行中 第 n 天`、每日天氣（最高/最低溫、降雨機率，**溫度是海拔校正後的數字**；夜間低溫低於 10°C 時標出；`altitudeCorrected` 為 true 時顯示一行小字「已依海拔校正（營區 N m）」）、車程（前面加「約」；連假時顯示塞車提示）、建議出發時間一行（沿用 `NextTripCard.vue:211-233` 的算法：進場時間或夜衝時間減車程）、收帳日濕帳提示一行（`useTripWeather` 的 `analyzePackUpWeather`，沒風險時不顯示）、帳篷小圖（`trip.tent.image_url`）、導航按鈕（有 `campsites.google_place_id` 時開 `https://www.google.com/maps/dir/?api=1&destination=<encodeURIComponent(名稱)>&destination_place_id=<id>`；沒有時座標以 `campsites.latitude` 為優先，再用 `trip.latitude`，開 `destination=lat,lng`）。超過 16 天時顯示「預報尚未開放」。舊行程沒有營區也沒有座標時，顯示營區名稱快照，不查天氣和車程。沒有下一趟時，顯示一行提示並附新增入口。
- [ ] **Step 4：** `npm test && npm run test:tz && npm run build` PASS。在預覽站打開一筆高海拔營區的行程（TripModal 的天氣區塊也要），確認溫度和「已依海拔校正」都正確。
- [ ] **Step 5：Commit** `feat(calendar): add pinned next-trip card, altitude-corrected weather and 2027 holidays`

### Task 3.12：桃猿開關、重新同步整年、移除舊行事曆、統計摘要搬家

**Files:** Create `src/components/calendar/CpblToggle.vue`；Modify `CalendarHeader.vue`、`api/_lib/cpbl.ts`、`api/_lib/cpbl.test.ts`、`api/cpbl-sync.ts`、`src/services/cpblService.ts`、`src/views/SettingsView.vue`（中職區塊加「重新同步整年」按鈕）、`src/views/StatsView.vue`（頂端加上 `StatsHeader`）、`src/App.vue`（移除對 HomeView 和 CalendarView 的 props 傳遞）；Delete `src/components/HomeView.vue`、`NextTripCard.vue`（如果 Task 3.11 已完全取代它的功能）、`CalendarView.vue`、`CalendarSelectionModal.vue`、`CalendarEventList.vue`、`EventModal.vue`、`src/types/calendarView.ts`

**Interfaces:**
- Consumes `useUserProfile().showCpbl / setShowCpbl`、`useCalendarFeed().loadGames`、`fetchCpblMonth`（Task 1.5）
- Produces（規格 §6.2「重新同步整年」，§14 Q11）：
  ```ts
  // api/_lib/cpbl.ts
  export function staleGameIds(existing: Array<{ id: string; game_sno: number; game_date: string }>, official: CpblRecord[], boundIds: Set<string>): string[]
  //   回傳「existing 中、(game_sno, game_date) 不在 official 裡、而且 id 不在 boundIds」的 id
  export async function resyncYear(year: number, deps: { fetchMonth: typeof fetchCpblMonth; db: … }): Promise<{ upserted: number; deleted: number }>
  //   逐月（1–12）抓取；任何一個月 throw → 整個中止，不 upsert、不刪除；全部成功後 upsert，
  //   再查該年度 existing 與 calendar_events 中非 null 的 cpbl_game_id，刪除 staleGameIds 的結果
  ```
  `POST /api/cpbl-sync` 新增 body `{ year: number, resyncYear: true }` → `{ upserted, deleted }`。`cpblService` 新增 `resyncCpblYear(year)`。

- [ ] **Step 1：寫失敗測試** `api/_lib/cpbl.test.ts` 加上（為什麼：被綁定的比賽一刪掉，使用者事件的 `cpbl_game_id` 會被 set null，同一場比賽就會出現兩次，Review Focus 5）：
  - 官方已沒有、也沒被綁定的舊日期比賽 → 在 `staleGameIds` 結果裡
  - 官方已沒有、但被綁定的比賽 → 不在結果裡
  - 官方仍有的比賽 → 不在結果裡
  - 某個月抓取失敗 → `resyncYear` reject，`db` 的 upsert 和 delete 都沒有被呼叫
- [ ] **Step 2：** FAIL → 實作 → PASS。設定頁的「重新同步整年」按下前用 `useConfirm` 說明「會刪除官方已取消或改期的舊比賽，已加入你行事曆的比賽不受影響」，完成後 notify `新增/更新 N 場、移除 M 場`。
- [ ] **Step 3：** CpblToggle 依規格 §5.3 實作：ON 時是 `bg-[#9d1c32] text-white`，OFF 時是灰框。切換時呼叫 `setShowCpbl`。
- [ ] **Step 4：** 刪除舊元件。如果舊的隊伍顏色表還有用到，搬到 `src/constants/cpblTeams.ts`。執行 `grep -rn "CalendarView\|EventModal\|CalendarSelectionModal\|HomeView" src/`，應該沒有命中。
- [ ] **Step 5：** `npm test && npm run typecheck && npm run build` PASS。
- [ ] **Step 6：Commit** `feat(calendar): add Rakuten toggle, CPBL year resync and remove legacy calendar/home`

### M3 QA 驗證清單（375×812、390×844；實機 PWA 由使用者在預覽確認時順便看）
- [ ] 首頁從上到下依序是：月曆、置頂卡（有狀態、天氣、約車程、建議出發時間、帳篷小圖、導航）、依日期分組的列表
- [ ] 建立以下事件，在月、週、日三個檢視都正確：全天單日、全天 10/30–11/2（跨週又跨月）、09:00–10:00、22:00 到隔天 02:00（月格上兩天各一個點、不是橫條）
- [ ] 天氣溫度是海拔校正後的數字，並顯示「已依海拔校正（營區 N m）」；沒有營區海拔的行程不顯示這行
- [ ] 有夜衝的行程，前一天有淡色的夜衝段；規劃中的行程是虛線
- [ ] 編輯事件時改變分類，顏色立刻跟著變；刪除事件會先確認
- [ ] 預設 5 個分類都在；新增分類並改色；露營和棒球分類沒有刪除鍵；刪除「工作」後重新整理，不會被加回來
- [ ] 露營行程用露營分類的顏色顯示成 bar；點擊會開 TripModal；FAB → 露營會開 TripModal，而且帶入選中的日期
- [ ] 樂天開關：OFF 時沒有 ⚾；ON 時只有樂天的比賽；重新整理後狀態維持；自建的棒球事件不受開關影響
- [ ] 比賽的「套用／加入我的棒球事件」之後，同一天只出現一筆；接著按「重新同步整年」，這筆事件仍綁定同一場比賽、沒有重複
- [ ] 國定假日用紅字，並顯示假日名稱
- [ ] 點今天以後、有事件的日子 → 列表捲到那天並高亮；點當月已過去的日子或沒有事件的日子 → 開 DayListSheet（列出全部，或空狀態＋新增）
- [ ] 舊事件和 Task 3.1 的回填報告逐筆對照，日期沒有偏移
- [ ] 把 Mac 系統時區改成 UTC，重新整理 Chrome 再看一次，結果相同
- [ ] `/calendar` 會轉址到 `/`；統計頁頂端有統計摘要
- [ ] QA 在正式資料上建立的測試事件，標題都以 `[QA]` 開頭，測完全部刪除
- [ ] **檢查點：使用者在預覽網址確認後才合併**
- [ ] **合併後（使用者）：** 執行 Task 3.1 檔尾的對齊 SQL 一次，再打開正式站確認全天事件日期正確

---

# M4：新增營區（貼連結或打名稱 → 草稿 → 確認）

**前置（使用者手動）：** 規格 §12「M4 前」。開始前，實作者要先查 Places API (New) 和 Gemini 的官方價目與文件，把查證結果（包含日期）寫進 PR 描述，並回寫規格 §7.3。**逐欄核對**：每個 field mask（尤其 `nationalPhoneNumber`、`websiteUri`、`rating`、`userRatingCount`、`businessStatus`、`primaryTypeDisplayName`）落在哪個 SKU、每月免費額度多少；discover 加了評分若會落入 Enterprise，就拿掉評分（規格 §7.3 取捨規則）。同時查 Text Search 是否支援 `includedType=campground`。

### Task 4.1：Maps URL 解析與選項常數

**Files:** Create `api/_lib/mapsUrl.ts`、`api/_lib/mapsUrl.test.ts`、`src/constants/campsiteOptions.ts`、`src/utils/campsiteName.ts`、`src/utils/campsiteName.test.ts`；Modify `src/components/CampsiteFilterSheet.vue`、`src/components/CampsiteEditModal.vue`（改成 import 共用的常數）

**Interfaces:**
- Produces：
  ```ts
  export const ALLOWED_MAPS_HOSTS = ['maps.app.goo.gl','goo.gl','google.com','www.google.com','maps.google.com','google.com.tw','www.google.com.tw','maps.google.com.tw'] as const
  export function isAllowedMapsHost(url: string): boolean          // 只接受 https
  export interface ParsedMapsUrl { name?: string; lat?: number; lng?: number; query?: string; cid?: string }
  export function parseMapsUrl(url: string): ParsedMapsUrl | null   // 支援 /place/<名稱>/@lat,lng、!3d<lat>!4d<lng>、?q=、?cid=、?query=
  export function resolveShortUrl(url: string, fetchImpl?: typeof fetch): Promise<string>  // redirect:'manual'，最多跟 5 跳，每一跳都檢查 host；不是 google 網域就 throw HttpError(400)
  // campsiteOptions.ts：PLAYGROUND_OPTIONS（以 CampsiteEditModal 的順序為準）、WATER_OPTIONS、SCENERY_OPTIONS、SPOT_TYPE_OPTIONS（加上「車邊」）、ZONE_TYPE_OPTIONS、BOOKING_METHOD_OPTIONS
  // campsiteName.ts
  export function cleanCampsiteName(displayName: string): string   // 遇到第一個 ｜、|、 - （前後有空白的連字號）就截斷，再 trim
  ```
- [ ] **Step 1：寫失敗測試**
  ```ts
  parseMapsUrl('https://www.google.com/maps/place/%E9%9B%B2%E9%A0%82%E9%9C%B2%E7%87%9F%E5%8D%80/@24.6,121.2,15z') → {name:'雲頂露營區',lat:24.6,lng:121.2}
  parseMapsUrl('…/data=!3d24.61!4d121.23') → 以 !3d/!4d 為準（它比 @ 更精確）
  parseMapsUrl('https://maps.google.com/?q=雲頂露營區') → {query:'雲頂露營區'}
  parseMapsUrl('https://maps.google.com/?cid=123') → {cid:'123'}
  parseMapsUrl('not a url') → null
  // Review Focus 3
  isAllowedMapsHost('https://www.facebook.com/x') === false
  isAllowedMapsHost('http://maps.app.goo.gl/x') === false
  isAllowedMapsHost('https://google.com.evil.io/x') === false
  resolveShortUrl('https://maps.app.goo.gl/a', fakeFetch(→ 302 Location: http://169.254.169.254/)) rejects status 400
  resolveShortUrl(…302 → https://www.google.com/maps/place/…) resolves 完整 URL
  cleanCampsiteName('雲頂露營區｜親子｜雲海｜免裝備') === '雲頂露營區'
  cleanCampsiteName('A-Ma 營地') === 'A-Ma 營地'   // 沒有空白的連字號不截斷
  ```
- [ ] **Step 2：** FAIL → 實作 → PASS。用 `grep -n "_OPTIONS = \[" src/components/` 確認兩個元件已經不再各自定義。
- [ ] **Step 3：Commit** `feat(campsite): add maps url parsing, shared options and name cleaning`

### Task 4.2：Places 包裝與名稱候選 API

**Files:** Create `api/_lib/places.ts`、`api/_lib/places.test.ts`、`api/_lib/placesSearch.ts`（handler 邏輯：驗證 body → `textSearch` → 取前 5 筆）、`api/_lib/placesSearch.test.ts`、`api/places-search.ts`（薄層：`requireUser` → `placesSearch`）。**不建** `api/places-search.test.ts`（會被部署成 function）。

**Interfaces:**
- Consumes：`requireUser`、`withErrors`、`json`
- Produces：
  ```ts
  export interface PlaceLite { placeId: string; name: string; address: string; lat: number; lng: number; rating?: number; ratingCount?: number; mapsUrl?: string; businessStatus?: 'OPERATIONAL'|'CLOSED_TEMPORARILY'|'CLOSED_PERMANENTLY'; typeLabel?: string }
  export async function textSearch(query: string, opts?: { bias?: {lat:number;lng:number;radiusM:number}; pageToken?: string; pageSize?: number; forDiscover?: boolean }, fetchImpl?: typeof fetch): Promise<{ places: PlaceLite[]; nextPageToken?: string }>   // forDiscover 時 field mask 加上 discover 需要的欄位（規格 §7.2）
  export interface PlaceDetail extends PlaceLite { addressComponents: Array<{ longText: string; types: string[] }>; phone?: string; website?: string; businessStatus?: 'OPERATIONAL'|'CLOSED_TEMPORARILY'|'CLOSED_PERMANENTLY'; mapsUrl: string }
  export async function placeDetails(placeId: string, fetchImpl?: typeof fetch): Promise<PlaceDetail>
  // POST /api/places-search  { query: string } → { candidates: PlaceLite[] }（最多 5 筆）
  ```
  要求：key 只能放在 `X-Goog-Api-Key` header；field mask 照規格 §7.2 原文，`languageCode: 'zh-TW'`，`regionCode: 'TW'`。query 為空字串或超過 100 字時回 400。
- [ ] **Step 1：寫失敗測試**（mock fetch）：送出的 request 帶有 `X-Goog-Api-Key` header，URL 裡**沒有** `key=`；`X-Goog-FieldMask` 和規格完全相同；空的 query 回 400；沒有 auth 回 401。
- [ ] **Step 2：** FAIL → 實作 → PASS。
- [ ] **Step 3：Commit** `feat(api): add places wrapper and places-search endpoint`

### Task 4.3：草稿 API（先只接 Places＋海拔）

**Files:** Create `api/_lib/draft.ts`、`api/_lib/draft.test.ts`、`api/campsite-draft.ts`

**Interfaces:**
- Consumes：`resolveShortUrl`、`parseMapsUrl`、`isAllowedMapsHost`、`textSearch`、`placeDetails`、`cleanCampsiteName`、`parseTaiwanLocation`（`src/utils/googleMaps.ts`；如果它的輸入型別和 Places (New) 的 `addressComponents` 不同，就在 `draft.ts` 寫一個 adapter，不修改原函式）
- Produces：
  ```ts
  export interface DraftField<T> { value: T | null; source: FieldSource['source']; confidence: FieldSource['confidence']; urls: string[]; needsReview: boolean }
  export interface CampsiteDraft {
    placeId: string; rawName: string
    fields: {
      name: DraftField<string>; city: DraftField<string>; district: DraftField<string>; address: DraftField<string>
      latitude: DraftField<number>; longitude: DraftField<number>; altitude: DraftField<number>
      phone: DraftField<string>; google_maps_url: DraftField<string>; business_status: DraftField<'open'|'temporarily_closed'|'closed'>
      // Task 4.4 加入：spot_types, playground_features, water_features, scenery_features, amenities, check_in_time, check_out_time, night_rush_time, shower_restrictions, booking_method, booking_timing, zone_config, campsite_notes(只放 AI 摘要)
    }
    warnings: string[]          // 例如 'gemini_failed'
  }
  export function placeToDraft(d: PlaceDetail, altitude: number | null): CampsiteDraft
  export async function fetchElevations(points: Array<{lat: number; lng: number}>, fetchImpl?: typeof fetch): Promise<Array<number | null>>   // https://api.open-meteo.com/v1/elevation，多組座標一次呼叫（逗號分隔）；單點也用它
  export async function resolveMapsUrl(mapsUrl: string, deps?): Promise<{ candidates: PlaceLite[]; preselectId?: string }>
  // POST /api/campsite-draft
  //   { mapsUrl, resolveOnly: true } → { candidates, preselectId? }        （不呼叫 Gemini）
  //   { placeId, skipAi?: boolean }  → CampsiteDraft
  ```
  `resolveMapsUrl` 流程（PM 決定（審查），規格 §5.7「不自動猜」）：先檢查 host → 跟隨轉址 → 解析。
  - 解析出 name 和座標：`textSearch(name, {bias: 座標 500 m})` 取前 5 筆當候選；第 1 筆距離 < 300 m **而且** `isNameSimilar` 成立時才回 `preselectId`。
  - 只有 query：`textSearch(query)` 取前 5 筆當候選，**一律不回 `preselectId`**。
  - 只有 cid 或什麼都沒解析出來：回 422 `{error:'cannot_resolve', hint:'請改用名稱搜尋'}`。
  `campsite-draft.ts` 只做薄層；邏輯在 `api/_lib/draft.ts`。
- [ ] **Step 1：寫失敗測試** `draft.test.ts`
  ```ts
  // Places 來源的欄位：source 'places'、confidence 'high'、needsReview false
  // altitude：source 'elevation'；fetchElevations 失敗時 value null、needsReview true
  // fetchElevations 3 個點只發一次 request
  // name 預設用 cleanCampsiteName 的結果，rawName 保留原文
  // businessStatus 對應：CLOSED_PERMANENTLY → 'closed'
  // 「臺/台」地址可以正確解析出 city/district
  // resolveMapsUrl（為什麼：共識要求不自動猜，選錯營區使用者不會發現）：
  //   ?q= 連結 → 有候選、沒有 preselectId
  //   有座標、第 1 筆在 120 m 且名稱相似 → preselectId = 第 1 筆
  //   有座標、第 1 筆在 800 m → 沒有 preselectId
  ```
- [ ] **Step 2：** FAIL → 實作 → PASS。
- [ ] **Step 3：Commit** `feat(api): add campsite-draft endpoint with places and elevation`

### Task 4.4：草稿接上 Gemini＋Google 搜尋

**Files:** Create `api/_lib/gemini.ts`；Modify `api/_lib/draft.ts`、`draft.test.ts`、`api/campsite-draft.ts`

**Interfaces:**
- Produces：
  ```ts
  export interface GeminiFieldResult { value: unknown; confidence: 'high'|'low'|'none'; sources: string[] }
  export async function researchCampsite(input: { name: string; address: string; mapsUrl: string }, fetchImpl?: typeof fetch): Promise<Record<string, GeminiFieldResult>>
  export const HIGH_RISK_FIELDS = ['spot_types','shower_restrictions','night_rush_time','booking_method','booking_timing','check_in_time','check_out_time','amenities'] as const   // 規格 §5.7（審查後加入進退場時間和設備）
  export function mergeGemini(draft: CampsiteDraft, g: Record<string, GeminiFieldResult>): CampsiteDraft
  ```
  - 模型使用 `process.env.GEMINI_MODEL`，沒有設定時直接 throw（不要寫死 `-latest`）。啟用 `tools: [{ google_search: {} }]`，key 放在 `x-goog-api-key` header。
  - 如果 grounding 和 `responseSchema` 無法同時使用（要查當下的官方文件），就改成在 prompt 要求「只輸出 JSON」，再用 `JSON.parse` 搭配手寫的型別守門。grounding metadata 裡的來源網址要合併進每個欄位的 `sources`。
  - Prompt 必須包含：「只根據搜尋結果回答；查不到就回 `confidence:'none'` 且 `value:null`；標籤只能從以下清單挑選：<campsiteOptions 的內容>」。另外要求一個 `ai_summary` 欄位：把最後一段山路（小客車能否上、是否需四驅）、手機訊號（分電信）、熄燈與安靜時間、寵物、電源、最近採買點、包區整理成條列摘要，查不到的項目寫「查無資料」；它寫進 `campsite_notes` 的 AI 摘要段落，一律 `needsReview: true`（規格 §5.7）。
  - 來源網域：規格 Q9 已決定接受露營樂、愛露營等 Google 搜尋結果當來源，**不排除任何網域**；但每個 Gemini 填的欄位都必須帶 `sources`（沒有來源就 `needsReview: true`），草稿頁顯示可點開的來源連結。
  - `skipAi: true` 時完全不呼叫 Gemini，回傳 Places＋海拔草稿。
  - `mergeGemini` 的規則：Places 已經有值的欄位不覆蓋。標籤欄位要過濾掉不在選項清單裡的值。`needsReview` 在以下任一情況為 true：`confidence !== 'high'`、`sources` 是空的、欄位屬於 `HIGH_RISK_FIELDS`。
  - Gemini 失敗或逾時（45 秒）時，回傳 Places 的草稿，並在 `warnings` 加上 `'gemini_failed'`，HTTP 仍然回 200。
- [ ] **Step 1：寫失敗測試**（`draft.test.ts` 加上）
  ```ts
  // 為什麼：營位類型和訂位規則一旦錯了，要到現場才會發現（規格 §5.7）
  mergeGemini(draft, { spot_types: {value:['雨棚'],confidence:'high',sources:['https://x']} }).fields.spot_types.needsReview === true
  // 沒有來源 → needsReview
  // 不在選項清單裡的標籤被濾掉：scenery_features ['雲海','超美夕陽'] → ['雲海']
  // Places 已經有 phone 時，Gemini 的 phone 不覆蓋
  // confidence 'none' → value null、needsReview true
  // check_in_time 即使 confidence 'high' 且有來源 → needsReview true（平日假日常不同）
  ```
- [ ] **Step 2：** FAIL → 實作 → PASS。
- [ ] **Step 3：** 使用者提供一個真實的營區連結，在預覽環境呼叫一次，把回應的 JSON 貼進 PR 描述，並記錄耗時。
- [ ] **Step 4：Commit** `feat(api): research campsite facilities with Gemini grounding`

### Task 4.5：新增營區畫面

**Files:** Create `src/components/campsite/AddCampsiteFlow.vue`（整個流程，不依賴路由；emit `saved(campsite)`、`cancel`）、`AddCampsiteView.vue`（路由頁，只包住 `AddCampsiteFlow`）、`DraftFieldRow.vue`；Modify `src/router/index.ts`（加上 lazy route `library/new`）、`src/components/CampsiteLibrary.vue`（加上「新增」入口）、`src/components/calendar/NewItemSheet.vue`（顯示「新增營區」選項）

**Interfaces:**
- Consumes：`apiPost('/api/places-search'|'/api/campsite-draft')`、`matchCampsite`（`bracketAware: true`）、`CampsiteDraft`、`FieldSources`
- Produces：`AddCampsiteFlow` props `{ initialPlaceId?: string; initialName?: string }`。路由 `/library/new?placeId=&returnTo=<path>`：存檔成功後，如果有 `returnTo`，就 `router.replace({ path: returnTo, query: { campsiteId: String(id) } })`（不要用字串相加，`returnTo` 本身可能帶 query），否則導到圖鑑。TripModal 不走路由，見 Task 4.6。

- [ ] **Step 1：** 依規格 §5.7 實作四個階段：輸入（貼連結或打名稱）→ **候選**（貼連結時呼叫 `resolveOnly`，名稱時呼叫 places-search；有 `preselectId` 時預先選取，但一律要按「產生草稿」）→ 產生中（分步進度，可以用 `AbortController` 取消；拿到 Places 資料後顯示「跳過 AI，先存基本資料」，按下改用 `skipAi: true` 重新取草稿或直接用已有的 Places 欄位）→ 確認（頂端固定顯示 Places 的名稱和地址，以及「很多營區的設施只在 FB 粉專，查不到的欄位請自己確認」）。`DraftFieldRow` props 為 `{ label: string; field: DraftField<unknown>; }`，emit `confirm` 和 `edit(value)`，依三級規則呈現樣式。
- [ ] **Step 2：** 重複檢查：在候選階段（有 placeId 和座標，**呼叫 Gemini 之前**）用 `matchCampsite` 比對已收錄的營區。有 `same_place` 或 `likely` 時，顯示「可能已經收錄：XX [查看] [仍要新增]」。
- [ ] **Step 3：** 存檔：轉成 `campsites` insert，包含 `google_place_id`、`created_by`、`field_sources`（每個欄位的 `confirmed` 等於使用者是否按過確認或修改過）。如果還有未確認的 ⚠️ 欄位，先用 `useConfirm` 跳出「還有 N 個欄位未確認，要直接存嗎？」。遇到 unique 衝突（`google_place_id`）時，顯示「已經收錄」，並附上連結。
- [ ] **Step 4：** 草稿只存在 component state。離開頁面前，如果有未存的草稿，要先確認。**不能寫進 DB**。
- [ ] **Step 5：** `npm run build` PASS。
- [ ] **Step 6：Commit** `feat(campsite): add paste-link / search-name campsite creation flow`

### Task 4.6：TripModal 改接新增營區流程、移除前端 Maps JS 和舊的 AI

**Files:** Modify `src/components/TripModal.vue`（自由輸入名稱和自動新建營區已在 Task 0.8 移除；本 task 把「＋新增營區」從開 `CampsiteEditModal` 改成在 TripModal 上方開全螢幕 sheet 包住 `AddCampsiteFlow`，`saved(campsite)` 時直接選回，**不換路由**，已填表單不遺失）、`src/App.vue`（移除 Task 0.8 加的 CampsiteEditModal 疊層）、`src/views/SettingsView.vue`（出發地搜尋改用 `/api/places-search`）、`src/components/CampsiteEditModal.vue`（**直接刪除** Places Autocomplete 和 AI 填寫按鈕，不加替代按鈕；「補查設施」放在 M5-3 的營地詳情）、`index.html`（移除 Maps script 和 `initGoogleMaps`）、`vite.config.ts`（移除 html transform）、`package.json`（移除 `@types/google.maps`）、`tsconfig.app.json`（移除 `"types"` 中的 `"google.maps"`，否則 typecheck 會失敗）；Delete `api/camping-info.ts`、`src/services/aiService.ts`、`src/components/GooglePlaceSearch.vue`、`src/types/google-maps.d.ts`

- [ ] **Step 1：** 執行 `grep -rn "google.maps\|GooglePlaceSearch\|aiService\|camping-info\|VITE_GOOGLE_MAPS" src/ index.html vite.config.ts tsconfig*.json`，修到沒有命中為止。
- [ ] **Step 2：** 舊行程如果沒有 `campsite_id`，在編輯時顯示快照名稱和「綁定營區」按鈕，**不強制**綁定也可以存檔（只有新增時強制，規格 Q5 決定 B）。
- [ ] **Step 3：** `npm run typecheck && npm run build && grep -rE "AIza|maps.googleapis.com" dist/ ; echo $?`。Expected：build 成功，grep 結果為 1。
- [ ] **Step 4：Commit** `feat!: require campsite on new trips; remove client-side Google Maps and legacy AI`

### M4 QA 驗證清單
- [ ] 貼 `maps.app.goo.gl` 短網址、完整的 place URL、`?q=` URL → 都先出現候選（`?q=` 沒有預先選取），按「產生草稿」才產生；貼 FB 網址或亂打 → 出現友善錯誤，頁面不壞
- [ ] 打名稱、按搜尋 → 出現最多 5 個候選；選了候選才會產生草稿（打字時不會自動送出請求，在 Network 驗證）
- [ ] 按「產生草稿」之前，Network 沒有任何帶 Gemini 的請求（`resolveOnly` 回應很快）；草稿頁頂端顯示 Places 名稱和地址
- [ ] 草稿的每個欄位都有來源 pill；營位類型、熱水、夜衝、訂位、進退場時間、設備一律顯示 ⚠️；查無資料的欄位留空；備註有 AI 摘要段落並標 ⚠️
- [ ] 「跳過 AI，先存基本資料」可以只存 Places＋海拔的欄位
- [ ] 不存檔就離開 → DB 沒有多出任何一筆（在 Supabase table editor 確認筆數）
- [ ] 貼已收錄營區的連結 → 提示可能已收錄
- [ ] 存檔時還有 ⚠️ 未確認 → 跳一次確認；存檔後在營地詳情看得到 ⚠️ 標記
- [ ] TripModal 新增露營時必須選營區；「＋新增營區」走完流程後回來，營區已經自動選好，已填的日期和其他欄位都還在；舊的無營區行程仍然能編輯和存檔
- [ ] 設定頁的出發地搜尋正常
- [ ] DevTools Sources 和 Network 中沒有 `maps.googleapis.com`、`AIza`；`curl` 不帶 token 打 `places-search`、`campsite-draft`、`cpbl-sync` 都回 401；`/api/camping-info` 回 404（已刪除）
- [ ] Vercel 部署的 function 只有 `api/` 根目錄的 endpoint，沒有任何 `*.test` function（Vercel 部署頁的 Functions 清單）
- [ ] **檢查點：使用者在預覽網址確認後才合併**

---

# M4b：找新營區

### Task 4b.1：搜尋 API

**Files:** Create `api/_lib/discover.ts`（邏輯）、`api/_lib/discover.test.ts`、`api/campsite-discover.ts`（薄層）。**不建** `api/campsite-discover.test.ts`。

**Interfaces:**
- Consumes：`textSearch`（`forDiscover: true`）、`fetchElevations`、`matchCampsite`、`supabaseAdmin`
- Produces：`POST /api/campsite-discover` `{ city: string; district?: string; altitudeMin?: number; keywords: string[]; freeText?: string; pageToken?: string }` → `{ results: Array<PlaceLite & { altitude: number | null; nearbyName?: string }>; excludedCount: number; closedCount: number; nextPageToken?: string }`
  - query 格式：`露營 ${city}${district ?? ''} ${keywords.join(' ')} ${freeText ?? ''}`（trim 後最多 120 字；用「露營」而不是「露營區」，規格 §5.8）。`includedType=campground` 依 M4 前置查證結果決定是否加。
  - 每次呼叫只抓一頁，最多 20 筆。前端最多再按一次「再找更多」（共 2 頁）。
  - 排除規則：`businessStatus === 'CLOSED_PERMANENTLY'` 排除並計入 `closedCount`；`CLOSED_TEMPORARILY` 保留但前端加註。拿全部 `merged_into_id is null` 的 campsites 做比對，`same_place` 或 `likely` 的結果排除並計入 `excludedCount`；`nearby` 的結果保留，但加上旗標 `nearbyName`。
  - 有 `altitudeMin` 時，對剩下的結果**一次**查所有點的海拔（`fetchElevations`），低於門檻的排除；查不到海拔的保留（`altitude: null`）。
  - city 缺少或 keywords 超過 8 個時回 400。
- [ ] **Step 1：寫失敗測試**（mock textSearch、DB、elevation）：已收錄的 place_id 會被排除，`excludedCount` 為 1；同名但距離 5 km 的不排除；永久歇業的被排除、`closedCount` 為 1；`altitudeMin: 1000` 時，800 m 的被排除、`null` 的保留，而且海拔只呼叫一次。
- [ ] **Step 2：** FAIL → 實作 → PASS。
- [ ] **Step 3：Commit** `feat(api): add campsite-discover endpoint`

### Task 4b.2：搜尋畫面

**Files:** Create `src/components/campsite/DiscoverCampsitesView.vue`；Modify `src/router/index.ts`（lazy route `library/discover`）、`CampsiteLibrary.vue`（加上入口）、`AddCampsiteView.vue`（支援 `?placeId=` 直接進入產生中階段）

- [ ] **Step 1：** 依規格 §5.8 實作。縣市和鄉鎮的選項來自 `TAIWAN_LOCATIONS`；海拔 chip；設施 chip 來自 `campsiteOptions`，區塊標題寫「設施關鍵字（只影響搜尋結果，不保證有）」，結果頁標題列下方固定一行「設施條件不保證有，請產生草稿後確認」（規格 Q6 決定 (a)）；搜尋按鈕下方加上提示「每次搜尋會呼叫 Google，約 2–5 秒」。結果卡顯示類型標籤、暫停營業加註、附近已有營區提示；設施欄顯示「未知（產生草稿時才查）」。按「產生草稿」時，`router.push({ path: '/library/new', query: { placeId, returnTo: '/library/discover' } })`。搜尋條件、結果和已產生草稿的 placeId，存在模組層級的 ref，回到這頁時保留。
- [ ] **Step 2：** `npm run build` PASS。
- [ ] **Step 3：Commit** `feat(campsite): add discover new campsites view`

### M4b QA 驗證清單
- [ ] 用使用者熟悉的縣市搜尋 → 列出的都是還沒收錄的營區，而且顯示「已排除 N 個」
- [ ] 海拔 1000+ 篩選有效；「再找更多」最多一次
- [ ] 產生草稿 → 存檔 → 回到列表：條件和結果都還在，那張卡顯示「✓ 已產生草稿」
- [ ] 同一個條件再搜一次，剛剛存的營區已經被排除
- [ ] **檢查點：使用者在預覽網址確認後才合併**

---

# M5：其他功能適度重構（四個獨立 PR，順序不拘）

共同規則：外觀和行為不變。每個 PR 開工前，先從**正式站（main）**截下該範圍的手機截圖當「改版前」基準（M0、M3 已經改過畫面，所以不用更早的截圖）；PR 附上前後對照。M5 雖然「順序不拘」，仍然一次只開一個 PR，依序合併。範圍內的 `supabase.from` 搬到 `src/services/db/<表>.ts`，延續 `xxxQueries` 的物件模式。在 PR 描述記錄 `any` 數量和目標檔案行數的前後差異。

### Task 5-1：設定頁拆檔
**Files:** Create `src/components/settings/OriginSettings.vue`、`CpblSettings.vue`（同步按鈕＋樂天開關）、`GearSettings.vue`（包住 `TentManagement`、`GearROIView`）；Modify `src/views/SettingsView.vue`（保留 `currentView` 狀態機，只負責選單和組合；`SystemAssetManager` 只有 `is_admin` 時才顯示）
- [ ] 拆分後，`wc -l src/views/SettingsView.vue` 小於 250 → build PASS → 手動比對各子頁 → Commit `refactor(settings): split settings sections`

### Task 5-2：TripModal 拆檔
**Files:** Create `src/composables/useTripForm.ts`（`initFormData`、`resetForm`、`hasChanges`、`toPayload`）、`src/composables/useTripForm.test.ts`、`src/components/trip/TripCampsitePicker.vue`、`TripStartLocation.vue`、`TripCampsiteInfoPanel.vue`、`TripGearSection.vue`、`TripReviewSection.vue`；Modify `src/components/TripModal.vue`
- [ ] **先寫測試**：`toPayload` 在新增模式下「填了 `campsite_name` 但 `campsite_id` 為 null」時要 throw（為什麼：防止重複營區再次出現）；`campsite_id` 和 `campsite_name` 都空時也要 throw（規格 Q5 決定 B：新增露營必須選營區）；編輯模式下舊行程沒有 `campsite_id` 時不 throw；`duration_days` 為 0 時改成 1；`hasChanges` 在只開啟、沒有修改時為 false
- [ ] 新增模式只顯示規劃欄位，事後紀錄的欄位收合在「出發後再填」（規格 §5.6）
- [ ] `wc -l TripModal.vue` 小於 400 → `npm test && build` PASS → Commit `refactor(trip): split TripModal`

### Task 5-3：營地圖鑑與 CampsiteEditModal 拆檔
**Files:** Create `src/composables/useCampsiteForm.ts`(+test)、`src/components/campsite/CampsiteBasicFields.vue`、`CampsiteAmenities.vue`、`CampsiteRules.vue`、`CampsiteCapacityZones.vue`、`CampsiteLayoutImage.vue`、`CampsiteBookingInfo.vue`；Modify `CampsiteEditModal.vue`、`CampsiteLibrary.vue`（營地詳情顯示 `field_sources` 的 ⚠️ 未確認標記，並可以補確認；新增一鍵導航（有 place_id 時用 `destination_place_id`，規格 §5.3）和撥號；可以手動修正座標；有 `google_place_id` 時提供「補查設施」：呼叫 `/api/campsite-draft { placeId }`，結果以草稿形式逐欄顯示（沿用 `DraftFieldRow`），使用者確認的欄位才寫入；隱藏 `booking_platform` 相關的 UI，例如「剛開放」標籤）
- [ ] **先寫測試**：`useCampsiteForm` 的 `toPayload` 在使用者修改某個欄位時（包含手動修正 `latitude`/`longitude`），把 `field_sources[欄位].confirmed` 設為 true，source 改成 `'manual'`（為什麼：使用者改過的值不能再被標示成 AI 推測）
- [ ] `wc -l CampsiteEditModal.vue` 小於 400 → test/build PASS → Commit `refactor(campsite): split edit modal and show field review state`

### Task 5-4：統計、裝備、照片、App.vue 收尾
**Files:** Modify `src/views/StatsView.vue`、`GearROIView.vue`、`TentManagement.vue`、`PhotoGallery.vue`、`useTripPhotos.ts`（只修型別，移到 services）、`src/App.vue`（拿掉 `<router-view>` 的 props 和 emits 傳遞，改成讓各頁面自己使用 singleton composable）
- [ ] App.vue 的 `<router-view>` 不再傳遞 trips/profile 相關的 props 和 emits（全域 TripModal 由 `useTripModal` 控制）→ 所有頁面行為不變 → build PASS → 清掉 Task 1.2 留下的 `// TODO(types): M5` 型別轉換（數量記在 PR）→ Commit `refactor(app): use singleton composables instead of router-view props`

### M5 QA 驗證清單（每個 PR 都要跑）
- [ ] 設定的各子頁、行程的新增和編輯（含照片上傳、帳篷選擇時顯示小帳篷圖）、統計的台灣地圖、裝備 ROI、照片牆，都和改版前的截圖一致
- [ ] Console 沒有 error；在 375px 下沒有水平捲軸
- [ ] **檢查點：使用者在預覽網址確認後才合併**

---

## 全案結束檢查
- [ ] 規格 §11 的每一列完成標準都已打勾
- [ ] `npm test && npm run test:tz && npm run typecheck && npm run build` 全綠
- [ ] `any` 數量和 M1 Task 1.2 的基準相比，數字確實下降，並記錄在最後一個 PR；`grep -rn "TODO(types)" src` 沒有命中
- [ ] `supabase/migrations/` 裡每支 migration（baseline 除外）在對應 PR 描述中都標示「已套用到正式庫（日期）」
- [ ] 規格 §14 的答案都已落實：Q1 測試資料 `[QA]`、Q3 不加欄位、Q4 沒有任何 Docker 步驟、Q5 新增露營必須選營區（Task 0.8、4.6、5-2）、Q6 設施只當關鍵字（Task 4b.2）、Q7 海拔校正（Task 3.11）、Q9 附來源連結（Task 4.4）、Q10 rollback 註解、Q11 重新同步整年（Task 3.12）；Q2 若 Task 1.3 檢查不為 0，已依使用者答案處理
- [ ] 規格 §15 的每一項假設，都記錄了查證結果（成立或不成立）
