<script setup lang="ts">
import { ref } from 'vue'
import { X, Upload, MapPin, CheckCircle, AlertCircle, Loader2, Sparkles, Save } from 'lucide-vue-next'
import { supabase } from '../lib/supabase'

const emit = defineEmits(['close', 'imported'])

const rawText = ref('')
const parsedItems = ref<any[]>([])
const step = ref<'input' | 'preview' | 'processing'>('input')
const isGeocoding = ref(false)
const progress = ref(0)
const logs = ref<string[]>([])

// Google Sheet Column Mapping (Based on user screenshot)
// A: Index (Skip)
// B: Name
// C: Location
// D: Altitude
// E: Feature (e.g. Sand)
// F: Feature (e.g. Pool)
// G: Feature (e.g. View)
// H: Grass config
// I: Gravel config
// J: Roof config
// K: Deck config
// L: Glamping/Cabin (Other)
// M: Contact (Phone/FB)

const parseData = () => {
  if (!rawText.value.trim()) return

  const rows = rawText.value.trim().split('\n')
  const results = []

  for (const row of rows) {
    const cols = row.split('\t') // Google Sheet copy is usually TSV
    if (cols.length < 3) continue // Skip invalid lines

    // Auto-detect offset based on Altitude location
    
    let offset = 0
    // Check if col 2 corresponds to Altitude (numeric)
    const rawCol2 = cols[2] || ''
    
    if (!isNaN(parseFloat(rawCol2)) && isFinite(parseFloat(rawCol2))) {
       offset = -1 // Shift back by 1 (Name is at 0)
    }

    const name = cols[1 + offset]?.trim()
    if (!name || name === '名稱') continue // Skip header or empty name

    const location = cols[2 + offset]?.trim() || ''
    const altitude = parseInt(cols[3 + offset]?.trim() || '0') || null
    
    // Config & Tags Extraction
    const tags: string[] = []
    const zoneConfigParts: string[] = []

    // Features (Offset + 4, 5, 6)
    const features = [cols[4 + offset], cols[5 + offset], cols[6 + offset]]
    features.forEach(f => {
      if (f && f.trim()) tags.push(f.trim())
    })

    // Zone Configs (Offset + 7...11) - Check if exists first
    const grass = cols[7 + offset]?.trim()
    if (grass) { tags.push('草地'); zoneConfigParts.push(`草地: ${grass}`) }
    
    const gravel = cols[8 + offset]?.trim()
    if (gravel) { tags.push('碎石'); zoneConfigParts.push(`碎石: ${gravel}`) }
    
    const roof = cols[9 + offset]?.trim()
    if (roof) { tags.push('雨棚'); zoneConfigParts.push(`雨棚: ${roof}`) }
    
    const deck = cols[10 + offset]?.trim()
    if (deck) { tags.push('棧板'); zoneConfigParts.push(`棧板: ${deck}`) }
    
    const other = cols[11 + offset]?.trim()
    if (other) { tags.push('免搭/其他'); zoneConfigParts.push(`其他: ${other}`) }

    // Contact (Offset + 12)
    const contact = cols[12 + offset]?.trim() || ''
    let phone = ''
    if (contact && (contact.match(/\d{8,}/) || contact.includes('09'))) {
       phone = contact 
    } else if (contact) {
       // If it's text like "FB", maybe push to tags or notes? For now valid phone check is simple
    }

    results.push({
      name,
      location,
      altitude,
      tags,
      zone_config: zoneConfigParts.join('\n'),
      phone,
      latitude: null as number | null,
      longitude: null as number | null,
      city: location, // Use full string instead of substring(0,3) to avoid truncation (e.g. 嘉義梅山)
      status: 'pending' // pending geocoding
    })
  }

  parsedItems.value = results
  step.value = 'preview'
}

