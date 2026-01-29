<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Plus, Trash2, Calculator, RotateCcw } from 'lucide-vue-next'
import { supabase } from '../lib/supabase'
import type { CampingGear, NewGearItem, CampingTripWithCampsite } from '../types/database'

const props = defineProps<{
  trips?: CampingTripWithCampsite[]
}>()

const items = ref<CampingGear[]>([])
const loading = ref(false)

// Default examples for reset
const defaultExamples: NewGearItem[] = [
  { name: '屋脊13', base_usage_count: 19, cost: 8992, price: 8992, rental_price: 1400, type: 'tent', category: 'tent', purchase_date: new Date().toISOString() },
  { name: 'CC3', base_usage_count: 12, cost: 34400, price: 34400, rental_price: 2700, type: 'tent', category: 'tent', purchase_date: new Date().toISOString() },
  { name: '天幕', base_usage_count: 13, cost: 4400, price: 4400, rental_price: 800, type: 'tarp', category: 'tarp', purchase_date: new Date().toISOString() },
]

// Fetch Data
const fetchGear = async () => {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return

  loading.value = true
  try {
    const { data, error } = await supabase
      .from('camping_gear')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: true })

    if (error) throw error
    items.value = data || []
  } catch (error) {
    console.error('Error fetching gear:', error)
    alert('無法載入裝備資料')
  } finally {
    loading.value = false
  }
}

// Actions
const addItem = async () => {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return

  try {
    const newItem: NewGearItem = {
      name: '新裝備',
      base_usage_count: 0,
      cost: 0,
      price: 0,
      rental_price: 0,
      type: 'other',
      category: 'other',
      purchase_date: new Date().toISOString(),
      user_id: session.user.id
    }
    
    const { data, error } = await (supabase
      .from('camping_gear') as any)
      .insert([newItem])
      .select()
      .single()


    if (error) throw error
    if (data) {
      items.value.push(data)
    }
  } catch (error) {
    console.error('Error adding item:', error)
    alert('新增失敗')
  }
}

const updateItem = async (item: CampingGear) => {
  try {
    const { error } = await (supabase
      .from('camping_gear') as any)
      .update({
        name: item.name,
        base_usage_count: item.base_usage_count,
        cost: item.cost,
        rental_price: item.rental_price,
        type: item.type
      })
      .eq('id', item.id)

    if (error) throw error
    // Update local state is automatic via v-model, but verified by no error
  } catch (error) {
    console.error('Error updating item:', error)
    alert('無法儲存變更！請確認您已執行 Supabase 的 SQL 更新腳本 (fix_gear_schema.sql)。')
  }
}

const removeItem = async (id: number) => {
  try {
    const { error } = await supabase
      .from('camping_gear')
      .delete()
      .eq('id', id)

    if (error) throw error
    items.value = items.value.filter(item => item.id !== id)
  } catch (error) {
    console.error('Error deleting item:', error)
    alert('刪除失敗')
  }
}

const resetData = async () => {
  loading.value = true
  try {
    // 1. Delete all existing
    if (items.value.length > 0) {
       const ids = items.value.map(i => i.id)
       const { error: delError } = await supabase
        .from('camping_gear')
        .delete()
        .in('id', ids)
       if (delError) throw delError
    }

    // 2. Insert defaults
    const { data, error: insError } = await (supabase
      .from('camping_gear') as any)
      .insert(defaultExamples)
      .select()

    
    if (insError) throw insError
    items.value = data || []
    
  } catch (error) {
    console.error('Error resetting data:', error)
    alert('重置失敗')
  } finally {
    loading.value = false
  }
}

// Calculations
const getLinkedUsage = (item: CampingGear) => {
  if (!props.trips) return 0
  
  if (item.type === 'tarp') {
    // Tent uses ID matching, Tarp uses boolean check (simplified logic)
    // Counts ANY trip that has a tarp as a usage for THIS tarp
    // If user has multiple tarps, this might overcount, but aligns with "simple yes/no" GUI
    return props.trips.filter(t => t.has_tarp).length
  }
  
  // Default (Tent) uses ID matching
  return props.trips.filter(t => t.tent_id === item.id).length
}

const getTotalUsage = (item: CampingGear) => {
  const base = item.base_usage_count || 0
  const linked = getLinkedUsage(item)
  return base + linked
}

const calculateSavings = (item: CampingGear) => {
  const total = getTotalUsage(item)
  return (total * item.rental_price) - item.cost
}

const calculateAvgPerUse = (item: CampingGear) => {
  const total = getTotalUsage(item)
  if (total === 0) return item.cost
  return Math.round(item.cost / total)
}

