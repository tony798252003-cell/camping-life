<script setup lang="ts">
import { Mountain, Moon, Snowflake, IceCream, Droplets, AlarmClock } from 'lucide-vue-next'

// 營區資訊：海拔、冷藏/冷凍/飲水、進退場與夜衝時段（唯讀；放在父層的 grid 內）
defineProps<{
  trip?: any
  altitude?: number | null
}>()
</script>

<template>
                      <!-- 1. Altitude & Facilities (Combined, Full Width) -->
                      <div class="col-span-2 card-organic bg-white p-3 flex items-center justify-between gap-4 overflow-hidden">
                          <!-- Altitude Section -->
                          <div class="flex items-center gap-3 pl-1">
                              <div class="w-10 h-10 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-500 shrink-0">
                                  <Mountain class="w-5 h-5" />
                              </div>
                              <div class="flex flex-col min-w-0">
                                  <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">海拔</span>
                                  <div class="flex items-baseline">
                                      <span class="text-xl font-black text-gray-800">{{ altitude || '--' }}</span>
                                      <span class="text-xs text-gray-400 ml-1 font-bold">m</span>
                                  </div>
                              </div>
                          </div>

                          <!-- Divider -->
                          <div class="w-px h-8 bg-gray-100"></div>

                          <!-- Facilities Section -->
                          <div class="flex items-center gap-3 md:gap-6 pr-2">
                               <!-- Fridge -->
                               <div class="flex flex-col items-center gap-1 min-w-[24px]">
                                   <div class="relative w-6 h-6 flex items-center justify-center">
                                       <Snowflake class="w-full h-full" :class="trip?.campsites?.amenities?.has_fridge ? 'text-sky-500' : 'text-slate-200'" />
                                       <div v-if="!trip?.campsites?.amenities?.has_fridge" class="absolute w-[140%] h-[2px] bg-red-400/50 rotate-45 rounded-full z-10"></div>
                                   </div>
                                   <span class="text-[10px] font-bold mt-0.5" :class="trip?.campsites?.amenities?.has_fridge ? 'text-sky-700' : 'text-slate-300'">冷藏</span>
                               </div>
                               <!-- Freezer -->
                               <div class="flex flex-col items-center gap-1 min-w-[24px]">
                                   <div class="relative w-6 h-6 flex items-center justify-center">
                                       <IceCream class="w-full h-full" :class="trip?.campsites?.amenities?.has_freezer ? 'text-indigo-500' : 'text-slate-200'" />
                                       <div v-if="!trip?.campsites?.amenities?.has_freezer" class="absolute w-[140%] h-[2px] bg-red-400/50 rotate-45 rounded-full z-10"></div>
                                   </div>
                                   <span class="text-[10px] font-bold mt-0.5" :class="trip?.campsites?.amenities?.has_freezer ? 'text-indigo-700' : 'text-slate-300'">冷凍</span>
                               </div>
                               <!-- Water -->
                               <div class="flex flex-col items-center gap-1 min-w-[24px]">
                                   <div class="relative w-6 h-6 flex items-center justify-center">
                                       <Droplets class="w-full h-full" :class="trip?.campsites?.amenities?.has_water_dispenser ? 'text-teal-500' : 'text-slate-200'" />
                                       <div v-if="!trip?.campsites?.amenities?.has_water_dispenser" class="absolute w-[140%] h-[2px] bg-red-400/50 rotate-45 rounded-full z-10"></div>
                                   </div>
                                   <span class="text-[10px] font-bold mt-0.5" :class="trip?.campsites?.amenities?.has_water_dispenser ? 'text-teal-700' : 'text-slate-300'">飲水</span>
                               </div>
                          </div>
                      </div>

                      <!-- 1.5 Time Info Card (Check-in/out, Night Rush, Shower) -->
                      <h3 class="col-span-2 text-xs font-bold text-gray-400 uppercase tracking-widest mt-2 px-1" v-if="trip?.campsites">
                          TIME & RULES
                      </h3>
                      <div class="col-span-2 card-organic bg-white p-3 md:p-4 flex items-center gap-3 overflow-hidden" v-if="trip?.campsites">
                          <!-- Icon -->
                          <div class="w-10 h-10 rounded-2xl bg-teal-50 flex items-center justify-center text-teal-500 shrink-0">
                              <AlarmClock class="w-5 h-5" />
                          </div>
                          
                          <!-- Content -->
                          <div class="flex-1 min-w-0">
                              <!-- Header Label inside? No, user wanted title outside. Labels for values are okay. -->
                              <!-- Header Label inside? No, user wanted title outside. Labels for values are okay. -->
                              <div class="grid grid-cols-3 divide-x divide-gray-100">
                                  <!-- Check In/Out -->
                                  <div class="flex flex-col items-center px-1">
                                      <span class="text-[10px] font-bold text-gray-400 mb-0.5">進場 / 離場</span>
                                      <div class="flex items-center gap-1 font-black text-gray-800 text-sm md:text-base leading-tight">
                                          <span>{{ trip.campsites.check_in_time || '--:--' }}</span>
                                          <span class="text-gray-300">/</span>
                                          <span>{{ trip.campsites.check_out_time || '--:--' }}</span>
                                      </div>
                                  </div>

                                  <!-- Night Rush -->
                                  <div class="flex flex-col items-center px-1" v-if="trip.campsites.night_rush_time">
                                      <span class="text-[10px] font-bold text-indigo-300 mb-0.5">夜衝時段</span>
                                      <div class="flex items-center gap-1 font-black text-indigo-600 text-sm md:text-base leading-tight">
                                          <Moon class="w-3 h-3" />
                                          <span>{{ trip.campsites.night_rush_time }}</span>
                                      </div>
                                  </div>
                                  
                                  <!-- Hot Water -->
                                  <div class="flex flex-col items-center px-1" v-if="trip.campsites.shower_restrictions">
                                      <span class="text-[10px] font-bold text-rose-300 mb-0.5">熱水供應</span>
                                      <div class="flex items-center gap-1 font-black text-rose-500 text-sm md:text-base leading-tight">
                                          <Droplets class="w-3 h-3" />
                                          <span>{{ trip.campsites.shower_restrictions }}</span>
                                      </div>
                                  </div>
                              </div>
                          </div>
                      </div>
</template>
