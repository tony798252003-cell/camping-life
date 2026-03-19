<script setup lang="ts">
import { ref, computed } from 'vue'
import { X, SlidersHorizontal } from 'lucide-vue-next'
import { TAIWAN_LOCATIONS } from '../constants/locations'

export interface CampsiteFilters {
  city: string
  district: string
  playgroundFeatures: string[]
  waterFeatures: string[]
  sceneryFeatures: string[]
  spotTypes: string[]
  altitudeMin: number | null
  altitudeMax: number | null
  capacityMin: number | null
}

const props = defineProps<{
  modelValue: CampsiteFilters
}>()

const emit = defineEmits<{
  (e: 'apply', filters: CampsiteFilters): void
  (e: 'close'): void
}>()

const PLAYGROUND_OPTIONS = ['溜滑梯','沙坑','盪鞦韆','遊戲室','氣墊城堡','滑草','彈簧床','兒童攀岩','棒球九宮格']
const WATER_OPTIONS = ['戲水池','溪流','河流','瀑布','湖泊','溫泉','滑水道','海邊']
const SCENERY_OPTIONS = ['櫻花','落羽松','桐花','楓葉','螢火蟲','雲海','夜景','山景','海景','湖景','森林']
const SPOT_TYPE_OPTIONS = ['草地','碎石','草地混碎石','棧板','雨棚','免搭帳']

// Local copy for editing (don't mutate props directly)
const local = ref<CampsiteFilters>({
  ...props.modelValue,
  playgroundFeatures: [...props.modelValue.playgroundFeatures],
  waterFeatures: [...props.modelValue.waterFeatures],
  sceneryFeatures: [...props.modelValue.sceneryFeatures],
  spotTypes: [...props.modelValue.spotTypes],
  capacityMin: props.modelValue.capacityMin ?? null,
})

const availableDistricts = computed(() => {
  if (!local.value.city) return []
  return TAIWAN_LOCATIONS.find(c => c.id === local.value.city)?.districts ?? []
})

function onCitySelect(cityId: string) {
  local.value.city = local.value.city === cityId ? '' : cityId
  local.value.district = ''
}

function onDistrictSelect(districtId: string) {
  local.value.district = local.value.district === districtId ? '' : districtId
}

function toggleChip(arr: string[], val: string) {
  const idx = arr.indexOf(val)
  if (idx === -1) arr.push(val)
  else arr.splice(idx, 1)
}

function reset() {
  local.value = {
    city: '',
    district: '',
    playgroundFeatures: [],
    waterFeatures: [],
    sceneryFeatures: [],
    spotTypes: [],
    altitudeMin: null,
    altitudeMax: null,
    capacityMin: null,
  }
}

