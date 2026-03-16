# Booking Availability Monitor Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 定期爬取愛露營/露營樂平台，偵測營地訂位開放，透過 App 內通知 + 手機 Web Push 通知使用者。

**Architecture:** Supabase Edge Function 執行爬蟲，比對 `booking_last_available_date` 偵測新訂位，寫入 `booking_alerts` 資料表（App 內通知），同時透過 Web Push API 推送手機通知。pg_cron 每週自動執行，CampsiteEditModal 提供手動觸發按鈕。

**Tech Stack:** Supabase Edge Functions (Deno), pg_cron, Web Push API (VAPID), vite-plugin-pwa Service Worker, Vue 3

**Prerequisites:** Plan A (`2026-03-16-campsite-fields-expansion.md`) 必須先完成，`campsites` 資料表需有 `booking_platform`、`booking_platform_url`、`booking_last_available_date`、`booking_scraped_at` 欄位。

**Spec:** `docs/superpowers/specs/2026-03-16-campsite-fields-expansion-design.md`

---

## Chunk 1: booking_alerts 資料表 + DB 基礎

### Files:
- Create: `supabase/migrations/20260316_create_booking_alerts.sql`
- Modify: `src/types/database.ts`

---

### Task 1: 建立 booking_alerts 資料表

- [ ] **Step 1: 建立 migration 檔案**

```sql
-- supabase/migrations/20260316_create_booking_alerts.sql

CREATE TABLE IF NOT EXISTS public.booking_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  campsite_id integer REFERENCES public.campsites(id) ON DELETE CASCADE,
  campsite_name text NOT NULL,
  new_available_date date NOT NULL,
  platform text NOT NULL,
  platform_url text,
  is_read boolean DEFAULT false,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Index for unread alerts per user
CREATE INDEX IF NOT EXISTS booking_alerts_user_unread
  ON public.booking_alerts(user_id, is_read)
  WHERE is_read = false;

-- RLS
ALTER TABLE public.booking_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own alerts"
  ON public.booking_alerts
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert alerts"
  ON public.booking_alerts
  FOR INSERT
  WITH CHECK (true); -- Edge Function 用 service role，繞過 RLS

CREATE POLICY "Users can mark their own alerts as read"
  ON public.booking_alerts
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

- [ ] **Step 2: 在 Supabase Dashboard 執行 migration**

前往 Supabase Dashboard → SQL Editor，貼上執行。確認無錯誤。

- [ ] **Step 3: 新增 push_subscriptions 資料表（儲存 Web Push 訂閱）**

同樣在 SQL Editor 執行：

```sql
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own subscriptions"
  ON public.push_subscriptions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

- [ ] **Step 4: 更新 `src/types/database.ts`**

在 `Database` interface 的 `Tables` 中加入：

```typescript
booking_alerts: {
  Row: {
    id: string
    created_at: string
    campsite_id: number | null
    campsite_name: string
    new_available_date: string
    platform: string
    platform_url: string | null
    is_read: boolean
    user_id: string | null
  }
  Insert: {
    campsite_id?: number | null
    campsite_name: string
    new_available_date: string
    platform: string
    platform_url?: string | null
    is_read?: boolean
    user_id?: string | null
  }
  Update: { is_read?: boolean }
}
```

同時在 `database.ts` 頂部加入型別：

```typescript
export interface BookingAlert {
  id: string
  created_at: string
  campsite_id: number | null
  campsite_name: string
  new_available_date: string
  platform: string
  platform_url: string | null
  is_read: boolean
  user_id: string | null
}
```

- [ ] **Step 5: build 確認無錯誤**

```bash
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260316_create_booking_alerts.sql src/types/database.ts
git commit -m "feat(db): add booking_alerts and push_subscriptions tables"
```

---

## Chunk 2: Supabase Edge Function 爬蟲

### Files:
- Create: `supabase/functions/scrape-booking/index.ts`

