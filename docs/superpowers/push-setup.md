# 推播提醒設定步驟

程式已完成，但在你做完下面步驟之前，設定頁的「提醒通知」只會顯示「尚未設定推播金鑰」，其他功能不受影響。

## 1. 安裝套件
在專案資料夾執行一次（本分支新增了 `web-push` 與 `@types/web-push`，只更新了 package.json／package-lock.json）：

```
npm install
```

## 2. 產生 VAPID 金鑰
```
npx web-push generate-vapid-keys
```
會印出 Public Key 與 Private Key。再自己想一組隨機長字串當 `CRON_SECRET`（例如 `openssl rand -hex 32`）。

## 3. 在 Vercel 設定 4 個環境變數
Vercel 專案 → Settings → Environment Variables。Production 與 Preview 都要各設一份（Secret 類的變數是分環境存的，只設 Production，Preview 部署會讀不到）。

| 名稱 | 值 |
|---|---|
| `VITE_VAPID_PUBLIC_KEY` | 剛產生的 Public Key |
| `VAPID_PRIVATE_KEY` | 剛產生的 Private Key |
| `VAPID_SUBJECT` | `mailto:你的信箱` |
| `CRON_SECRET` | 你自己產生的隨機字串（Vercel 排程會自動帶 `Authorization: Bearer ...`） |

注意：`VITE_` 開頭的變數在 build 時才寫進前端，所以設定後一定要重新部署。排程（Cron）只在 Production 部署執行。

## 4. 套用資料庫 migration
先備份：`npx tsx scripts/backup/backup-all.ts`（確認 exit 0）。
再把 `supabase/migrations/20261026000000_push_subscriptions.sql` 整份貼進 Supabase SQL Editor 執行。
完成後可跑 `npm run db:types` 讓型別檔由工具重新產生（目前是手動補入）。

## 5. 重新部署
合併／部署後確認 Vercel 的 Settings → Cron Jobs 看得到 `/api/cron/reminders`（每天 UTC 12:00 = 台灣 20:00）。

## 6. 在手機開啟
- Android：用 Chrome 開啟網站（建議加到主畫面），設定 → 提醒通知 → 開啟並允許通知。
- iPhone：必須先用 Safari 開啟網站 → 分享 → 「加入主畫面」，再從主畫面的圖示開啟 app（iOS 16.4 以上），設定 → 提醒通知 → 開啟並允許通知。沒加到主畫面時，設定頁只會顯示說明、沒有開關。

## 7. 手動測試
排程端點是 GET，要帶 secret：

```
curl -i -H "Authorization: Bearer 你的CRON_SECRET" https://你的網域/api/cron/reminders
```

- 沒帶或帶錯 secret：401。
- 成功會回 JSON，例如 `{"day":"2026-10-23","subscriptions":1,"sent":1,"skipped":0,"removed":0,"failed":0}`；`day` 是「明天」（台北時間）。
- 要看到通知，需要「明天」有事件／出發的行程／生日。測試時可先新增一個明天的全天事件。明天沒事時 `skipped` 會加一、不會推播。
- 回 500 `Missing VAPID env` 代表 VAPID 變數沒設好或沒重新部署。
- `removed` 大於 0 代表有失效訂閱（裝置已取消通知）被自動清掉。
