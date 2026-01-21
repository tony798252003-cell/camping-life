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

// 切換月份
const prevMonth = () => {
  currentDate.value = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() - 1, 1)
}

const nextMonth = () => {
  currentDate.value = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() + 1, 1)
}

// 標題顯示
const monthTitle = computed(() => {
  return currentDate.value.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long' })
})

// 產生月曆該有的格子 (包含上個月剩餘、下個月開頭)
const calendarDays = computed(() => {
  const year = currentDate.value.getFullYear()
  const month = currentDate.value.getMonth()
  
  const days = []
  
  // 當月第一天
  const firstDay = new Date(year, month, 1)
  // 當月最後一天
  const lastDay = new Date(year, month + 1, 0)
  
  // 補上個月的格子 (星期幾就補幾個，0=週日)
  const startPadding = firstDay.getDay()
  for (let i = 0; i < startPadding; i++) {
    const d = new Date(year, month, -i + 1) // 倒數回去
    days.unshift({ date: d, isCurrentMonth: false, trips: [] as CampingTrip[] })
  }
  
  // 當月天數
  for (let i = 1; i <= lastDay.getDate(); i++) {
    const d = new Date(year, month, i)
    // 找出這天的行程
    const daysTrips = props.trips.filter(t => {
      const tripStart = new Date(t.trip_date)
      tripStart.setHours(0,0,0,0)
      const duration = t.duration_days || 1
      const tripEnd = new Date(tripStart.getTime())
      tripEnd.setDate(tripStart.getDate() + Math.max(0, duration - 1))
      
      // 只要這天在行程範圍內就算
      return d >= tripStart && d <= tripEnd
    })
    
    days.push({ 
      date: d, 
      isCurrentMonth: true, 
      trips: daysTrips,
      isToday: new Date().toDateString() === d.toDateString()
    })
  }
  
  // 補下個月的格子 (補滿到 35 或 42 格)
  const remainingCells = 42 - days.length
  for (let i = 1; i <= remainingCells; i++) {
    const d = new Date(year, month + 1, i)
    days.push({ date: d, isCurrentMonth: false, trips: [] as CampingTrip[] })
  }
  
  return days
})

const handleDayClick = (day: any) => {
  if (day.trips.length > 0) {
    // 預設開第一個，如果一天有多個可能要選單，但露營通常一天一個
    emit('view-detail', day.trips[0])
  }
}

// 判斷行程顏色
const getTripColor = (trip: CampingTrip) => {
  const today = new Date()
  today.setHours(0,0,0,0)
  const tripDate = new Date(trip.trip_date)
  return tripDate >= today ? 'bg-primary-500' : 'bg-gray-400'
}

</script>

<template>
  <div class="h-full flex flex-col pb-24 bg-white">
     <div class="sticky top-0 bg-white z-10 p-4 border-b border-gray-100 flex items-center justify-between">
        <h1 class="text-2xl font-black text-gray-900">露營行事曆</h1>
        <div class="flex items-center gap-4 bg-gray-50 rounded-xl p-1">
           <button @click="prevMonth" class="p-2 hover:bg-white rounded-lg transition-all shadow-sm">
             <ChevronLeft class="w-5 h-5 text-gray-600" />
           </button>
           <span class="font-bold text-gray-700 w-24 text-center">{{ monthTitle }}</span>
           <button @click="nextMonth" class="p-2 hover:bg-white rounded-lg transition-all shadow-sm">
             <ChevronRight class="w-5 h-5 text-gray-600" />
           </button>
        </div>
     </div>

     <div class="flex-1 p-4">
        <!-- 星期標題 -->
        <div class="grid grid-cols-7 mb-4">
           <div v-for="w in ['日','一','二','三','四','五','六']" :key="w" class="text-center text-sm font-bold text-gray-400 py-2">
             {{ w }}
           </div>
        </div>

        <!-- 日曆網格 -->
        <div class="grid grid-cols-7 gap-2 auto-rows-fr h-[60vh]">
           <div 
             v-for="(day, idx) in calendarDays" 
             :key="idx" 
             class="relative min-h-[60px] rounded-xl border flex flex-col items-center pt-2 transition-all cursor-pointer"
             :class="[
               day.isCurrentMonth ? 'bg-white border-gray-100 text-gray-900' : 'bg-gray-50/50 border-transparent text-gray-300',
               day.isToday ? 'ring-2 ring-primary-400 z-10' : '',
               day.trips.length > 0 ? 'hover:border-primary-200 hover:shadow-md' : 'hover:bg-gray-50'
             ]"
             @click="handleDayClick(day)"
           >
              <span class="text-sm font-bold" :class="{'text-primary-600': day.isToday}">
                {{ day.date.getDate() }}
              </span>

              <!-- 行程點點 -->
              <div class="flex flex-wrap justify-center gap-1 mt-1 w-full px-1">
                 <div 
                   v-for="trip in day.trips" 
                   :key="trip.id" 
                   class="w-full h-1.5 rounded-full"
                   :class="getTripColor(trip)"
                   :title="trip.campsite_name"
                 ></div>
                 <span v-if="day.trips.length > 0 && day.isCurrentMonth" class="text-[9px] truncate w-full text-center text-gray-500 font-medium px-0.5">
                    {{ day.trips[0]?.campsite_name }}
                 </span>
              </div>
           </div>
        </div>
     </div>
  </div>
</template>
