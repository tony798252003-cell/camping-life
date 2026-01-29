<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'
import L from 'leaflet'
import type { CampingTripWithCampsite } from '../types/database'

interface Props {
  trips: CampingTripWithCampsite[]
}

const props = defineProps<Props>()

const mapContainer = ref<HTMLElement | null>(null)
let map: L.Map | null = null
const markers = ref<L.Layer[]>([])

onMounted(async () => {
  await nextTick()
  initMap()
})

watch(() => props.trips, () => {
  if (map) {
    updateMarkers()
  }
}, { deep: true })

const initMap = () => {
  if (!mapContainer.value) return

  try {
    // 創建地圖，中心點設在台灣
    map = L.map(mapContainer.value).setView([23.5, 121], 8)

    // 添加更美觀的地圖圖層 (CartoDB Voyager)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap contributors © CARTO',
      maxZoom: 19,
      subdomains: 'abcd'
    }).addTo(map)

    // 添加標記
    updateMarkers()
  } catch (error) {
    console.error('地圖初始化失敗:', error)
  }
}

const updateMarkers = () => {
  if (!map) return

  // 清除現有標記
  markers.value.forEach(marker => marker.remove())
  markers.value = []

  // 添加新標記
  const bounds: [number, number][] = []
  
  // 找出最近的未來行程（下次露營）
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const upcomingTrips = props.trips
    .filter(t => new Date(t.trip_date) >= today)
    .sort((a, b) => new Date(a.trip_date).getTime() - new Date(b.trip_date).getTime())
  
  const nextTripId = upcomingTrips[0]?.id
  let nextTripMarker: L.CircleMarker | null = null

  props.trips.forEach(trip => {
    const lat = trip.campsites?.latitude ?? trip.latitude
    const lng = trip.campsites?.longitude ?? trip.longitude
    
    if (lat && lng) {
      const tripDate = new Date(trip.trip_date)
      const isPast = tripDate < today
      const isNext = trip.id === nextTripId
      
      // 根據狀態選擇顏色 (已去過=藍色，未來=灰色)
      let fillColor = '#9ca3af' // 灰色 - 未來行程
      let strokeColor = '#fff'
      let radius = 8
      
      if (isNext) {
        // 下次露營 - 橘色，較大
        fillColor = '#f97316'
        radius = 10
      } else if (isPast) {
        // 過去行程 - 藍色
        fillColor = '#3b82f6'
      }
      
      // 使用簡潔的圓形標記
      const marker = L.circleMarker([lat, lng], {
        radius: radius,
        fillColor: fillColor,
        color: strokeColor,
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8,
        className: isNext ? 'next-trip-marker' : ''
      })

      // 創建彈出視窗內容
      const statusBadge = isNext 
        ? '<span class="px-2 py-0.5 bg-orange-100 text-orange-600 rounded-full text-xs font-bold">📍 下次露營</span>'
        : isPast 
          ? '<span class="px-2 py-0.5 bg-blue-100 text-blue-600 rounded-full text-xs font-bold">✓ 已去過</span>'
          : '<span class="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-xs font-bold">🗓️ 未來行程</span>'
      
      const popupContent = `
        <div class="p-2">
          <div class="mb-2">${statusBadge}</div>
          <h3 class="font-bold text-lg mb-1">${trip.campsites?.name || trip.campsite_name}</h3>
          <p class="text-sm text-gray-600 mb-1">📍 ${trip.campsites?.city ? (trip.campsites.city + (trip.campsites.district || '')) : (trip.location || '未提供地點')}</p>
          ${(trip.campsites?.altitude || trip.altitude) ? `<p class="text-sm text-gray-600 mb-1">⛰️ 海拔 ${(trip.campsites?.altitude || trip.altitude)}m</p>` : ''}
          <p class="text-sm text-gray-600">📅 ${new Date(trip.trip_date).toLocaleDateString('zh-TW')}</p>
        </div>
      `

      marker.bindPopup(popupContent)
      
      // 如果是下次露營，暫存起來最後才加入（確保在最上層）
      if (isNext) {
        nextTripMarker = marker
      } else {
        marker.addTo(map!)
        markers.value.push(marker)
      }
      
      bounds.push([lat, lng])
    }
  })
  
  // 最後加入下次露營標記，確保在最上層
  if (nextTripMarker) {
    nextTripMarker.addTo(map!)
    markers.value.push(nextTripMarker)
  }

  // 如果有標記，調整地圖視野以包含所有標記
  if (bounds.length > 0) {
    map.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [50, 50] })
  }
}
</script>

<template>
  <div class="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
    <div class="p-4 bg-gradient-to-r from-blue-50 to-white border-b border-gray-100">
      <h2 class="text-lg font-bold text-gray-900 flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
        營地地圖
      </h2>
      <p class="text-xs text-gray-500 mt-1">
        顯示 {{ markers.length }} 個地點
      </p>
    </div>
    <div ref="mapContainer" class="w-full h-[500px] md:h-[calc(100vh-250px)]"></div>
    
    <!-- 圖例 -->
    <div class="p-3 bg-gray-50 border-t border-gray-100 flex flex-wrap gap-3 text-xs">
      <div class="flex items-center gap-1.5">
        <span class="w-3 h-3 rounded-full bg-orange-500 border-2 border-white shadow-sm"></span>
        <span class="text-gray-600 font-medium">下次露營</span>
      </div>
      <div class="flex items-center gap-1.5">
        <span class="w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-white shadow-sm"></span>
        <span class="text-gray-600 font-medium">已去過</span>
      </div>
      <div class="flex items-center gap-1.5">
        <span class="w-2.5 h-2.5 rounded-full bg-gray-400 border-2 border-white shadow-sm"></span>
        <span class="text-gray-600 font-medium">未來行程</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Leaflet 樣式覆蓋 */
:deep(.leaflet-popup-content-wrapper) {
  border-radius: 8px;
}

:deep(.leaflet-popup-content) {
  margin: 0;
}

/* 下次露營標記動畫 - 僅縮放不移動 */
:deep(.next-trip-marker) {
  animation: pulse-scale 1s ease-in-out infinite;
}

@keyframes pulse-scale {
  0%, 100% {
    r: 10;
    opacity: 0.8;
  }
  50% {
    r: 14;
    opacity: 1;
  }
}
</style>
