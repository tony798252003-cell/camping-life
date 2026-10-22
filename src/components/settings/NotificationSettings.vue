<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useNotification } from '../../composables/useNotification'
import { pushSubscriptionQueries } from '../../services/db/pushSubscriptions'

const { success, error: notifyError } = useNotification()

const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined
const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent)
const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

// 不能用的原因；null 表示可以顯示開關
const unavailableReason = computed<string | null>(() => {
  if (!publicKey) return '尚未設定推播金鑰，這個版本還不能使用提醒通知。'
  if (!supported) {
    return isIos
      ? '需要先加到主畫面：用 Safari 開啟，點分享按鈕選「加入主畫面」，再從主畫面開啟 app，回到這裡就能開啟。'
      : '這個瀏覽器不支援推播通知。'
  }
  return null
})

const loading = ref(true)
const enabled = ref(false)
const busy = ref(false)
const denied = ref(false)

// VAPID 公鑰是 base64url，subscribe 需要 Uint8Array
function keyToBytes(b64url: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (b64url.length % 4)) % 4)
  const raw = atob((b64url + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

// serviceWorker.ready 沒有註冊 SW 時永遠不會 resolve，要設逾時
const SW_TIMEOUT_MS = 5000
const getRegistration = () =>
  Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('sw-timeout')), SW_TIMEOUT_MS)),
  ])

const currentSubscription = async () => (await getRegistration()).pushManager.getSubscription()

const sameKey = (a: ArrayBuffer | null | undefined, b: Uint8Array) => {
  if (!a) return false
  const x = new Uint8Array(a)
  return x.length === b.length && x.every((v, i) => v === b[i])
}

onMounted(async () => {
  if (unavailableReason.value) {
    loading.value = false
    return
  }
  denied.value = Notification.permission === 'denied'
  try {
    const sub = await currentSubscription()
    // 瀏覽器有訂閱且資料庫也有這一列才算開啟
    enabled.value = !!sub && (await pushSubscriptionQueries.exists(sub.endpoint))
  } catch (e) {
    console.error('[NotificationSettings] init error:', e)
  } finally {
    loading.value = false
  }
})

const enable = async () => {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    denied.value = permission === 'denied'
    notifyError('沒有取得通知權限')
    return
  }
  const reg = await getRegistration()
  const key = keyToBytes(publicKey!)
  let existing = await reg.pushManager.getSubscription()
  // VAPID 金鑰換過：舊訂閱綁舊金鑰，之後永遠送不到，要取消後重新訂閱
  if (existing && !sameKey(existing.options.applicationServerKey, key)) {
    await existing.unsubscribe()
    existing = null
  }
  const sub = existing ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }))
  const json = sub.toJSON()
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) throw new Error('subscription missing keys')
  try {
    await pushSubscriptionQueries.save({ endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth })
  } catch (e) {
    await sub.unsubscribe().catch(() => {}) // 資料庫沒存成功就不要留著孤兒訂閱
    throw e
  }
  enabled.value = true
  success('已開啟提醒通知')
}

const disable = async () => {
  const sub = await currentSubscription()
  if (sub) {
    await pushSubscriptionQueries.remove(sub.endpoint)
    await sub.unsubscribe()
  }
  enabled.value = false
  success('已關閉提醒通知')
}

const toggle = async () => {
  if (busy.value) return
  busy.value = true
  try {
    if (enabled.value) await disable()
    else await enable()
  } catch (e) {
    console.error('[NotificationSettings] toggle error:', e)
    notifyError((e as Error)?.message === 'sw-timeout' ? '無法啟用通知（找不到 service worker）' : '設定失敗，請稍後再試')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="p-4 space-y-4">
    <section class="bg-white rounded-[18px] p-4 space-y-3">
      <h3 class="text-[11px] font-semibold text-slate-500">每晚 8 點提醒</h3>
      <p class="text-[13px] text-slate-600">前一天晚上通知你明天的事件、出發的露營行程，以及還沒帶的裝備。明天沒有事就不會打擾你。</p>

      <p v-if="unavailableReason" class="text-[13px] text-slate-500 bg-slate-50 rounded-[14px] p-3">{{ unavailableReason }}</p>

      <p v-else-if="loading" class="text-[13px] text-slate-500">讀取中…</p>

      <template v-else>
        <button
          role="switch"
          :aria-checked="enabled"
          :disabled="busy || (denied && !enabled)"
          class="w-full min-h-[48px] flex items-center justify-between px-4 rounded-[14px] bg-primary-100 text-primary-700 font-bold disabled:opacity-50"
          @click="toggle"
        >
          <span>提醒通知</span>
          <span class="text-[13px]">{{ enabled ? '已開啟' : '已關閉' }}</span>
        </button>
        <p v-if="denied && !enabled" class="text-[11px] text-slate-500">通知權限已被封鎖，請到系統或瀏覽器設定中允許通知後再試。</p>
      </template>
    </section>
  </div>
</template>
