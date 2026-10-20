<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import AddCampsiteFlow from './AddCampsiteFlow.vue'
import { useConfirm } from '../../composables/useConfirm'
import type { Campsite } from '../../types/database'

// App.vue 的 router-view 會傳一堆 props，這頁不吃
defineOptions({ inheritAttrs: false })

const route = useRoute()
const router = useRouter()
const { confirm } = useConfirm()
const flow = ref<InstanceType<typeof AddCampsiteFlow> | null>(null)
let leaving = false // 存檔或使用者已確認放棄後，不再攔截

const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined)
const placeId = str(route.query.placeId)
// returnTo 只接受站內路徑，避免被當成 open redirect
const rawReturn = str(route.query.returnTo)
const returnTo = rawReturn && rawReturn.startsWith('/') && !rawReturn.startsWith('//') ? rawReturn : undefined

onBeforeRouteLeave(async () => {
  if (leaving || !flow.value?.hasUnsavedDraft()) return true
  return await confirm({ title: '捨棄草稿？', message: '草稿還沒存檔，離開會遺失。', type: 'warning', confirmText: '離開' })
})

function done(c: Campsite) {
  leaving = true
  if (returnTo) {
    // returnTo 本身可能帶 query，用 resolve 拆開再合併，不做字串相加
    const r = router.resolve(returnTo)
    router.replace({ path: r.path, query: { ...r.query, campsiteId: String(c.id) } })
  } else {
    router.replace({ name: 'library' })
  }
}

function cancel() {
  leaving = true
  if (returnTo) router.replace(returnTo)
  else router.replace({ name: 'library' })
}
</script>

<template>
  <div class="h-full bg-surface-50">
    <AddCampsiteFlow ref="flow" :initial-place-id="placeId" @saved="done" @cancel="cancel" />
  </div>
</template>
