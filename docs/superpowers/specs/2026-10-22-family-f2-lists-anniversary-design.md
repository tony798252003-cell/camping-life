# F2 共用清單＋F3 每年重複事件 — 設計

日期：2026-10-22
前提：F1（家庭共用行事曆、家庭成員設定）已完成。
狀態：使用者授權「待做的功能都可以做，問題最後再問」；以下取捨為預設，最後一併請使用者確認。

## F2 共用清單

### 目標
夫妻共用的採買清單、露營要帶的東西、家裡待辦。兩人都能新增、勾選，畫面即時同步。

### 資料（新 migration，正式庫需同意後套用）
- `family_lists`：`id uuid pk`、`family_id uuid not null → families`、`title text not null`、`sort_order int`、`created_by uuid`、`created_at`。
- `family_list_items`：`id uuid pk`、`list_id uuid not null → family_lists on delete cascade`、`text text not null`、`done boolean default false`、`done_by uuid null`、`done_at timestamptz null`、`sort_order int`、`created_by uuid`、`created_at`。
- RLS：同家庭成員可 select／insert／update／delete（`family_id = user_family_id()`，items 透過 list 判斷）。
- 開啟 Supabase Realtime（`supabase_realtime` publication 加入兩張表），免費額度內。
- 沒有家庭時（`user_family_id()` 為 null）：清單功能顯示「先建立或加入家庭」。

### 畫面
- 不改底部導覽列（維持 5 個分頁）。
- 首頁在「本週行程」下方新增「清單」區塊：每張清單一列，顯示名稱與「未完成 N 項」；點進去是清單頁。
- 清單頁：最上方新增輸入框（Enter 新增）；未完成在上、已完成收在下方「已完成 N 項」可展開；勾選有動畫但不用確認；左滑或長按刪除改用既有 ConfirmDialog；右上「清除已完成」。
- 預設建立三張清單（第一次進入時、家庭沒有任何清單才建立）：採買、露營要帶、家裡待辦。
- 視覺沿用 R6／C5 的風格：白卡、20px 圓角、天空藍主色，勾選用 primary-600。

## F3 每年重複事件（生日、紀念日）

### 資料
- `calendar_events` 新增 `recurrence text null check (recurrence in ('yearly'))`。
- 僅支援全天事件每年重複；2/29 在非閏年顯示於 2/28。

### 畫面
- 新增／編輯事件：全天開啟時出現「每年重複」開關。
- 行事曆、首頁本週行程：在可見範圍內展開每年的那一天；標題後加「（第 N 年）」，N = 今年 − 起始年，起始年當年不加。
- 點開重複事件編輯的是整個系列（不做單次例外）。

## 不在這次範圍
- 手機推播提醒：需要產生 VAPID 金鑰、設定 Vercel 環境變數與排程，最後再請使用者決定。
- 首頁大改版成家庭儀表板：先只加清單區塊，其餘維持。

## 驗收
- 單元測試：每年重複展開（跨年、閏年 2/29）、「第 N 年」、清單排序與已完成分組、預設清單只建一次。
- build、`npm test`、`npm run test:tz` 通過。
