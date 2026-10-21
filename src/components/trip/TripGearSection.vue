<script setup lang="ts">
import { computed } from 'vue'
import { Tent, Users, Home, ChevronLeft } from 'lucide-vue-next'
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
</script>

<template>
                       <!-- 2. Zone -->
                      <div class="card-organic bg-white p-4 flex items-center gap-3 overflow-hidden">
                          <div class="w-10 h-10 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-500 shrink-0">
                              <Tent class="w-5 h-5" />
                          </div>
                          <div class="flex flex-col min-w-0">
                              <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">營位</span>
                              <input 
                                v-model="form.zone" 
                                type="text" 
                                placeholder="未指定"
                                class="bg-transparent border-none p-0 text-base font-black text-gray-800 w-full focus:ring-0 leading-tight"
                              />
                          </div>
                      </div>

                       <!-- 3. Campsite Fee -->
                      <div class="card-organic bg-white p-4 flex items-center gap-3 overflow-hidden">
                           <div class="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-500 shrink-0">
                              <span class="font-bold text-lg">$</span>
                          </div>
                          <div class="flex flex-col min-w-0">
                              <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">營位費</span>
                              <input 
                                v-model.number="form.cost" 
                                type="number" 
                                placeholder="未提供"
                                class="bg-transparent border-none p-0 text-base font-black text-gray-800 w-full focus:ring-0 leading-tight placeholder:text-gray-300"
                              />
                          </div>
                      </div>

                      <!-- 4. Companions -->
                      <div class="card-organic bg-white p-4 flex items-center gap-3 overflow-hidden">
                          <div class="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-500 shrink-0">
                              <Users class="w-5 h-5" />
                          </div>
                          <div class="flex flex-col min-w-0">
                              <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">露友</span>
                              <input 
                                v-model="form.companions" 
                                type="text" 
                                placeholder="無"
                                class="bg-transparent border-none p-0 text-base font-black text-gray-800 w-full focus:ring-0 leading-tight"
                              />
                          </div>
                      </div>

                      <!-- 5. Tent Selection -->
                      <div class="card-organic bg-white p-4 flex items-center gap-3 overflow-hidden">
                           <div class="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-500 shrink-0 overflow-hidden">
                              <img 
                                v-if="form.tent_id && tents.find(t => t.id === form.tent_id)?.image_url" 
                                :src="tents.find(t => t.id === form.tent_id)?.image_url || ''" 
                                class="w-full h-full object-contain"
                              />
                              <Home v-else class="w-5 h-5" />
                           </div>
                           <div class="flex flex-col flex-1 min-w-0">
                                <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">使用帳篷</span>
                                <div class="relative w-full">
                                  <select 
                                    v-model="form.tent_id" 
                                    class="w-full bg-transparent border-none p-0 font-black text-gray-800 focus:ring-0 cursor-pointer appearance-none pr-6 truncate"
                                    :class="{
                                       'text-gray-400': !form.tent_id,
                                       'text-base': selectedTentNameLength < 8,
                                       'text-sm': selectedTentNameLength >= 8 && selectedTentNameLength < 14,
                                       'text-xs': selectedTentNameLength >= 14
                                    }"
                                  >
                                       <option :value="undefined">未選擇</option>
                                       <option v-for="tent in tents" :key="tent.id" :value="tent.id">{{ tent.name }}</option>
                                  </select>
                                  <div class="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                     <ChevronLeft class="w-4 h-4 -rotate-90" />
                                  </div>
                                </div>
                           </div>
                      </div>
</template>
