<script setup lang="ts">
import { Check, X } from 'lucide-vue-next'

// 營區資訊：進退場、熱水、夜衝時段、海拔與冷藏/冷凍/飲水（唯讀；放在父層的 grid 內）
const props = defineProps<{
  trip?: any
  altitude?: number | null
}>()

const facilities = () => [
  { label: '冷藏', on: !!props.trip?.campsites?.amenities?.has_fridge },
  { label: '冷凍', on: !!props.trip?.campsites?.amenities?.has_freezer },
  { label: '飲水', on: !!props.trip?.campsites?.amenities?.has_water_dispenser },
]
</script>

<template>
  <div class="col-span-2 bg-white rounded-[20px] shadow-sm px-4 py-1">
    <!-- 時間：進場 / 離場 / 熱水 / 夜衝時段 -->
    <div v-if="trip?.campsites" class="flex divide-x divide-slate-100 py-3.5 border-b border-slate-100">
      <div class="flex-1 min-w-0 flex flex-col items-center gap-0.5">
        <span class="text-[11px] text-slate-500">進場</span>
        <span class="text-[17px] font-black tabular-nums text-primary-900">{{ trip.campsites.check_in_time || '--:--' }}</span>
      </div>
      <div class="flex-1 min-w-0 flex flex-col items-center gap-0.5">
        <span class="text-[11px] text-slate-500">離場</span>
        <span class="text-[17px] font-black tabular-nums text-primary-900">{{ trip.campsites.check_out_time || '--:--' }}</span>
      </div>
      <div v-if="trip.campsites.shower_restrictions" class="flex-1 min-w-0 flex flex-col items-center gap-0.5 px-1">
        <span class="text-[11px] text-slate-500">熱水</span>
        <span class="text-[17px] font-black text-primary-900 text-center leading-tight">{{ trip.campsites.shower_restrictions }}</span>
      </div>
      <div v-if="trip.campsites.night_rush_time" class="flex-1 min-w-0 flex flex-col items-center gap-0.5 px-1">
        <span class="text-[11px] text-slate-500">夜衝時段</span>
        <span class="text-[17px] font-black text-primary-900 text-center leading-tight">{{ trip.campsites.night_rush_time }}</span>
      </div>
    </div>

    <!-- 海拔與設施 -->
    <div class="flex items-center justify-between gap-3 py-3.5">
      <span class="text-[13px] text-slate-500">海拔 <b class="text-[15px] text-primary-900">{{ altitude ? `${altitude} m` : '--' }}</b></span>
      <div class="flex gap-3.5">
        <span
          v-for="f in facilities()"
          :key="f.label"
          class="flex items-center gap-0.5 text-[13px] font-bold"
          :class="f.on ? 'text-primary-600' : 'text-slate-300'"
        >
          <component :is="f.on ? Check : X" class="w-3.5 h-3.5" /> {{ f.label }}
        </span>
      </div>
    </div>
  </div>
</template>