### 說明
Edge Function 接收可選的 `campsite_id` 參數：
- 有 `campsite_id` → 爬單筆（手動觸發）
- 無 `campsite_id` → 爬全部有 `booking_platform` 的營地（排程執行）

爬蟲策略：在愛露營/露營樂的營地頁面上，找到日曆或可訂日期清單，取得**最遠可訂日期**。

---

### Task 2: 建立 Edge Function

- [ ] **Step 1: 建立函數目錄和檔案**

```bash
mkdir -p supabase/functions/scrape-booking
```

- [ ] **Step 2: 建立 `supabase/functions/scrape-booking/index.ts`**

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webPush from 'https://esm.sh/web-push@3.6.7'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_EMAIL = Deno.env.get('VAPID_EMAIL')!

webPush.setVapidDetails(`mailto:${VAPID_EMAIL}`, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

// === Scraper helpers ===

async function scrapeIcamping(url: string): Promise<Date | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CampingLifeBot/1.0)' }
    })
    const html = await res.text()

    // 愛露營：找 data-date 屬性中最大的可訂日期
    const dateMatches = html.matchAll(/data-date="(\d{4}-\d{2}-\d{2})"/g)
    const dates: Date[] = []
    for (const match of dateMatches) {
      const d = new Date(match[1])
      if (!isNaN(d.getTime())) dates.push(d)
    }
    if (dates.length === 0) return null
    return new Date(Math.max(...dates.map(d => d.getTime())))
  } catch (e) {
    console.error('scrapeIcamping error:', e)
    return null
  }
}

async function scrapeCampingFun(url: string): Promise<Date | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CampingLifeBot/1.0)' }
    })
    const html = await res.text()

    // 露營樂：找日期格式字串
    const dateMatches = html.matchAll(/(\d{4})\/(\d{2})\/(\d{2})/g)
    const dates: Date[] = []
    for (const match of dateMatches) {
      const d = new Date(`${match[1]}-${match[2]}-${match[3]}`)
      if (!isNaN(d.getTime())) dates.push(d)
    }
    if (dates.length === 0) return null
    return new Date(Math.max(...dates.map(d => d.getTime())))
  } catch (e) {
    console.error('scrapeCampingFun error:', e)
    return null
  }
}

async function getLatestAvailableDate(platform: string, url: string): Promise<Date | null> {
  if (platform === 'icamping') return scrapeIcamping(url)
  if (platform === 'campingfun') return scrapeCampingFun(url)
  return null
}

// === Push notification ===

async function sendPushToAllFamilyMembers(familyId: string | null, payload: object) {
  // Get all push subscriptions for users in the same family
  let userQuery = supabase.from('profiles').select('id')
  if (familyId) {
    userQuery = userQuery.eq('family_id', familyId)
  }
  const { data: profiles } = await userQuery

  if (!profiles?.length) return

  const userIds = profiles.map(p => p.id)
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('*')
    .in('user_id', userIds)

  if (!subs?.length) return

  const payloadStr = JSON.stringify(payload)
  for (const sub of subs) {
    try {
      await webPush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payloadStr
      )
    } catch (e) {
      console.error('Push failed for sub:', sub.endpoint, e)
      // If subscription expired, remove it
      if ((e as any)?.statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
      }
    }
  }
}

// === Main handler ===

