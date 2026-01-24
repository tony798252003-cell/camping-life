<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'
import L from 'leaflet'
import type { CampingTrip, CampingTripWithCampsite } from '../types/database'

interface Props {
  trips: CampingTripWithCampsite[]
}

const props = defineProps<Props>()

const mapContainer = ref<HTMLElement | null>(null)
let map: L.Map | null = null
const markers: L.Marker[] = []

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

    // 添加 OpenStreetMap 圖層
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 18
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
  markers.forEach(marker => marker.remove())
  markers.length = 0

  // 添加新標記
  const bounds: [number, number][] = []

  props.trips.forEach(trip => {
    const lat = trip.campsites?.latitude ?? trip.latitude
    const lng = trip.campsites?.longitude ?? trip.longitude
    
    if (lat && lng) {
      const marker = L.marker([lat, lng], {
        icon: L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41]
        })
      }).addTo(map!)

      // 創建彈出視窗內容
      const popupContent = `
        <div class="p-2">
          <h3 class="font-bold text-lg mb-1">${trip.campsites?.name || trip.campsite_name}</h3>
          <p class="text-sm text-gray-600 mb-1">📍 ${trip.campsites?.city ? (trip.campsites.city + (trip.campsites.district || '')) : (trip.location || '未提供地點')}</p>
          ${(trip.campsites?.altitude || trip.altitude) ? `<p class="text-sm text-gray-600 mb-1">⛰️ 海拔 ${(trip.campsites?.altitude || trip.altitude)}m</p>` : ''}
          <p class="text-sm text-gray-600">📅 ${new Date(trip.trip_date).toLocaleDateString('zh-TW')}</p>
          ${trip.cost > 0 ? `<p class="text-sm text-green-600 font-semibold mt-1">💰 NT$ ${trip.cost.toLocaleString()}</p>` : ''}
        </div>
      `

      marker.bindPopup(popupContent)
      markers.push(marker)
      bounds.push([lat, lng])
    }
  })

  // 如果有標記，調整地圖視野以包含所有標記
  if (bounds.length > 0) {
    map.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [50, 50] })
  }
}
</script>

<template>
  <div class="bg-white rounded-lg shadow-md overflow-hidden">
    <div class="p-4 bg-gray-50 border-b">
      <h2 class="text-xl font-bold text-gray-900">營地地圖</h2>
      <p class="text-sm text-gray-600 mt-1">
        顯示 {{ trips.filter(t => t.latitude && t.longitude).length }} 個營地位置
      </p>
    </div>
    <div ref="mapContainer" class="w-full h-[500px] md:h-[calc(100vh-250px)]"></div>
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
</style>
