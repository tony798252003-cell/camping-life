<script setup lang="ts">
import { computed } from 'vue'
import type { Campsite } from '../../types/database'

const props = defineProps<{
  form: Partial<Campsite>
  isEditable?: boolean
}>()
const nightRushStart = defineModel<string>('nightRushStart', { required: true })
const nightRushEnd = defineModel<string>('nightRushEnd', { required: true })
const showerStart = defineModel<string>('showerStart', { required: true })
const showerEnd = defineModel<string>('showerEnd', { required: true })
const isShower24H = defineModel<boolean>('isShower24H', { required: true })

const generateTimeRange = (startHour: number, endHour: number) => {
  const times = []
  for (let i = startHour; i <= endHour; i++) {
    const padded = i.toString().padStart(2, '0')
    if (i === 24) {
       times.push('24:00') // Handle end of day explicitly if needed
       continue
    }
    times.push(`${padded}:00`)
    if (i !== endHour) {
       times.push(`${padded}:30`)
    }
  }
  return times
}

const checkInOptions = computed(() => generateTimeRange(8, 14))
const checkOutOptions = computed(() => generateTimeRange(11, 15))
const nightRushStartOptions = computed(() => generateTimeRange(15, 18))
const nightRushEndOptions = computed(() => generateTimeRange(22, 24))
const showerStartOptions = computed(() => generateTimeRange(7, 10))
const showerEndOptions = computed(() => generateTimeRange(20, 24))
</script>

<template>
         <!-- Rules & Timings (v2) -->
         <div>
             <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">時間與規範</label>
             <div class="grid grid-cols-2 gap-4">
                  <!-- Check In -->
                  <div>
                      <label class="text-xs text-gray-400 block mb-1">一般進場</label>
                      <select v-if="isEditable" v-model="form.check_in_time" class="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm appearance-none">
                         <option value="" disabled>請選擇</option>
                         <option v-for="t in checkInOptions" :key="t" :value="t">{{ t }}</option>
                      </select>
                      <div v-else class="text-sm font-bold text-gray-900">{{ form.check_in_time || '--:--' }}</div>
                  </div>
                  <!-- Check Out -->
                  <div>
                      <label class="text-xs text-gray-400 block mb-1">一般離場</label>
                      <select v-if="isEditable" v-model="form.check_out_time" class="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm appearance-none">
                         <option value="" disabled>請選擇</option>
                         <option v-for="t in checkOutOptions" :key="t" :value="t">{{ t }}</option>
                      </select>
                      <div v-else class="text-sm font-bold text-gray-900">{{ form.check_out_time || '--:--' }}</div>
                  </div>
                  <!-- Night Rush -->
                  <div class="col-span-2">
                      <label class="text-xs text-gray-400 block mb-1">夜衝時段</label>
                      <div v-if="isEditable" class="flex items-center gap-2">
                        <select v-model="nightRushStart" class="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm appearance-none">
                           <option value="" disabled>開始</option>
                           <option v-for="t in nightRushStartOptions" :key="t" :value="t">{{ t }}</option>
                        </select>
                        <span class="text-gray-400">-</span>
                        <select v-model="nightRushEnd" class="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm appearance-none">
                           <option value="" disabled>結束</option>
                           <option v-for="t in nightRushEndOptions" :key="t" :value="t">{{ t }}</option>
                        </select>
                      </div>
                      <div v-else class="text-sm font-bold text-indigo-700">{{ form.night_rush_time || '未提供' }}</div>
                  </div>
                  <!-- Shower -->
                  <div class="col-span-2">
                      <div class="flex items-center justify-between mb-1">
                          <label class="text-xs text-gray-400">熱水供應</label>
                          <div v-if="isEditable" class="flex items-center gap-1">
                             <input type="checkbox" v-model="isShower24H" id="shower24h" class="rounded text-primary-600 focus:ring-primary-500 w-3 h-3" />
                             <label for="shower24h" class="text-xs text-gray-500 cursor-pointer">24H</label>
                          </div>
                      </div>
                      <div v-if="isEditable">
                          <div v-if="!isShower24H" class="flex items-center gap-2">
                             <select v-model="showerStart" class="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm appearance-none">
                                <option value="" disabled>開始</option>
                                <option v-for="t in showerStartOptions" :key="t" :value="t">{{ t }}</option>
                             </select>
                             <span class="text-gray-400">-</span>
                             <select v-model="showerEnd" class="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm appearance-none">
                                <option value="" disabled>結束</option>
                                <option v-for="t in showerEndOptions" :key="t" :value="t">{{ t }}</option>
                             </select>
                          </div>
                          <div v-else class="p-2 bg-gray-100 text-gray-500 text-sm rounded-lg text-center">
                             全天候供應
                          </div>
                      </div>
                      <div v-else class="text-sm font-bold text-gray-900">{{ form.shower_restrictions || '未提供' }}</div>
                  </div>
             </div>
         </div>
</template>