Deno.serve(async (req) => {
  const { campsite_id } = await req.json().catch(() => ({}))

  // Fetch campsites to scrape
  let query = supabase
    .from('campsites')
    .select('id, name, booking_platform, booking_platform_url, booking_last_available_date')
    .not('booking_platform', 'is', null)
    .not('booking_platform_url', 'is', null)

  if (campsite_id) {
    query = query.eq('id', campsite_id)
  }

  const { data: campsites, error } = await query
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })

  const results = []
  for (const site of (campsites ?? [])) {
    const newDate = await getLatestAvailableDate(site.booking_platform!, site.booking_platform_url!)

    if (!newDate) {
      results.push({ id: site.id, name: site.name, status: 'no_date_found' })
      continue
    }

    const prevDate = site.booking_last_available_date ? new Date(site.booking_last_available_date) : null
    const isNewlyOpened = !prevDate || newDate > prevDate

    // Always update scraped_at and last_available_date
    await supabase
      .from('campsites')
      .update({
        booking_last_available_date: newDate.toISOString().split('T')[0],
        booking_scraped_at: new Date().toISOString(),
      })
      .eq('id', site.id)

    if (isNewlyOpened) {
      // Get family_id for this campsite (from first trip or creator)
      const { data: profile } = await supabase
        .from('profiles')
        .select('family_id')
        .limit(1)
        .single()

      // Insert alert for all family members
      const { data: profilesInFamily } = await supabase
        .from('profiles')
        .select('id')
        .eq('family_id', profile?.family_id ?? '')

      for (const p of (profilesInFamily ?? [])) {
        await supabase.from('booking_alerts').insert({
          campsite_id: site.id,
          campsite_name: site.name,
          new_available_date: newDate.toISOString().split('T')[0],
          platform: site.booking_platform!,
          platform_url: site.booking_platform_url,
          user_id: p.id,
        })
      }

      // Send push notification
      await sendPushToAllFamilyMembers(profile?.family_id ?? null, {
        title: '訂位開放通知',
        body: `${site.name} 開放訂位了！最遠可訂到 ${newDate.toLocaleDateString('zh-TW')}`,
        url: site.booking_platform_url,
      })

      results.push({ id: site.id, name: site.name, status: 'new_opening_detected', date: newDate })
    } else {
      results.push({ id: site.id, name: site.name, status: 'no_change' })
    }
  }

  return new Response(JSON.stringify({ results }), {
    headers: { 'Content-Type': 'application/json' }
  })
})
```

- [ ] **Step 3: 產生 VAPID 金鑰**

在終端機執行：

```bash
npx web-push generate-vapid-keys
```

複製輸出的 `Public Key` 和 `Private Key`。

- [ ] **Step 4: 設定 Supabase Edge Function 環境變數**

前往 Supabase Dashboard → Edge Functions → scrape-booking → Settings，加入：
- `VAPID_PUBLIC_KEY` = (上方產生的 Public Key)
- `VAPID_PRIVATE_KEY` = (上方產生的 Private Key)
- `VAPID_EMAIL` = (你的 email)

同時把 `VAPID_PUBLIC_KEY` 記下來，前端 Web Push 訂閱需要用到。

- [ ] **Step 5: Deploy Edge Function**

```bash
npx supabase functions deploy scrape-booking
```

- [ ] **Step 6: 手動測試**

```bash
curl -X POST https://<your-project>.supabase.co/functions/v1/scrape-booking \
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"campsite_id": 1}'
```

確認回應包含 `results` 陣列，無錯誤。

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/scrape-booking/
git commit -m "feat(edge): add booking availability scraper edge function"
```

---

## Chunk 3: pg_cron 排程設定

### Task 3: 設定每週自動爬蟲

- [ ] **Step 1: 在 Supabase Dashboard 啟用 pg_cron extension**

前往 Supabase Dashboard → Database → Extensions，搜尋 `pg_cron`，啟用。

- [ ] **Step 2: 建立排程 SQL**

在 SQL Editor 執行：

```sql
-- 每週日凌晨 2 點（UTC+8 = UTC 18:00 週六）執行爬蟲
SELECT cron.schedule(
  'weekly-booking-scraper',
  '0 18 * * 6',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/scrape-booking',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
```

**注意：** 需先在 Supabase Dashboard → Settings → Vault 設定 `app.supabase_url` 和 `app.service_role_key` 兩個 secret，或直接寫入 SQL：

```sql
ALTER DATABASE postgres SET "app.supabase_url" = 'https://xxxxx.supabase.co';
```

- [ ] **Step 3: 確認排程已建立**

```sql
SELECT * FROM cron.job;
```

