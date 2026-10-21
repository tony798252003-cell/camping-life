<script setup lang="ts">
import { CloudRain, Wind, Tent, Star, Pencil } from 'lucide-vue-next'
import type { NewCampingTrip } from '../../types/database'
import PhotoGallery from '../PhotoGallery.vue'

// 事後紀錄：評分、天氣狀況、心得、照片。新增模式收合在「出發後再填」（規格 §5.6）
defineProps<{
  form: NewCampingTrip
  tripId?: number | null
  collapsed?: boolean
}>()
</script>

<template>
  <component :is="collapsed ? 'details' : 'div'" class="flex flex-col">
    <summary v-if="collapsed" class="cursor-pointer text-sm font-bold text-gray-500 px-1 py-2 mt-6 select-none">出發後再填（評分、心得、照片）</summary>
                  <!-- Section Header: Ratings -->
                  <h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 mt-6 px-1">評分</h3>

                  <div class="card-organic bg-white p-5 flex flex-col gap-4">
                      <!-- Scenery -->
                      <div class="flex items-center justify-between">
                          <span class="text-sm font-bold text-gray-600">風景</span>
                          <div class="flex items-center gap-1">
                              <button 
                                v-for="i in 5" 
                                :key="`scenery-${i}`"
                                type="button"
                                @click="form.scenery = i"
                                class="focus:outline-none transition-transform active:scale-90"
                              >
                                  <Star 
                                    class="w-6 h-6 transition-colors" 
                                    :class="i <= (form.scenery || 0) ? 'text-amber-400 fill-amber-400' : 'text-gray-200'" 
                                  />
                              </button>
                          </div>
                      </div>

                      <!-- Cleanliness -->
                      <div class="flex items-center justify-between">
                          <span class="text-sm font-bold text-gray-600">整潔</span>
                          <div class="flex items-center gap-1">
                              <button 
                                v-for="i in 5" 
                                :key="`cleanliness-${i}`"
                                type="button"
                                @click="form.cleanliness = i"
                                class="focus:outline-none transition-transform active:scale-90"
                              >
                                  <Star 
                                    class="w-6 h-6 transition-colors" 
                                    :class="i <= (form.cleanliness || 0) ? 'text-amber-400 fill-amber-400' : 'text-gray-200'" 
                                  />
                              </button>
                          </div>
                      </div>

                      <!-- Road Condition -->
                      <div class="flex items-center justify-between">
                          <span class="text-sm font-bold text-gray-600">路況</span>
                          <div class="flex items-center gap-1">
                              <button 
                                v-for="i in 5" 
                                :key="`road-${i}`"
                                type="button"
                                @click="form.road_condition = i"
                                class="focus:outline-none transition-transform active:scale-90"
                              >
                                  <Star 
                                    class="w-6 h-6 transition-colors" 
                                    :class="i <= (form.road_condition || 0) ? 'text-amber-400 fill-amber-400' : 'text-gray-200'" 
                                  />
                              </button>
                          </div>
                      </div>
                  </div>



                  <h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 mt-6 px-1">CONDITIONS & NOTES</h3>

                  <!-- Tags (Toggleable Buttons) -->
                  <div class="flex flex-wrap gap-2 py-2">
                       <!-- Night Rush moved to header -->
                       <button type="button" @click="form.is_rainy = !form.is_rainy" 
                         class="px-4 py-2 rounded-xl flex items-center gap-2 transition-all border"
                         :class="form.is_rainy ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-gray-100 text-gray-400 grayscale'">
                           <CloudRain class="w-4 h-4" /> <span class="text-sm font-bold">下雨</span>
                       </button>
                       <button type="button" @click="form.is_windy = !form.is_windy" 
                         class="px-4 py-2 rounded-xl flex items-center gap-2 transition-all border"
                         :class="form.is_windy ? 'bg-gray-100 border-gray-200 text-gray-600' : 'bg-white border-gray-100 text-gray-400 grayscale'">
                           <Wind class="w-4 h-4" /> <span class="text-sm font-bold">大風</span>
                       </button>
                       <button type="button" @click="form.is_wet_tent = !form.is_wet_tent" 
                         class="px-4 py-2 rounded-xl flex items-center gap-2 transition-all border"
                         :class="form.is_wet_tent ? 'bg-orange-50 border-orange-200 text-orange-600' : 'bg-white border-gray-100 text-gray-400 grayscale'">
                           <Tent class="w-4 h-4" /> <span class="text-sm font-bold">收濕帳</span>
                       </button>
                  </div>

                  <!-- Notes -->
                  <div class="card-organic bg-white p-5">
                      <div class="flex items-center gap-2 mb-2 text-primary-900 font-bold">
                         <Pencil class="w-4 h-4" /> 心得筆記
                      </div>
                      <textarea 
                         v-model="form.notes"
                         rows="4"
                         placeholder="寫下這次的回憶..."
                         class="w-full bg-surface-50/50 border-none rounded-xl p-3 text-primary-900 focus:bg-white focus:ring-2 focus:ring-primary-100 transition-all placeholder-gray-400 text-sm leading-relaxed"
                      ></textarea>
                  </div>

                  <!-- Section Header: Gallery -->
                  <h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 mt-6 px-1">GALLERY</h3>

                  <!-- Gallery -->
                  <div v-if="tripId">
                      <PhotoGallery :tripId="tripId" :isEditable="true" />
                  </div>
  </component>
</template>
