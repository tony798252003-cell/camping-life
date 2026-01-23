<script setup lang="ts">
import { computed } from 'vue'
import type { CampingTrip } from '../types/database'

interface Props {
  trips: CampingTrip[]
}

const props = defineProps<Props>()

const stats = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // 1. 露營次數：只統計「已完成」的露營 (日期早於今天)
  const completedTrips = props.trips.filter(trip => new Date(trip.trip_date) < today).length
  
  // 2. 已預約至：過去 + 未來的所有露營
  const allTrips = props.trips.length

  // 3. 連續週數邏輯
  const getMonday = (d: Date) => {
    const date = new Date(d)
    const day = date.getDay() || 7
    date.setDate(date.getDate() - (day - 1))
    date.setHours(0, 0, 0, 0)
    return date.getTime()
  }

  // 取得所有唯一的「週一」時間戳，並排序
  const weekStamps = [...new Set(props.trips.map(t => getMonday(new Date(t.trip_date))))].sort((a, b) => a - b)
  
  // 找出包含「下一個行程」或「最近行程」的連貫序列
  // 先找到所有連貫序列
  const sequences: number[][] = []
  if (weekStamps.length > 0) {
    let currentSeq: number[] = [weekStamps[0]!]
    for (let i = 1; i < weekStamps.length; i++) {
      const prev = weekStamps[i - 1]!
      const curr = weekStamps[i]!
      const oneWeek = 7 * 24 * 60 * 60 * 1000
      if (curr - prev === oneWeek) {
        currentSeq.push(curr)
      } else {
        sequences.push(currentSeq)
        currentSeq = [curr]
      }
    }
    sequences.push(currentSeq)
  }

  // 找出「基準行程週」
  const futureTrips = props.trips
    .filter(t => new Date(t.trip_date) >= today)
    .sort((a, b) => new Date(a.trip_date).getTime() - new Date(b.trip_date).getTime())
  
  const targetStamp = futureTrips.length > 0 
    ? getMonday(new Date(futureTrips[0]!.trip_date))
    : (weekStamps.length > 0 ? weekStamps[weekStamps.length - 1]! : null)

  const activeSeq = targetStamp !== null 
    ? (sequences.find(seq => seq.includes(targetStamp)) || [targetStamp])
    : []
    
  const streakCount = activeSeq.length
  const currentRank = targetStamp !== null ? activeSeq.indexOf(targetStamp) + 1 : 0

  return { completedTrips, allTrips, streakCount, currentRank }
})
</script>

<template>
  <div class="grid grid-cols-3 gap-2.5 md:gap-4 mb-3 md:mb-6">
    <!-- 露營次數 (綠色系) -->
    <div class="card-organic rounded-[1.8rem] md:rounded-[2.2rem] p-3 md:p-6 flex flex-col items-center justify-center text-center group border-emerald-100/40">
      <div class="text-emerald-500/50 text-[10px] md:text-sm font-black uppercase tracking-[0.15em] mb-1.5 md:mb-3">
        露營次數
      </div>
      <div class="flex items-baseline justify-center">
        <span class="text-4xl md:text-6xl font-black text-emerald-600/60 tracking-tighter leading-none font-['Inter'] drop-shadow-sm group-hover:scale-105 transition-transform duration-300">
          {{ stats.completedTrips }}
        </span>
        <span class="text-sm md:text-xl font-black text-emerald-300/60 ml-1.5">露</span>
      </div>
    </div>

    <!-- 已預約至 (藍色系) -->
    <div class="card-organic rounded-[1.8rem] md:rounded-[2.2rem] p-3 md:p-6 flex flex-col items-center justify-center text-center group border-sky-100/40">
      <div class="text-sky-500/50 text-[10px] md:text-sm font-black uppercase tracking-[0.15em] mb-1.5 md:mb-3">
        已預約至
      </div>
      <div class="flex items-baseline justify-center">
        <span class="text-4xl md:text-6xl font-black text-sky-600/60 tracking-tighter leading-none font-['Inter'] drop-shadow-sm group-hover:scale-105 transition-transform duration-300">
          {{ stats.allTrips }}
        </span>
        <span class="text-sm md:text-xl font-black text-sky-300/60 ml-1.5">露</span>
      </div>
    </div>

    <!-- 連續露營 (橘色系) -->
    <div class="card-organic rounded-[1.8rem] md:rounded-[2.2rem] p-3 md:p-6 flex flex-col items-center justify-center text-center group border-orange-100/40 bg-gradient-to-br from-white/90 to-orange-50/20">
      <div class="text-orange-500/50 text-[10px] md:text-sm font-black uppercase tracking-[0.15em] mb-1.5 md:mb-3">
        連續露營
      </div>
      <div class="flex items-baseline justify-center">
        <div v-if="stats.streakCount > 0" class="flex items-baseline">
          <span class="text-4xl md:text-6xl font-black text-orange-600/60 tracking-tighter leading-none font-['Inter'] drop-shadow-sm group-hover:scale-105 transition-transform duration-300">
            {{ stats.currentRank }}
          </span>
          <span class="mx-0.5 md:mx-1 text-xl md:text-3xl font-bold text-orange-300/30">/</span>
          <span class="text-2xl md:text-4xl font-bold text-orange-400/30 tracking-tighter leading-none">
            {{ stats.streakCount }}
          </span>
        </div>
        <div v-else class="text-4xl md:text-6xl font-black text-slate-200 tracking-tighter leading-none">0</div>
        <span class="text-sm md:text-xl font-black text-orange-300/60 ml-1.5">週</span>
      </div>
    </div>
  </div>
</template>