Expected: 看到 `weekly-booking-scraper` 的排程記錄。

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(cron): schedule weekly booking scraper"
```

---

## Chunk 4: Web Push 前端整合

### Files:
- Create: `src/composables/usePushNotification.ts`
- Modify: `src/components/MainLayout.vue` 或 App 主要 layout 元件（確認後修改）
- Modify: `vite.config.ts`（確認 PWA Service Worker 設定）

---

### Task 4: usePushNotification composable

- [ ] **Step 1: 建立 `src/composables/usePushNotification.ts`**

```typescript
import { ref } from 'vue'
import { supabase } from '../lib/supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

export function usePushNotification() {
  const isSupported = ref('serviceWorker' in navigator && 'PushManager' in window)
  const isSubscribed = ref(false)
  const isLoading = ref(false)

  const checkSubscription = async () => {
    if (!isSupported.value) return
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    isSubscribed.value = !!sub
  }

  const subscribe = async () => {
    if (!isSupported.value || !VAPID_PUBLIC_KEY) return
    isLoading.value = true
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        alert('需要通知權限才能接收訂位開放通知')
        return
      }

      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const subJson = sub.toJSON()
      await supabase.from('push_subscriptions').upsert({
        user_id: user.id,
        endpoint: subJson.endpoint!,
        p256dh: (subJson.keys as any).p256dh,
        auth: (subJson.keys as any).auth,
      }, { onConflict: 'endpoint' })

      isSubscribed.value = true
    } catch (e) {
      console.error('Push subscribe failed:', e)
    } finally {
      isLoading.value = false
    }
  }

  const unsubscribe = async () => {
    isLoading.value = true
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await sub.unsubscribe()
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
      }
      isSubscribed.value = false
    } finally {
      isLoading.value = false
    }
  }

  return { isSupported, isSubscribed, isLoading, checkSubscription, subscribe, unsubscribe }
}
```

- [ ] **Step 2: 在 `.env.local` 加入 VAPID Public Key**

```
VITE_VAPID_PUBLIC_KEY=<你在 Chunk 2 Task 3 產生的 Public Key>
```

- [ ] **Step 3: 確認 vite-plugin-pwa Service Worker 設定能處理 Push**

在 `vite.config.ts` 確認 PWA 設定有 `strategies: 'injectManifest'` 或使用 `generateSW`（預設即可）。若使用 `injectManifest`，需在 Service Worker 檔案加入 push 事件處理。

若使用預設 `generateSW`，在 `vite.config.ts` 的 VitePWA 設定加入：

```typescript
workbox: {
  additionalManifestEntries: [],
  runtimeCaching: [],
},
```

並新增 `src/sw-push.ts`（自訂 SW push handler，在 VitePWA 設定中引入）：

```typescript
// src/sw-push.ts - 由 vite-plugin-pwa 的 injectManifest 模式引入
self.addEventListener('push', (event: any) => {
  const data = event.data?.json() ?? {}
  event.waitUntil(
    (self as any).registration.showNotification(data.title || '露營通知', {
      body: data.body,
      icon: '/pwa-192x192.png',
      data: { url: data.url },
    })
  )
})

self.addEventListener('notificationclick', (event: any) => {
  event.notification.close()
  const url = event.notification.data?.url
  if (url) event.waitUntil((self as any).clients.openWindow(url))
})
```

- [ ] **Step 4: build 確認無錯誤**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/composables/usePushNotification.ts .env.local
git commit -m "feat(push): add Web Push subscription composable"
```

---

## Chunk 5: App 內通知 UI

### Files:
- Create: `src/composables/useBookingAlerts.ts`
- Modify: `src/layouts/MainLayout.vue`（確認實際 layout 檔案路徑）
- Modify: `src/views/SettingsView.vue`

---

### Task 5: useBookingAlerts composable

- [ ] **Step 1: 建立 `src/composables/useBookingAlerts.ts`**