// Auto Geocoding
const startGeocoding = async () => {
  isGeocoding.value = true
  progress.value = 0
  logs.value = []
  
  const total = parsedItems.value.length
  let processed = 0

  for (const item of parsedItems.value) {
    // Basic rate limit prevention (Nominatim requires 1 sec delay usually)
    await new Promise(r => setTimeout(r, 1100))

    try {
      const query = `台灣 ${item.location} ${item.name}`
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`
      
      const res = await fetch(url)
      const data = await res.json()

      if (data && data.length > 0) {
        item.latitude = parseFloat(data[0].lat)
        item.longitude = parseFloat(data[0].lon)
        item.status = 'found'
        logs.value.unshift(`✅ 找到座標: ${item.name}`)
      } else {
        item.status = 'missing'
        logs.value.unshift(`⚠️ 找不到座標: ${item.name} (${query})`)
      }
    } catch (e) {
      item.status = 'error'
      logs.value.unshift(`❌ 錯誤: ${item.name}`)
    }
    
    processed++
    progress.value = Math.round((processed / total) * 100)
  }

  isGeocoding.value = false
}

// Batch Insert
const saveToDb = async () => {
  if (parsedItems.value.length === 0) return

  step.value = 'processing'
  logs.value = ['準備寫入資料庫...']

  try {
    const records = parsedItems.value.map(item => ({
      name: item.name,
      latitude: item.latitude,
      longitude: item.longitude,
      altitude: item.altitude,
      city: item.city,
      tags: item.tags,
      phone: item.phone,
      zone_config: item.zone_config,
      is_verified: true // Imported by Admin, assume verified
    }))

    const { error } = await (supabase.from('campsites') as any).insert(records)

    if (error) throw error

    logs.value.push(`🎉 成功匯入 ${records.length} 筆資料！`)
    setTimeout(() => {
       emit('imported')
       emit('close')
    }, 2000)
    
  } catch (e) {
    console.error(e)
    logs.value.push(`❌ 寫入失敗: ${(e as any).message}`)
    step.value = 'preview' // Go back
  }
}
</script>

<template>
  <div class="fixed inset-0 z-50 overflow-hidden flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
    <div class="bg-white w-full max-w-4xl h-[85vh] rounded-2xl shadow-2xl flex flex-col relative animate-in fade-in zoom-in-95 duration-200">
      
      <!-- Header -->
      <div class="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-2xl">
        <h2 class="text-xl font-bold text-gray-800 flex items-center gap-2">
           <Upload class="w-5 h-5 text-primary-600" />
           批次匯入營地 (Google Sheets)
        </h2>
        <button @click="$emit('close')" class="p-2 hover:bg-white rounded-full transition-colors text-gray-500">
          <X class="w-6 h-6" />
        </button>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-hidden flex flex-col p-6">
        
        <!-- STEP 1: INPUT -->
        <div v-if="step === 'input'" class="flex-1 flex flex-col h-full">
           <div class="mb-4 bg-blue-50 border border-blue-100 p-4 rounded-xl text-sm text-blue-700">
             <h4 class="font-bold mb-1 flex items-center gap-2"><Sparkles class="w-4 h-4" /> 使用說明</h4>
             <p>1. 複製您的 Google Sheet 內容 (包含 B~L 欄，不含標題)。</p>
             <p>2. 直接貼入下方文字框。</p>
             <p>3. 系統將自動解析名稱、地點、海拔以及營位配置。</p>
           </div>
           
           <textarea 
             v-model="rawText"
             class="flex-1 w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-mono text-sm focus:ring-2 focus:ring-primary-500 outline-none resize-none"
             placeholder="在此貼上 Excel/Sheet 內容..."
           ></textarea>

           <div class="mt-4 flex justify-end">
             <button 
               @click="parseData"
               :disabled="!rawText.trim()"
               class="px-6 py-2.5 bg-primary-900 text-white font-bold rounded-xl hover:bg-black transition-all disabled:opacity-50 flex items-center gap-2"
             >
               下一步：解析資料
             </button>
           </div>
        </div>

        <!-- STEP 2: PREVIEW & GEOCODING -->
        <div v-else-if="step === 'preview'" class="flex-1 flex flex-col h-full overflow-hidden">
           
           <div class="mb-4 flex gap-4 min-h-[100px]">
             <!-- Stats -->
             <div class="flex-1 bg-gray-50 rounded-xl p-4 border border-gray-100">
                <div class="flex justify-between items-center mb-2">
                   <h3 class="font-bold text-gray-700">解析結果</h3>
                   <span class="text-2xl font-black text-primary-600">{{ parsedItems.length }}</span>
                </div>
                <div class="h-2 bg-gray-200 rounded-full overflow-hidden">
                   <div class="h-full bg-green-500 transition-all duration-300" :style="{ width: `${progress}%` }"></div>
                </div>
                <p class="text-xs text-gray-500 mt-2 flex justify-between">
                   <span>座標取得進度</span>
                   <span>{{ progress }}%</span>
                </p>
             </div>
             
             <!-- Actions -->
             <div class="flex flex-col gap-2 justify-center">
                <button 
                  v-if="!isGeocoding && progress < 100"
                  @click="startGeocoding" 
                  class="px-4 py-2 bg-blue-100 text-blue-700 font-bold rounded-lg hover:bg-blue-200 transition text-sm flex items-center gap-2"
                >
                  <MapPin class="w-4 h-4" />
                  開始抓取座標
                </button>
                <div v-if="isGeocoding" class="px-4 py-2 bg-gray-100 text-gray-500 font-bold rounded-lg text-sm flex items-center gap-2">
                  <Loader2 class="w-4 h-4 animate-spin" />
                  抓取中...
                </div>
             </div>
           </div>

           <!-- Table -->
           <div class="flex-1 overflow-auto border border-gray-200 rounded-xl">
             <table class="w-full text-sm text-left">
               <thead class="bg-gray-50 text-gray-600 font-bold sticky top-0 z-10 shadow-sm">
                 <tr>
                   <th class="p-3">狀態</th>
                   <th class="p-3">名稱</th>
                   <th class="p-3">地點</th>
                   <th class="p-3">海拔</th>
                   <th class="p-3">營位配置</th>
                   <th class="p-3">標籤</th>
                   <th class="p-3">座標 (Lat, Lng)</th>
                 </tr>
               </thead>
               <tbody class="divide-y divide-gray-100">
                 <tr v-for="(item, idx) in parsedItems" :key="idx" class="hover:bg-gray-50">
                   <td class="p-3">
                     <span v-if="item.status === 'found'" class="text-green-500"><CheckCircle class="w-4 h-4" /></span>
                     <span v-else-if="item.status === 'missing'" class="text-orange-400"><AlertCircle class="w-4 h-4" /></span>
                     <span v-else-if="item.status === 'error'" class="text-red-500"><X class="w-4 h-4" /></span>
                     <span v-else class="text-gray-300"><Loader2 class="w-4 h-4" v-if="isGeocoding" /></span>
                   </td>
                   <td class="p-3 font-medium">{{ item.name }}</td>
                   <td class="p-3 text-gray-500">{{ item.location }}</td>
                   <td class="p-3 font-mono text-gray-500">{{ item.altitude ? item.altitude + 'm' : '-' }}</td>
                   <td class="p-3 text-xs text-gray-500 whitespace-pre-wrap">{{ item.zone_config || '-' }}</td>
                   <td class="p-3">
                      <div class="flex flex-wrap gap-1">
                        <span v-for="t in item.tags" :key="t" class="px-1.5 py-0.5 bg-gray-100 rounded text-xs text-gray-600">{{ t }}</span>
                      </div>
                   </td>
                   <td class="p-3 font-mono text-xs">
                     <span v-if="item.latitude">{{ item.latitude?.toFixed(4) }}, {{ item.longitude?.toFixed(4) }}</span>
                     <span v-else class="text-gray-300">-</span>
                   </td>
                 </tr>
               </tbody>
             </table>
           </div>

           <!-- Footer Actions -->
           <div class="mt-4 flex justify-between items-center">
              <div class="text-xs text-gray-500 h-6 overflow-hidden w-1/2">
                 <div v-if="logs.length > 0" class="animate-pulse">{{ logs[0] }}</div>
              </div>
              <div class="flex gap-3">
                 <button @click="step = 'input'" :disabled="isGeocoding" class="px-4 py-2 text-gray-500 hover:text-gray-800 font-bold transition">上一步</button>
                 <button 
                   @click="saveToDb"
                   :disabled="isGeocoding || parsedItems.length === 0"
                   class="px-6 py-2 bg-primary-900 text-white font-bold rounded-xl hover:bg-black transition-all disabled:opacity-50 flex items-center gap-2"
                 >
                   <Save class="w-4 h-4" />
                   確認匯入 ({{ parsedItems.length }}筆)
                 </button>
              </div>
           </div>

        </div>

        <!-- STEP 3: PROCESSING -->
        <div v-else class="flex-1 flex flex-col items-center justify-center p-12 text-center">
           <Loader2 class="w-12 h-12 animate-spin text-primary-500 mb-4" />
           <h3 class="text-xl font-bold text-gray-800 mb-2">正在寫入資料庫...</h3>
           <p class="text-gray-500 mb-8">請稍候，這可能需要幾秒鐘。</p>
           
           <div class="w-full max-w-md bg-gray-100 rounded-xl p-4 h-48 overflow-y-auto text-left font-mono text-xs text-gray-600">
              <div v-for="(log, i) in logs" :key="i">{{ log }}</div>
           </div>
        </div>

      </div>
    </div>
  </div>
</template>
