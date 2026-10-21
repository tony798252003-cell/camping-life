<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Check, ChevronDown, ChevronLeft, Plus, Trash2 } from 'lucide-vue-next'
import { useFamilyLists } from '../composables/useFamilyLists'
import { useConfirm } from '../composables/useConfirm'
import type { FamilyListItem } from '../types/database'

const route = useRoute()
const { lists, loaded, hasFamily, load, listById, groupedOf, addItem, toggle, removeItem, clearDone } = useFamilyLists()
const { confirm } = useConfirm()

const listId = computed(() => String(route.params.id))
const list = computed(() => listById(listId.value))
const grouped = computed(() => groupedOf(listId.value))
const draft = ref('')
const showDone = ref(false)

// 直接開網址進來時 App 可能還沒載完；已載入就不重抓
onMounted(() => {
  if (hasFamily.value && lists.value.length === 0) load()
})

const submit = async () => {
  const t = draft.value
  if (!t.trim()) return
  draft.value = ''
  await addItem(listId.value, t)
}

const askRemove = async (i: FamilyListItem) => {
  const ok = await confirm({ title: '刪除項目', message: `確定刪除「${i.text}」？`, confirmText: '刪除', type: 'danger' })
  if (ok) await removeItem(i.id)
}

const askClear = async () => {
  const ok = await confirm({
    title: '清除已完成',
    message: `確定清除 ${grouped.value.done.length} 項已完成的項目？`,
    confirmText: '清除',
    type: 'danger',
  })
  if (ok) await clearDone(listId.value)
}
</script>

<template>
  <div class="px-4 pt-2 pb-6 flex flex-col gap-4">
    <div class="flex items-center gap-1">
      <router-link to="/" aria-label="返回首頁" class="-ml-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-primary-700">
        <ChevronLeft class="w-6 h-6" aria-hidden="true" />
      </router-link>
      <h1 class="flex-1 min-w-0 text-lg font-extrabold text-primary-900 truncate">{{ list?.title ?? '清單' }}</h1>
      <button
        v-if="grouped.done.length"
        type="button"
        class="min-h-[44px] px-3 rounded-[12px] bg-primary-100 text-primary-700 text-[13px] font-extrabold"
        @click="askClear"
      >清除已完成</button>
    </div>

    <router-link
      v-if="loaded && !hasFamily"
      to="/settings?view=family"
      class="bg-white rounded-[20px] px-4 min-h-[56px] flex items-center text-[15px] font-bold text-primary-700"
    >先建立或加入家庭</router-link>

    <p v-else-if="loaded && !list" class="text-[13px] text-slate-500 px-1">找不到這張清單</p>

    <template v-else-if="list">
      <form class="flex items-center gap-2" @submit.prevent="submit">
        <input
          v-model="draft"
          type="text"
          enterkeyhint="done"
          placeholder="新增項目，按 Enter"
          aria-label="新增項目"
          class="flex-1 min-w-0 min-h-[44px] rounded-[16px] bg-white px-4 text-[15px] text-primary-900 outline-none focus:ring-2 focus:ring-primary-400"
        />
        <button
          type="submit"
          aria-label="新增"
          class="min-w-[44px] min-h-[44px] rounded-[16px] bg-primary-600 text-white flex items-center justify-center"
        >
          <Plus class="w-5 h-5" aria-hidden="true" />
        </button>
      </form>

      <ul class="flex flex-col gap-2">
        <li v-for="i in grouped.open" :key="i.id" class="flex items-center bg-white rounded-[20px] pl-1 pr-1">
          <button
            type="button"
            :aria-label="`完成 ${i.text}`"
            class="min-w-[44px] min-h-[44px] flex items-center justify-center"
            @click="toggle(i)"
          >
            <span class="w-6 h-6 rounded-full border-2 border-primary-300 transition-colors"></span>
          </button>
          <span class="flex-1 min-w-0 text-[15px] font-semibold text-primary-900 break-words py-2">{{ i.text }}</span>
          <button
            type="button"
            :aria-label="`刪除 ${i.text}`"
            class="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400"
            @click="askRemove(i)"
          >
            <Trash2 class="w-5 h-5" aria-hidden="true" />
          </button>
        </li>
      </ul>
      <p v-if="!grouped.open.length && !grouped.done.length" class="text-[13px] text-slate-500 px-1">還沒有項目，從上面新增第一個</p>

      <section v-if="grouped.done.length" class="flex flex-col gap-2">
        <button
          type="button"
          class="self-start min-h-[44px] px-1 flex items-center gap-1 text-[13px] font-extrabold text-slate-500"
          :aria-expanded="showDone"
          @click="showDone = !showDone"
        >
          已完成 {{ grouped.done.length }} 項
          <ChevronDown class="w-4 h-4 transition-transform" :class="{ 'rotate-180': showDone }" aria-hidden="true" />
        </button>
        <ul v-if="showDone" class="flex flex-col gap-2">
          <li v-for="i in grouped.done" :key="i.id" class="flex items-center bg-white/70 rounded-[20px] pl-1 pr-1">
            <button
              type="button"
              :aria-label="`取消完成 ${i.text}`"
              class="min-w-[44px] min-h-[44px] flex items-center justify-center"
              @click="toggle(i)"
            >
              <span class="w-6 h-6 rounded-full bg-primary-600 flex items-center justify-center">
                <Check class="w-4 h-4 text-white" aria-hidden="true" />
              </span>
            </button>
            <span class="flex-1 min-w-0 text-[15px] font-semibold text-slate-400 line-through break-words py-2">{{ i.text }}</span>
            <button
              type="button"
              :aria-label="`刪除 ${i.text}`"
              class="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400"
              @click="askRemove(i)"
            >
              <Trash2 class="w-5 h-5" aria-hidden="true" />
            </button>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
