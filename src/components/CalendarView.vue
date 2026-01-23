<script setup lang="ts">
import { ref, computed } from 'vue'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import type { CampingTrip } from '../types/database'

const props = defineProps<{
  trips: CampingTrip[]
}>()

const emit = defineEmits<{
  (e: 'view-detail', trip: CampingTrip): void
}>()

const currentDate = ref(new Date())

// 切換月份 (Mobile)
const prevMonth = () => {
  currentDate.value = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() - 1, 1)
}

const nextMonth = () => {
  currentDate.value = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() + 1, 1)
}

// 切換年份 (Desktop)
const prevYear = () => {
  currentDate.value = new Date(currentDate.value.getFullYear() - 1, currentDate.value.getMonth(), 1)
}

const nextYear = () => {
  currentDate.value = new Date(currentDate.value.getFullYear() + 1, currentDate.value.getMonth(), 1)
}

// 標題顯示
const monthTitle = computed(() => {
  return currentDate.value.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long' })
})

const yearTitle = computed(() => {
  return `${currentDate.value.getFullYear()} 年`
})

// 產生指定月份的格子
const generateMonthData = (year: number, month: number) => {
  const days = []
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  
  // Monday start offset: 0=Mon ... 6=Sun
  // getDay(): 0=Sun, 1=Mon...
  let padding = (firstDay.getDay() + 6) % 7
  
  // 補上個月
  for (let i = 0; i < padding; i++) {
    const d = new Date(year, month, -i + 1)
    days.unshift({ date: d, isCurrentMonth: false, trips: [] as CampingTrip[] })
  }
  
  // 當月天數
  for (let i = 1; i <= lastDay.getDate(); i++) {
    const d = new Date(year, month, i)
    // 篩選行程
    const daysTrips = props.trips.filter(t => {
      const tripStart = new Date(t.trip_date)
      tripStart.setHours(0,0,0,0)
      const duration = t.duration_days || 1
      const tripEnd = new Date(tripStart.getTime())
      tripEnd.setDate(tripStart.getDate() + Math.max(0, duration - 1))
      return d >= tripStart && d <= tripEnd
    })
    
    // Sort trips logic if needed, currently camping trips usually distinct
    
    days.push({ 
      date: d, 
      isCurrentMonth: true, 
      trips: daysTrips,
      isToday: new Date().toDateString() === d.toDateString()
    })
  }
  
  // 補下個月 (補滿到 35 或 42 格)
  const remainingCells = 42 - days.length
  for (let i = 1; i <= remainingCells; i++) {
    const d = new Date(year, month + 1, i)
    days.push({ date: d, isCurrentMonth: false, trips: [] as CampingTrip[] })
  }
  
  return days
}

// Mobile: 單一月份
const currentMonthDays = computed(() => {
  return generateMonthData(currentDate.value.getFullYear(), currentDate.value.getMonth())
})

// Desktop: 全年 12 個月
const fullYearMonths = computed(() => {
  const year = currentDate.value.getFullYear()
  const months = []
  for (let i = 0; i < 12; i++) {
    months.push({
      name: new Date(year, i, 1).toLocaleDateString('zh-TW', { month: 'long' }),
      days: generateMonthData(year, i)
    })
  }
  return months
})

const handleDayClick = (day: { trips: CampingTrip[] }) => {
  if (day.trips.length > 0) {
    emit('view-detail', day.trips[0]!)
  }
}

const getTripColor = (trip: CampingTrip) => {
  const today = new Date()
  today.setHours(0,0,0,0)
  const tripDate = new Date(trip.trip_date)
  // Past trips: gray, Future/Today trips: green
  return tripDate < today ? 'bg-gray-300' : 'bg-green-400'
}


</script>

