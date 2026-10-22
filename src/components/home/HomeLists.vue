<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ChevronRight, Star } from 'lucide-vue-next'
import { useFamilyLists } from '../../composables/useFamilyLists'

const { list, grouped, openTotal, loaded, loadFailed, hasFamily, load, addItem, toggle, toggleImportant } = useFamilyLists()

const MAX_SHOWN = 3
const shown = computed(() => grouped.value.open.slice(0, MAX_SHOWN))
const draft = ref('')

// App 登入後已載入；剛加入家庭或尚未載入時補載
onMounted(() => {
  if (hasFamily.value && !list.value) load()
})

const submit = async (e: Event) => {
  // 注音／拼音選字時的 Enter 只是確認選字，不能當成送出
  if ((e as KeyboardEvent).isComposing) return
  const t = draft.value
  if (!t.trim()) return
  draft.value = ''
  await addItem(t)
}
</script>

<template>
  <section class="flex flex-col gap-2">
    <div class="flex items-center justify-between px-1">
      <h2 class="text-xs font-bold uppercase tracking-widest text-slate-500">家庭待辦</h2>
      <router-link v-if="list" to="/todo" class="min-h-[44px] flex items-center text-[13px] font-bold text-primary-700">
        全部 {{ openTotal }} 項 ›
      </router-link>
    </div>

    <router-link
      v-if="loaded && !hasFamily"
      to="/settings?view=family"
      class="flex items-center justify-between bg-white rounded-[20px] px-4 min-h-[56px] text-[15px] font-bold text-primary-700"
    >
      先建立或加入家庭
      <ChevronRight class="w-5 h-5 text-slate-400" aria-hidden="true" />
    </router-link>

    <button
      v-else-if="loadFailed"
      type="button"
      class="bg-white rounded-[20px] px-4 min-h-[56px] text-left text-[15px] font-bold text-primary-700"
      @click="load()"
    >載入失敗，點此重試</button>

    <div v-else-if="list" class="bg-white rounded-[20px] px-3">
      <p v-if="!shown.length" class="pt-3 px-1 text-[13px] text-slate-400">還沒有待辦</p>
      <ul>
        <li v-for="i in shown" :key="i.id" class="flex items-center border-b border-slate-100">
          <button
            type="button"
            :aria-label="`完成：${i.text}`"
            class="min-w-[44px] min-h-[48px] flex items-center justify-center"
            @click="toggle(i)"
          >
            <span class="w-[22px] h-[22px] rounded-full border-2 border-primary-300"></span>
          </button>
          <span class="flex-1 min-w-0 text-[15px] text-primary-900 break-words py-2">{{ i.text }}</span>
          <button
            type="button"
            :aria-pressed="i.important"
            :aria-label="`${i.important ? '取消重要' : '標為重要'}：${i.text}`"
            class="min-w-[44px] min-h-[48px] flex items-center justify-center"
            @click="toggleImportant(i)"
          >
            <Star class="w-5 h-5" :fill="i.important ? '#f59e0b' : 'none'" :stroke="i.important ? '#f59e0b' : '#cbd5e1'" aria-hidden="true" />
          </button>
        </li>
      </ul>
      <form class="flex items-center" @submit.prevent>
        <span class="min-w-[44px] min-h-[48px] flex items-center justify-center text-xl text-primary-700" aria-hidden="true">＋</span>
        <input
          v-model="draft"
          type="text"
          enterkeyhint="done"
          placeholder="新增待辦…"
          aria-label="新增待辦"
          class="flex-1 min-w-0 min-h-[48px] bg-transparent text-[15px] text-primary-900 placeholder:text-slate-400 outline-none"
          @keydown.enter.prevent="submit"
        />
      </form>
    </div>
  </section>
</template>
