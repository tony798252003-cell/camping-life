<script setup lang="ts">
import { onMounted } from 'vue'
import { ChevronRight } from 'lucide-vue-next'
import { useFamilyLists } from '../../composables/useFamilyLists'

const { lists, loaded, loadFailed, hasFamily, load, openCountOf } = useFamilyLists()

// App 登入後已載入；剛加入家庭或尚未載入時補載
onMounted(() => {
  if (hasFamily.value && lists.value.length === 0) load()
})
</script>

<template>
  <section class="flex flex-col gap-2">
    <h2 class="px-1 text-xs font-bold uppercase tracking-widest text-slate-500">清單</h2>

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

    <template v-else>
      <router-link
        v-for="l in lists"
        :key="l.id"
        :to="`/lists/${l.id}`"
        class="flex items-center gap-3 bg-white rounded-[20px] px-4 min-h-[56px]"
      >
        <span class="flex-1 min-w-0 text-[15px] font-bold text-primary-900 truncate">{{ l.title }}</span>
        <span class="text-[13px] font-semibold shrink-0" :class="openCountOf(l.id) ? 'text-primary-700' : 'text-slate-400'">
          未完成 {{ openCountOf(l.id) }} 項
        </span>
        <ChevronRight class="w-5 h-5 text-slate-400 shrink-0" aria-hidden="true" />
      </router-link>
    </template>
  </section>
</template>
