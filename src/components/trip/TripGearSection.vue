<script setup lang="ts">
import { computed } from 'vue'
import { Tent, Users, Home, ChevronLeft, Banknote } from 'lucide-vue-next'
import type { NewCampingTrip, CampingGear } from '../../types/database'

// 規劃用裝備與同行欄位：營位、營位費、露友、帳篷（放在父層的 grid 內）
const props = defineProps<{
  form: NewCampingTrip
  tents: CampingGear[]
}>()

const selectedTentNameLength = computed(() => {
  if (!props.form.tent_id) return 0
  const t = props.tents.find(t => t.id === props.form.tent_id)
  return t ? t.name.length : 0
})

const cardClass = 'bg-white rounded-[20px] shadow-sm p-3.5 flex items-center gap-3 overflow-hidden'
const chipClass = 'w-9 h-9 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center shrink-0'
const labelClass = 'text-[11px] text-slate-500'
</script>

<template>
  <h3 class="col-span-2 text-sm font-bold text-primary-900 mt-3 px-1">這次安排</h3>

  <!-- 營位 -->
  <div :class="cardClass">
    <div :class="chipClass">
      <Tent class="w-5 h-5" />
    </div>
    <div class="flex flex-col min-w-0">
      <span :class="labelClass">營位</span>
      <input
        v-model="form.zone"
        type="text"
        placeholder="未指定"
        class="bg-transparent border-none p-0 text-base font-bold text-primary-900 w-full focus:ring-0 leading-tight placeholder:text-slate-400"
      />
    </div>
  </div>

  <!-- 營位費 -->
  <div :class="cardClass">
    <div :class="chipClass">
      <Banknote class="w-5 h-5" />
    </div>
    <div class="flex flex-col min-w-0">
      <span :class="labelClass">營位費</span>
      <div class="flex items-baseline gap-1">
        <span class="text-xs font-bold text-slate-500">NT$</span>
        <input
          v-model.number="form.cost"
          type="number"
          placeholder="未提供"
          class="bg-transparent border-none p-0 text-base font-bold text-primary-900 w-full min-w-0 focus:ring-0 leading-tight placeholder:text-slate-400"
        />
      </div>
    </div>
  </div>

  <!-- 露友 -->
  <div :class="cardClass">
    <div :class="chipClass">
      <Users class="w-5 h-5" />
    </div>
    <div class="flex flex-col min-w-0">
      <span :class="labelClass">露友</span>
      <input
        v-model="form.companions"
        type="text"
        placeholder="無"
        class="bg-transparent border-none p-0 text-base font-bold text-primary-900 w-full focus:ring-0 leading-tight placeholder:text-slate-400"
      />
    </div>
  </div>

  <!-- 使用帳篷 -->
  <div :class="cardClass">
    <div :class="[chipClass, 'overflow-hidden']">
      <img
        v-if="form.tent_id && tents.find(t => t.id === form.tent_id)?.image_url"
        :src="tents.find(t => t.id === form.tent_id)?.image_url || ''"
        class="w-full h-full object-contain"
      />
      <Home v-else class="w-5 h-5" />
    </div>
    <div class="flex flex-col flex-1 min-w-0">
      <span :class="labelClass">使用帳篷</span>
      <div class="relative w-full">
        <select
          v-model="form.tent_id"
          class="w-full bg-transparent border-none p-0 font-bold text-primary-900 focus:ring-0 cursor-pointer appearance-none pr-6 truncate"
          :class="{
            'text-slate-400': !form.tent_id,
            'text-base': selectedTentNameLength < 8,
            'text-sm': selectedTentNameLength >= 8 && selectedTentNameLength < 14,
            'text-xs': selectedTentNameLength >= 14
          }"
        >
          <option :value="undefined">未選擇</option>
          <option v-for="tent in tents" :key="tent.id" :value="tent.id">{{ tent.name }}</option>
        </select>
        <div class="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
          <ChevronLeft class="w-4 h-4 -rotate-90" />
        </div>
      </div>
    </div>
  </div>
</template>
