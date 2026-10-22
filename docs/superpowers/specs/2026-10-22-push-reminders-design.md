# 手機推播提醒 — 設計

日期：2026-10-22
狀態：使用者授權先做完、最後再確認。未設定金鑰時功能完全隱藏，不影響現有使用。

## 目標
前一天晚上提醒隔天的事，費用 0（Web Push＋Vercel Cron 免費額度）。

## 提醒內容（每天台灣時間 20:00 跑一次）
每位有訂閱的使用者，收到一則彙總通知（不是每件事一則）：
- 明天的事件：自己的 private＋同家庭的 shared（與 RLS 可見範圍一致）。
- 明天出發的露營行程：「明天出發：{營區}」。
- 明天的每年重複事件（生日、紀念日），含「第 N 年」。
- 沒有任何事就不發。
- 點通知開啟 app 首頁。
- 隱私：通知文字（事件標題、營區名稱）會直接顯示在鎖定畫面，旁人看得到；私人事件也一樣。
- 重複送出：通知帶 `tag`／`topic`（`reminder-YYYY-MM-DD`），同一天重跑 cron 會取代而不是疊加。
- 訂閱歸屬：endpoint 全域唯一，前端用 `claim_push_subscription` RPC 認領（換帳號登入同一支瀏覽器時改歸新帳號），登出前會移除本機訂閱。

## 架構
- 資料表 `push_subscriptions`：`id`、`user_id`（default auth.uid()）、`endpoint text unique`、`p256dh`、`auth`、`created_at`、`last_success_at`。RLS：只有自己能 select／insert／delete。
- 前端訂閱：設定頁新增「提醒通知」區塊（開關）。按下時要求通知權限 → `pushManager.subscribe(VAPID 公鑰)` → 寫入 `push_subscriptions`（直接走 supabase client＋RLS）。關閉時 unsubscribe 並刪除該列。
  - 沒有 `VITE_VAPID_PUBLIC_KEY`、或瀏覽器不支援 Push（例如 iOS 未加到主畫面）時：區塊顯示原因，不顯示開關。
- Service worker：vite-plugin-pwa 維持 generateSW，用 `workbox.importScripts` 載入 `public/push-sw.js`，處理 `push`（顯示通知）與 `notificationclick`（聚焦或開啟 `/`）。
- 排程：`vercel.json` 加 cron `0 12 * * *`（UTC 12:00＝台灣 20:00）呼叫 `api/cron/reminders`。以 `CRON_SECRET`（Vercel 自動帶 `Authorization: Bearer`）驗證。
- `api/cron/reminders.ts`：用 `supabaseAdmin` 查資料、`web-push` 發送；收到 404／410 刪除該訂閱；其他錯誤記 log 不中斷其他人。
- 純邏輯（明天的範圍、彙總文字）放 `api/_lib/reminders.ts`，附測試。

## 環境變數（使用者設定，Production 與 Preview 各一份）
- `VITE_VAPID_PUBLIC_KEY`、`VAPID_PRIVATE_KEY`、`VAPID_SUBJECT`（`mailto:` 信箱）、`CRON_SECRET`。
- 金鑰產生：`npx web-push generate-vapid-keys`。

## 不做
- 自訂提醒時間、多次提醒、單一事件提醒。