function apply() {
  emit('apply', { ...local.value })
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <div class="fixed inset-0 bg-black/40 z-40" @click="emit('close')" />

    <!-- Sheet -->
    <div class="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl max-h-[85vh] flex flex-col">
      <!-- Handle -->
      <div class="flex justify-center pt-3 pb-1">
        <div class="w-10 h-1 bg-gray-300 rounded-full" />
      </div>

      <!-- Header -->
      <div class="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <div class="flex items-center gap-2 font-bold text-gray-800">
          <SlidersHorizontal class="w-4 h-4" />
          篩選條件
        </div>
        <button @click="emit('close')" class="text-gray-400 hover:text-gray-600">
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Scrollable content -->
      <div class="overflow-y-auto flex-1 px-5 py-4 space-y-5">

        <!-- 縣市 -->
        <div>
          <div class="text-sm font-semibold text-gray-600 mb-2">縣市</div>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="city in TAIWAN_LOCATIONS"
              :key="city.id"
              @click="onCitySelect(city.id)"
              class="px-3 py-1.5 rounded-full text-sm border transition-all"
              :class="local.city === city.id ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'"
            >{{ city.name }}</button>
          </div>
        </div>

        <!-- 鄉鎮 -->
        <div v-if="availableDistricts.length">
          <div class="text-sm font-semibold text-gray-600 mb-2">鄉鎮</div>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="d in availableDistricts"
              :key="d.id"
              @click="onDistrictSelect(d.id)"
              class="px-3 py-1.5 rounded-full text-sm border transition-all"
              :class="local.district === d.id ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'"
            >{{ d.name }}</button>
          </div>
        </div>

        <!-- 遊樂設施 -->
        <div>
          <div class="text-sm font-semibold text-gray-600 mb-2">遊樂設施</div>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="opt in PLAYGROUND_OPTIONS"
              :key="opt"
              @click="toggleChip(local.playgroundFeatures, opt)"
              class="px-3 py-1.5 rounded-full text-sm border transition-all"
              :class="local.playgroundFeatures.includes(opt) ? 'bg-yellow-400 text-white border-yellow-400' : 'bg-white text-gray-600 border-gray-200 hover:border-yellow-300'"
            >{{ opt }}</button>
          </div>
        </div>

        <!-- 水域設施 -->
        <div>
          <div class="text-sm font-semibold text-gray-600 mb-2">水域設施</div>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="opt in WATER_OPTIONS"
              :key="opt"
              @click="toggleChip(local.waterFeatures, opt)"
              class="px-3 py-1.5 rounded-full text-sm border transition-all"
              :class="local.waterFeatures.includes(opt) ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'"
            >{{ opt }}</button>
          </div>
        </div>

        <!-- 景觀 -->
        <div>
          <div class="text-sm font-semibold text-gray-600 mb-2">景觀</div>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="opt in SCENERY_OPTIONS"
              :key="opt"
              @click="toggleChip(local.sceneryFeatures, opt)"
              class="px-3 py-1.5 rounded-full text-sm border transition-all"
              :class="local.sceneryFeatures.includes(opt) ? 'bg-green-500 text-white border-green-500' : 'bg-white text-gray-600 border-gray-200 hover:border-green-300'"
            >{{ opt }}</button>
          </div>
        </div>

        <!-- 營位類型 -->
        <div>
          <div class="text-sm font-semibold text-gray-600 mb-2">營位類型</div>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="opt in SPOT_TYPE_OPTIONS"
              :key="opt"
              @click="toggleChip(local.spotTypes, opt)"
              class="px-3 py-1.5 rounded-full text-sm border transition-all"
              :class="local.spotTypes.includes(opt) ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300'"
            >{{ opt }}</button>
          </div>
        </div>

        <!-- 海拔 -->
        <div>
          <div class="text-sm font-semibold text-gray-600 mb-2">海拔（公尺）</div>
          <div class="flex items-center gap-3">
            <input
              v-model.number="local.altitudeMin"
              type="number"
              placeholder="最低"
              min="0"
              max="3000"
              class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
            <span class="text-gray-400">–</span>
            <input
              v-model.number="local.altitudeMax"
              type="number"
              placeholder="最高"
              min="0"
              max="3000"
              class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
          </div>
        </div>

        <!-- 最少帳數 -->
        <div>
          <div class="text-sm font-semibold text-gray-600 mb-2">最少帳數</div>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="n in [5, 10, 15, 20, 30]"
              :key="n"
              @click="local.capacityMin = local.capacityMin === n ? null : n"
              class="px-3 py-1.5 rounded-full text-sm border transition-all"
              :class="local.capacityMin === n ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'"
            >{{ n }}帳以上</button>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="px-5 py-4 border-t border-gray-100 flex gap-3">
        <button
          @click="reset"
          class="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors"
        >清除全部</button>
        <button
          @click="apply"
          class="flex-[2] py-3 rounded-xl bg-primary-600 text-white font-semibold text-sm hover:bg-primary-700 transition-colors"
        >套用篩選</button>
      </div>
    </div>
  </Teleport>
</template>