```typescript
import { ref, computed } from 'vue'
import { supabase } from '../lib/supabase'
import type { BookingAlert } from '../types/database'

export function useBookingAlerts() {
  const alerts = ref<BookingAlert[]>([])
  const isLoading = ref(false)

  const unreadCount = computed(() => alerts.value.filter(a => !a.is_read).length)

  const fetchAlerts = async () => {
    isLoading.value = true
    try {
      const { data } = await supabase
        .from('booking_alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20)
      alerts.value = data ?? []
    } finally {
      isLoading.value = false
    }
  }

  const markAsRead = async (id: string) => {
    await supabase.from('booking_alerts').update({ is_read: true }).eq('id', id)
    const alert = alerts.value.find(a => a.id === id)
    if (alert) alert.is_read = true
  }

  const markAllAsRead = async () => {
    const unread = alerts.value.filter(a => !a.is_read).map(a => a.id)
    if (!unread.length) return
    await supabase.from('booking_alerts').update({ is_read: true }).in('id', unread)
    alerts.value.forEach(a => { a.is_read = true })
  }

  return { alerts, unreadCount, isLoading, fetchAlerts, markAsRead, markAllAsRead }
}
```

- [ ] **Step 2: 找到 MainLayout（或頂部導覽列元件）**

```bash
find src -name "MainLayout.vue" -o -name "NavBar.vue" -o -name "BottomNav.vue"
```

確認頂部導覽列的元件路徑。

- [ ] **Step 3: 在頂部導覽列加入通知鈴鐺 icon**

在導覽列 `<script setup>` 加入：

```typescript
import { onMounted } from 'vue'
import { useBookingAlerts } from '../composables/useBookingAlerts'
import { Bell } from 'lucide-vue-next'

const { unreadCount, fetchAlerts } = useBookingAlerts()
const showAlerts = ref(false)
onMounted(() => fetchAlerts())
```

在導覽列 template 適當位置加入（設定按鈕旁邊）：

```html
<button
  @click="showAlerts = !showAlerts"
  class="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
>
  <Bell class="w-5 h-5 text-gray-600" />
  <span
    v-if="unreadCount > 0"
    class="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center"
  >{{ unreadCount }}</span>
</button>
```

- [ ] **Step 4: 建立通知下拉面板**

在同一個 layout 元件加入通知面板（在導覽列下方，z-50）：

```html
<div
  v-if="showAlerts"
  class="absolute top-16 right-4 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden"
>
  <div class="flex items-center justify-between px-4 py-3 border-b border-gray-100">
    <span class="font-bold text-sm text-primary-900">訂位通知</span>
    <button @click="markAllAsRead" class="text-xs text-sky-600 hover:text-sky-800">全部已讀</button>
  </div>
  <div class="max-h-72 overflow-y-auto">
    <div v-if="alerts.length === 0" class="py-8 text-center text-gray-400 text-sm">
      暫無訂位通知
    </div>
    <div
      v-for="alert in alerts"
      :key="alert.id"
      @click="markAsRead(alert.id)"
      class="px-4 py-3 border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"
      :class="{ 'bg-sky-50': !alert.is_read }"
    >
      <div class="flex items-start gap-2">
        <span class="w-2 h-2 rounded-full bg-sky-500 mt-1.5 flex-shrink-0" v-if="!alert.is_read" />
        <span class="w-2 h-2 mt-1.5 flex-shrink-0" v-else />
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-primary-900 truncate">{{ alert.campsite_name }}</p>
          <p class="text-xs text-gray-500">開放訂位！最遠可訂到 {{ new Date(alert.new_available_date).toLocaleDateString('zh-TW') }}</p>
          <a
            v-if="alert.platform_url"
            :href="alert.platform_url"
            target="_blank"
            @click.stop
            class="text-xs text-sky-600 hover:underline"
          >前往訂位 ↗</a>
        </div>
      </div>
    </div>
  </div>
</div>
```

補上缺少的 import（useBookingAlerts 解構需要 `markAllAsRead`、`markAsRead`、`alerts`）：

```typescript
const { alerts, unreadCount, fetchAlerts, markAsRead, markAllAsRead } = useBookingAlerts()
```

- [ ] **Step 5: build + 手動測試**

```bash
npm run build
```

