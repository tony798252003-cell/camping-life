<script setup lang="ts">
import type { ViewEvent } from '../../utils/calendar/viewEvent'
import { displayTitle, subtitle, timeLabel } from '../../utils/calendar/glance'
import { OWNER_LABEL } from '../../utils/calendar/visibility'

// selected 有值 = 顯示某一天（可清除、可新增）；null = 速覽目前那段期間（title：本週行程／11/2–11/8行程／12 月行程）
defineProps<{ sections: { label: string; day: string; items: ViewEvent[] }[]; selected: string | null; title: string }>()
const emit = defineEmits<{ (e: 'open', ev: ViewEvent): void; (e: 'clear'): void; (e: 'add'): void }>()
</script>

<template>
  <section class="flex flex-col gap-2">
    <div class="flex items-center justify-between px-1 min-h-[16px]">
      <h2 class="text-xs font-bold uppercase tracking-widest text-slate-500">{{ selected ? sections[0]?.label : title }}</h2>
      <button
        v-if="selected"
        type="button"
        class="-my-3 min-h-[44px] px-3 rounded-[12px] bg-primary-100 text-primary-700 text-[13px] font-extrabold"
        @click="emit('clear')"
      >取消選取</button>
    </div>

    <template v-if="sections.length === 0 || sections.every((s) => s.items.length === 0)">
      <p class="text-[13px] text-slate-500 px-1">{{ selected ? '這天沒有行程' : title === '本週行程' ? '本週沒有安排，好好休息' : '這段期間沒有安排' }}</p>
      <button
        v-if="selected"
        type="button"
        class="self-start min-h-[44px] px-4 rounded-[14px] bg-primary-600 text-white text-[13px] font-bold"
        @click="emit('add')"
      >新增</button>
    </template>
    <template v-else v-for="s in sections" :key="s.day">
      <span v-if="!selected" class="text-[13px] font-extrabold text-primary-700 px-1">{{ s.label }}</span>
      <button
        v-for="e in s.items"
        :key="e.key + s.day"
        type="button"
        class="w-full flex items-center gap-3 bg-white/90 rounded-[18px] px-3.5 py-3 min-h-[56px] text-left"
        @click="emit('open', e)"
      >
        <span class="w-1.5 self-stretch rounded-full shrink-0" :style="{ backgroundColor: e.color }"></span>
        <span class="flex flex-col min-w-0 flex-1">
          <span class="text-[15px] font-bold text-primary-900 truncate">{{ displayTitle(e) }}</span>
          <span class="text-[11px] font-semibold text-slate-500 truncate">{{ subtitle(e, timeLabel(e, s.day)) }}</span>
        </span>
        <span class="text-xs font-black shrink-0" :style="{ color: e.color }">{{ OWNER_LABEL[e.owner] }}</span>
      </button>
    </template>
  </section>
</template>