<template>
  <div class="h-full flex flex-col bg-surface-50 overflow-hidden pb-20 md:pb-0 font-sans">
     <!-- Mobile Header -->
     <div class="md:hidden sticky top-0 bg-white/80 backdrop-blur-md z-10 p-4 border-b border-primary-100 flex items-center justify-between supports-[backdrop-filter]:bg-white/60">
        <h1 class="text-2xl font-black text-primary-900 tracking-tight">露營行事曆</h1>
        <div class="flex items-center gap-2 bg-surface-100 rounded-xl p-1 border border-primary-100">
           <button @click="prevMonth" class="p-2 hover:bg-white rounded-lg transition-all shadow-sm text-primary-600">
             <ChevronLeft class="w-5 h-5" />
           </button>
           <span class="font-bold text-primary-800 w-24 text-center">{{ monthTitle }}</span>
           <button @click="nextMonth" class="p-2 hover:bg-white rounded-lg transition-all shadow-sm text-primary-600">
             <ChevronRight class="w-5 h-5" />
           </button>
        </div>
     </div>

     <!-- Desktop Header -->
     <div class="hidden md:flex sticky top-0 bg-white/80 backdrop-blur-md z-10 p-6 border-b border-primary-100 items-center justify-between supports-[backdrop-filter]:bg-white/60">
        <div class="flex items-center gap-4">
           <h1 class="text-3xl font-black text-primary-900 tracking-tight">年度計畫</h1>
           <div class="flex items-center gap-4 bg-surface-100 rounded-xl p-1.5 shadow-sm border border-primary-100">
             <button @click="prevYear" class="p-2 hover:bg-white rounded-lg transition-all shadow-sm text-primary-500 hover:text-primary-700">
               <ChevronLeft class="w-6 h-6" />
             </button>
             <span class="font-black text-2xl text-primary-700 w-32 text-center">{{ yearTitle }}</span>
             <button @click="nextYear" class="p-2 hover:bg-white rounded-lg transition-all shadow-sm text-primary-500 hover:text-primary-700">
               <ChevronRight class="w-6 h-6" />
             </button>
           </div>
        </div>
     </div>

     <!-- Mobile View: Single Month -->
     <div class="md:hidden flex-1 p-4 overflow-y-auto">
        <div class="grid grid-cols-7 mb-2 text-center text-xs font-bold text-primary-400">
          <div class="py-1 text-accent-orange/70">一</div>
          <div class="py-1">二</div>
          <div class="py-1">三</div>
          <div class="py-1">四</div>
          <div class="py-1">五</div>
          <div class="py-1 text-primary-600">六</div>
          <div class="py-1 text-accent-orange/70">日</div>
        </div>

        <div class="grid grid-cols-7 gap-2 auto-rows-fr">
           <div 
             v-for="day in currentMonthDays" 
             :key="day.date.toISOString()" 
             class="relative aspect-square rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer group/day"
             :class="[
               day.isCurrentMonth ? 'text-primary-700' : 'text-primary-200',
               day.isToday ? 'bg-primary-200 font-bold text-accent-sky ring-2 ring-accent-sky/30' : 'hover:bg-surface-50/50 active:bg-primary-100',
               day.trips.length > 0 ? 'bg-primary-50 border border-primary-300' : ''
             ]"
             @click="handleDayClick(day)"
           >
              <span class="text-sm font-bold" :class="{'text-accent-sky': day.isToday}">
                {{ day.date.getDate() }}
              </span>

              <div class="flex flex-wrap justify-center gap-1 mt-1 w-full px-1">
                 <div 
                   v-for="trip in day.trips" 
                   :key="trip.id" 
                   class="w-full h-1.5 rounded-full"
                   :class="getTripColor(trip)"
                 ></div>
                 <span v-if="day.trips.length > 0 && day.isCurrentMonth" class="text-[10px] truncate w-full text-center text-primary-600 font-medium px-0.5">
                    {{ day.trips[0]?.campsite_name }}
                 </span>
              </div>
              
              <!-- Mobile Tooltip (on tap/hover) -->
              <div v-if="day.trips.length > 0 && day.isCurrentMonth" class="absolute bottom-full mb-2 hidden group-hover/day:block group-active/day:block z-50 pointer-events-none">
                <div class="bg-primary-900 text-white text-xs px-3 py-1.5 rounded-lg shadow-xl whitespace-nowrap relative">
                  {{ day.trips[0]?.campsite_name }}
                  <div class="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-primary-900"></div>
                </div>
              </div>
           </div>
        </div>
     </div>

     <!-- Desktop View: Full Year Grid -->
     <div class="hidden md:block flex-1 p-8 overflow-y-auto">
        <div class="grid grid-cols-3 xl:grid-cols-4 gap-8">
           <div v-for="(month, mIdx) in fullYearMonths" :key="mIdx" class="bg-white rounded-3xl p-5 border border-primary-100 hover:shadow-lg transition-all duration-300 hover:scale-[1.02] group card-organic">
              <h3 class="text-lg font-bold text-primary-800 mb-3 pl-1 border-l-4 border-primary-400 group-hover:text-primary-600 transition-colors">&nbsp;{{ month.name }}</h3>
              
              <div class="grid grid-cols-7 mb-2 text-center text-[10px] font-medium text-primary-300">
                <div>一</div><div>二</div><div>三</div><div>四</div><div>五</div><div class="text-primary-500">六</div><div class="text-accent-orange/60">日</div>
              </div>

              <div class="grid grid-cols-7 gap-1">
                 <div 
                   v-for="(day, dIdx) in month.days" 
                   :key="dIdx" 
                   class="relative aspect-square rounded-lg flex flex-col items-center justify-center transition-all cursor-pointer group/day"
                   :class="[
                     day.isCurrentMonth ? 'text-primary-700' : 'text-primary-100',
                     day.isToday ? 'bg-primary-50 font-bold text-accent-sky' : 'hover:bg-primary-50',
                     day.trips.length > 0 ? 'bg-white ring-1 ring-accent-sky/30 shadow-sm' : ''
                   ]"
                   @click="handleDayClick(day)"
                 >
                    <span class="text-xs">{{ day.date.getDate() }}</span>
                    <!-- Desktop 只有小圓點 -->
                    <div v-if="day.trips.length > 0" class="absolute bottom-1 w-1.5 h-1.5 rounded-full" :class="getTripColor(day.trips[0]!)"></div>
                    
                    <!-- Tooltip -->
                    <div v-if="day.trips.length > 0" class="absolute bottom-full mb-2 hidden group-hover/day:block z-50 whitespace-nowrap">
                      <div class="bg-primary-900 text-white text-[10px] px-2 py-1 rounded shadow-lg relative">
                        {{ day.trips[0]?.campsite_name }}
                        <div class="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-primary-900"></div>
                      </div>
                    </div>
                 </div>
              </div>
           </div>
        </div>
     </div>
  </div>
</template>