啟動 dev server，確認導覽列出現鈴鐺 icon，點擊後顯示空的通知面板。

- [ ] **Step 6: Commit**

```bash
git add src/composables/useBookingAlerts.ts src/layouts/
git commit -m "feat(ui): add in-app booking alerts notification bell"
```

---

### Task 6: SettingsView 加入推播訂閱設定

- [ ] **Step 1: 在 `src/views/SettingsView.vue` 加入推播設定區塊**

在 `<script setup>` 加入：

```typescript
import { usePushNotification } from '../composables/usePushNotification'
const { isSupported, isSubscribed, isLoading: pushLoading, checkSubscription, subscribe, unsubscribe } = usePushNotification()

onMounted(() => checkSubscription())
```

在 Settings 頁面找到適當位置（通知相關區塊，或新增一個區塊）加入：

```html
<!-- 訂位推播通知 -->
<div class="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4">
  <h3 class="font-bold text-primary-900 mb-1">訂位推播通知</h3>
  <p class="text-sm text-gray-500 mb-3">當追蹤的營地開放訂位時，即時通知你的手機。</p>

  <div v-if="!isSupported" class="text-sm text-gray-400">
    你的瀏覽器不支援推播通知
  </div>
  <div v-else class="flex items-center justify-between">
    <span class="text-sm text-gray-700">{{ isSubscribed ? '已開啟推播通知' : '尚未開啟' }}</span>
    <button
      @click="isSubscribed ? unsubscribe() : subscribe()"
      :disabled="pushLoading"
      class="px-4 py-2 rounded-lg text-sm font-bold transition-all"
      :class="isSubscribed
        ? 'bg-red-50 text-red-600 hover:bg-red-100'
        : 'bg-sky-500 text-white hover:bg-sky-600'"
    >
      {{ pushLoading ? '處理中...' : isSubscribed ? '關閉通知' : '開啟通知' }}
    </button>
  </div>
</div>
```

- [ ] **Step 2: 在 SettingsView 加入「立即檢查訂位」手動觸發按鈕**

```typescript
// 在 script setup 加入
const isCheckingBooking = ref(false)
const checkBookingNow = async () => {
  isCheckingBooking.value = true
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scrape-booking`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({}),
    })
    const result = await res.json()
    const newCount = result.results?.filter((r: any) => r.status === 'new_opening_detected').length ?? 0
    alert(newCount > 0 ? `發現 ${newCount} 個營地開放訂位！` : '目前沒有新的訂位開放。')
  } catch (e) {
    alert('檢查失敗，請稍後再試')
  } finally {
    isCheckingBooking.value = false
  }
}
```

在 template 中加入按鈕：

```html
<button
  @click="checkBookingNow"
  :disabled="isCheckingBooking"
  class="w-full py-3 bg-primary-900 text-white rounded-xl font-bold hover:bg-primary-800 transition-colors disabled:opacity-50"
>
  {{ isCheckingBooking ? '檢查中...' : '立即檢查訂位開放狀態' }}
</button>
```

- [ ] **Step 3: build + 手動測試**

```bash
npm run build
```

確認 Settings 頁面有推播設定區塊和手動觸發按鈕，點擊「開啟通知」會出現瀏覽器權限請求。

- [ ] **Step 4: Commit**

```bash
git add src/views/SettingsView.vue src/composables/usePushNotification.ts
git commit -m "feat(settings): add push notification toggle and manual booking check"
```

---

## 完成後確認清單

- [ ] `booking_alerts` 和 `push_subscriptions` 資料表存在於 Supabase
- [ ] Edge Function `scrape-booking` 已 deploy，手動 curl 測試通過
- [ ] pg_cron 排程已建立，可在 `cron.job` 表查到
- [ ] VAPID 金鑰已設定在 Edge Function 環境變數和 `.env.local`
- [ ] SettingsView 可開啟/關閉推播通知（瀏覽器權限請求正常）
- [ ] 導覽列有鈴鐺 icon，有未讀通知時顯示紅點
- [ ] `npm run build` 無錯誤