const totalSavings = computed(() => {
  return items.value.reduce((sum, item) => sum + calculateSavings(item), 0)
})

const totalCost = computed(() => {
  return items.value.reduce((sum, item) => sum + item.cost, 0)
})

onMounted(() => {
  fetchGear()
})
</script>

<template>
  <div class="p-6 max-w-4xl mx-auto pb-24 font-sans">
    <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
      <div class="flex-1 min-w-0">
        <h2 class="text-xl md:text-2xl font-black text-primary-900 flex items-center gap-2 tracking-tight">
          <Calculator class="w-5 h-5 md:w-6 md:h-6 text-accent-orange flex-shrink-0" />
          <span>裝備回本計算機</span>
        </h2>
        <p class="text-primary-500 text-xs md:text-sm mt-1 font-medium">計算你的裝備是否已經「露回本」了？</p>
      </div>
      
      <div class="flex gap-2 flex-shrink-0">
         <button 
          @click="resetData"
          class="p-2 text-primary-300 hover:text-primary-600 hover:bg-surface-100 rounded-full transition"
          title="重置範例資料"
        >
          <RotateCcw class="w-5 h-5" />
        </button>
        <button 
          @click="addItem"
          class="flex items-center gap-1 bg-primary-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-primary-500/20 hover:bg-primary-700 transition active:scale-95 hover:shadow-xl whitespace-nowrap"
          :disabled="loading"
        >
          <Plus class="w-4 h-4" />
          <span class="hidden md:inline">新增裝備</span>
          <span class="md:hidden">新增</span>
        </button>
      </div>
    </div>

    <!-- Summary Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
      <div class="bg-white rounded-3xl p-6 shadow-sm border border-primary-100 card-organic">
        <div class="text-primary-400 text-sm font-bold mb-1">總投入成本</div>
        <div class="text-3xl font-black text-primary-900">
          NT$ {{ totalCost.toLocaleString() }}
        </div>
      </div>
      <div 
        class="rounded-3xl p-6 shadow-sm border card-organic"
        :class="totalSavings >= 0 ? 'bg-emerald-50/50 border-emerald-100' : 'bg-red-50/50 border-red-100'"
      >
        <div class="text-sm font-bold mb-1" :class="totalSavings >= 0 ? 'text-emerald-600' : 'text-red-600'">
          總省下金額 (ROI)
        </div>
        <div class="text-3xl font-black" :class="totalSavings >= 0 ? 'text-emerald-700' : 'text-red-700'">
          NT$ {{ totalSavings.toLocaleString() }}
        </div>
        <div class="text-xs mt-2 opacity-75 font-medium" :class="totalSavings >= 0 ? 'text-emerald-800' : 'text-red-800'">
          (租借價值總和 - 購買成本)
        </div>
      </div>
    </div>

    <!-- Gear List Container -->
    <div class="relative min-h-[200px]">
       <div v-if="loading" class="absolute inset-0 bg-white/80 z-10 flex items-center justify-center rounded-2xl backdrop-blur-sm">
         <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>

      <!-- Desktop View (Table) -->
      <div class="hidden md:block bg-white rounded-3xl shadow-sm border border-primary-50 overflow-hidden card-organic">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-surface-50 border-b border-primary-50">
                <th class="p-4 text-xs font-bold text-primary-400 uppercase tracking-wider w-[15%]">分類</th>
              <th class="p-4 text-xs font-bold text-primary-400 uppercase tracking-wider w-[20%]">裝備名稱</th>
              <th class="p-4 text-xs font-bold text-primary-400 uppercase tracking-wider text-right w-[15%]">使用次數<br><span class="text-[10px] font-normal text-primary-300">(歷史 + 行程)</span></th>
              <th class="p-4 text-xs font-bold text-primary-400 uppercase tracking-wider text-right w-[12%]">購入成本</th>
              <th class="p-4 text-xs font-bold text-primary-400 uppercase tracking-wider text-right w-[12%]">租借行情</th>
                <th class="p-4 text-xs font-bold text-primary-400 uppercase tracking-wider text-right w-[18%]">目前省下</th>
                <th class="p-4 text-xs font-bold text-primary-400 uppercase tracking-wider text-right w-[15%]">平均單次</th>
                <th class="p-4 w-[5%]"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-primary-50">
              <tr v-for="item in items" :key="item.id" class="group hover:bg-primary-50/30 transition">
                  <!-- Type -->
                <td class="p-4">
                   <select 
                      v-model="item.type"
                      @change="updateItem(item)"
                      class="bg-surface-50 border-none rounded-lg text-sm p-1.5 font-bold text-primary-700 focus:ring-2 focus:ring-primary-500 cursor-pointer hover:bg-white transition-colors"
                   >
                      <option value="tent">⛺ 帳篷</option>
                      <option value="tarp">⛱️ 天幕</option>
                      <option value="other">📦 其他</option>
                   </select>
                </td>

                <td class="p-4">
                  <input 
                    v-model="item.name" 
                    @change="updateItem(item)"
                    class="w-full bg-transparent border-none p-0 focus:ring-0 font-bold text-primary-900 placeholder-primary-200"
                    placeholder="輸入名稱..."
                  />
                </td>
                
                <!-- Usage (Calculated) -->
                <td class="p-4 text-right">
                  <div class="flex flex-col items-end">
                     <!-- Big Total -->
                     <span class="font-black text-primary-900 text-lg">
                        {{ getTotalUsage(item) }} 次
                     </span>
                     
                     <!-- Breakdown -->
                     <div class="flex items-center gap-1 text-[10px] text-primary-300 mt-0.5">
                       <span title="行程自動統計">{{ getLinkedUsage(item) }} 自動</span>
                       <span>+</span>
                       <div class="relative group/edit">
                          <span class="cursor-pointer border-b border-primary-100 hover:border-primary-400 hover:text-primary-600 transition-colors">
                            {{ item.base_usage_count || 0 }} 歷史
                          </span>
                          <!-- Hover Input for Base -->
                          <div class="absolute right-0 top-full mt-1 bg-white shadow-xl rounded-lg p-2 z-20 border border-primary-100 hidden group-hover/edit:block w-32">
                             <label class="block text-[10px] font-bold text-primary-400 mb-1">歷史/初始次數</label>
                             <input 
                                v-model.number="item.base_usage_count"
                                @change="updateItem(item)"
                                type="number"
                                class="w-full bg-surface-50 border border-primary-100 rounded px-2 py-1 text-xs font-mono focus:ring-2 focus:ring-primary-500 outline-none text-primary-700"
                              />
                          </div>
                       </div>
                     </div>
                  </div>
                </td>
                <td class="p-4 text-right">
                  <div class="flex items-center justify-end gap-1 text-primary-300 focus-within:text-primary-900">
                    <span class="text-xs">$</span>
                    <input 
                      v-model.number="item.cost"
                       @change="updateItem(item)"
                      type="number"
                      class="w-20 bg-transparent border-none p-0 focus:ring-0 text-right font-mono font-medium text-primary-600"
                    />
                  </div>
                </td>
                <td class="p-4 text-right">
                   <div class="flex items-center justify-end gap-1 text-primary-300 focus-within:text-primary-900">
                    <span class="text-xs">$</span>
                    <input 
                      v-model.number="item.rental_price"
                       @change="updateItem(item)"
                      type="number"
                      class="w-20 bg-transparent border-none p-0 focus:ring-0 text-right font-mono font-medium text-primary-600"
                    />
                  </div>
                </td>
                <td class="p-4 text-right">
                  <span 
                    class="font-black font-mono"
                    :class="calculateSavings(item) >= 0 ? 'text-emerald-600' : 'text-red-500'"
                  >
                    {{ calculateSavings(item).toLocaleString() }}
                  </span>
                </td>
                <td class="p-4 text-right">
                  <span class="text-primary-400 font-mono text-sm font-medium">
                    {{ calculateAvgPerUse(item).toLocaleString() }}
                  </span>
                </td>
                <td class="p-4 text-center">
                  <button 
                    @click="removeItem(item.id)"
                    class="text-primary-200 hover:text-red-500 transition opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 class="w-4 h-4" />
                  </button>
                </td>
              </tr>
              <tr v-if="items.length === 0 && !loading">
                <td colspan="7" class="p-12 text-center text-primary-300 text-sm font-medium">
                  還沒有裝備資料，點擊右上角新增
                </td>
              </tr>
            </tbody>
          </table>
          <div class="bg-surface-50 px-4 py-3 border-t border-primary-50 text-xs text-primary-400 text-right font-medium">
            * 變更會自動儲存到資料庫
          </div>
        </div>
      </div>

      <!-- Mobile View (Cards) -->
      <div class="md:hidden space-y-3">
        <div v-for="item in items" :key="item.id" class="bg-white rounded-2xl shadow-sm border border-primary-50 p-5 relative card-organic">
           
           <!-- Remove Button (Top Right) -->
           <button 
            @click="removeItem(item.id)"
            class="absolute top-4 right-4 text-primary-200 hover:text-red-500 p-1"
          >
            <Trash2 class="w-5 h-5" />
          </button>

          <!-- Header: Type & Name -->
          <div class="mb-4 pr-8">
             <div class="flex items-center gap-2 mb-2">
                 <select 
                      v-model="item.type"
                      @change="updateItem(item)"
                      class="bg-surface-50 border-none rounded-lg text-xs p-1 font-bold text-primary-500 focus:ring-0 cursor-pointer"
                   >
                      <option value="tent">帳篷</option>
                      <option value="tarp">天幕</option>
                      <option value="other">其他</option>
                   </select>
             </div>
            <input 
              v-model="item.name" 
              @change="updateItem(item)"
              class="w-full bg-transparent border-b border-primary-100 p-0 pb-1 focus:ring-0 focus:border-primary-500 font-black text-xl text-primary-900 placeholder-primary-200"
              placeholder="輸入名稱..."
            />
          </div>

          <!-- Metrics Grid -->
          <div class="grid grid-cols-2 gap-4 mb-4">
             <!-- Usage -->
             <div>
                <label class="text-xs font-bold text-primary-400 mb-1 block">出勤次數 (總計)</label>
                <div class="flex items-center bg-surface-50 rounded-lg px-3 py-2 justify-between border border-primary-50">
                   <div class="flex items-baseline gap-1">
                      <span class="text-primary-900 font-mono font-bold text-lg">{{ getTotalUsage(item) }}</span>
                      <span class="text-xs text-primary-400">次</span>
                   </div>
                   
                   <!-- Mobile Base Edit -->
                   <div class="flex flex-col items-end border-l border-primary-100 pl-2 ml-2">
                      <div class="text-[10px] text-primary-300">歷史</div>
                      <input 
                        v-model.number="item.base_usage_count"
                        @change="updateItem(item)"
                        type="number"
                        class="w-10 bg-transparent text-right text-xs font-medium text-primary-500 focus:text-primary-700 border-b border-transparent focus:border-primary-300 p-0"
                      />
                   </div>
                </div>
             </div>

             <!-- Rental Price -->
             <div>
                <label class="text-xs font-bold text-primary-400 mb-1 block flex items-center gap-1">
                   租借行情
                   <span class="text-[10px] bg-blue-50 text-blue-600 px-1 rounded">/次</span>
                </label>
                <div class="flex items-center bg-surface-50 rounded-lg px-3 py-2 border border-primary-50">
                   <span class="text-primary-300 mr-1">$</span>
                   <input 
                    v-model.number="item.rental_price"
                    @change="updateItem(item)"
                    type="number"
                    class="w-full bg-transparent border-none p-0 focus:ring-0 text-primary-900 font-mono font-bold"
                  />
                </div>
             </div>

             <!-- Cost -->
             <div>
                <label class="text-xs font-bold text-primary-400 mb-1 block">購入成本</label>
                <div class="flex items-center bg-surface-50 rounded-lg px-3 py-2 border border-primary-50">
                   <span class="text-primary-300 mr-1">$</span>
                   <input 
                    v-model.number="item.cost"
                    @change="updateItem(item)"
                    type="number"
                    class="w-full bg-transparent border-none p-0 focus:ring-0 text-primary-900 font-mono font-bold"
                  />
                </div>
             </div>

             <!-- Avg Cost -->
             <div>
                 <label class="text-xs font-bold text-primary-400 mb-1 block">平均單次</label>
                 <div class="flex items-center px-1 py-2 h-[38px]">
                    <span class="text-primary-500 font-mono font-black">
                      ${{ calculateAvgPerUse(item).toLocaleString() }}
                    </span>
                 </div>
             </div>
          </div>

          <!-- Result Footer -->
          <div class="pt-4 border-t border-primary-50 flex justify-between items-center">
             <span class="text-sm font-bold text-primary-500">目前省下 (ROI)</span>
             <span 
                class="font-black font-mono text-xl"
                :class="calculateSavings(item) >= 0 ? 'text-emerald-600' : 'text-red-500'"
              >
                {{ calculateSavings(item) >= 0 ? '+' : '' }}{{ calculateSavings(item).toLocaleString() }}
              </span>
          </div>
        </div>

        <div v-if="items.length === 0 && !loading" class="text-center py-10 text-primary-300 font-medium">
           還沒有裝備資料，點擊右上角新增
        </div>
        
        <div class="text-center text-xs text-primary-300 py-2">
          * 數值自動儲存
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
/* Remove spinner from number inputs */
input[type=number]::-webkit-inner-spin-button, 
input[type=number]::-webkit-outer-spin-button { 
  -webkit-appearance: none; 
  margin: 0; 
}
</style>
