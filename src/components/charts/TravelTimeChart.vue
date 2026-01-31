<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import type { CampingTripWithCampsite } from '../../types/database'
import { DEFAULT_ORIGIN, estimateTripDuration } from '../../composables/useTravelTime'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

const props = defineProps<{
  trips: CampingTripWithCampsite[]
  userOrigin?: { lat: number; lng: number } | null
}>()

const scrollContainer = ref<HTMLElement | null>(null)
const durations = ref<Record<number, number>>({}) // tripId -> mins
const isCalculating = ref(false)

// Processed Data
const sortedTrips = computed(() => {
    return [...props.trips]
      .filter(t => (t.latitude || t.campsites?.latitude)) 
      .sort((a, b) => new Date(a.trip_date).getTime() - new Date(b.trip_date).getTime()) 
})

// Calculate durations
const calculateAllDurations = async () => {
    isCalculating.value = true
    for (const t of sortedTrips.value) {
        // Skip if already calculated
        if (durations.value[t.id]) continue;

        // Determine Start
        const sLat = t.start_latitude || props.userOrigin?.lat || DEFAULT_ORIGIN.lat
        const sLon = t.start_longitude || props.userOrigin?.lng || DEFAULT_ORIGIN.lng

        // Determine End
        const dLat = t.latitude || t.campsites?.latitude
        const dLon = t.longitude || t.campsites?.longitude

        if (dLat && dLon) {
             const sec = await estimateTripDuration(dLat, dLon, sLat, sLon)
             if (sec) {
                 durations.value[t.id] = Math.round(sec / 60) // Store as minutes
             }
        }
    }
    isCalculating.value = false
}

// Watch for trips change to recalc
watch(() => props.trips, () => {
    calculateAllDurations()
}, { immediate: true })

// Max Y Logic
const maxDuration = computed(() => {
    const vals = Object.values(durations.value)
    if (vals.length === 0) return 60
    return Math.max(...vals)
})

const suggestedMaxY = computed(() => {
    // Round up to nearest 30 to keep scales clean
    return Math.ceil((maxDuration.value + 10) / 30) * 30
})

const chartData = computed(() => {
  return {
    labels: sortedTrips.value.map(t => `${t.trip_date.split('-')[1]}/${t.trip_date.split('-')[2]} ${t.campsite_name || t.campsites?.name || '未知'}`),
    datasets: [
      {
        label: '車程 (分鐘)',
        backgroundColor: (context: any) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 300);
          gradient.addColorStop(0, 'rgba(139, 92, 246, 0.5)'); 
          gradient.addColorStop(1, 'rgba(139, 92, 246, 0.0)');
          return gradient;
        },
        borderColor: '#8b5cf6',
        pointBackgroundColor: '#7c3aed',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: '#7c3aed',
        fill: true,
        tension: 0.4,
        data: sortedTrips.value.map(t => durations.value[t.id] || 0)
      }
    ]
  }
})

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      titleColor: '#1e293b',
      bodyColor: '#475569',
      borderColor: '#e2e8f0',
      borderWidth: 1,
      padding: 12,
      displayColors: false,
      callbacks: {
         label: (context: any) => {
             const mins = context.raw
             const h = Math.floor(mins / 60)
             const m = mins % 60
             return `🚗 預估車程: ${mins}分 (${h > 0 ? h + '小時' : ''}${m}分)`
         }
      }
    }
  },
  scales: {
    x: {
      grid: { display: false, drawBorder: false },
      ticks: {
         maxRotation: 45,
         minRotation: 45,
         font: { family: "'Inter', sans-serif", size: 10 },
         color: '#94a3b8'
      }
    },
    y: {
      beginAtZero: true,
      min: 0,
      max: suggestedMaxY.value,
      grid: { color: '#f1f5f9', borderDash: [5, 5], drawBorder: false },
      ticks: { display: false } // Hide Y-Axis Labels as requested
    }
  },
  interaction: { intersect: false, mode: 'index' as const }
}))

const ITEM_WIDTH = 50 // px

// Calculate logic width
const chartWidth = computed(() => {
    const minWidth = 600
    const totalWidth = Math.max(minWidth, sortedTrips.value.length * ITEM_WIDTH)
    return `${totalWidth}px`
})

const centerOnNextTrip = () => {
    if (!scrollContainer.value || sortedTrips.value.length === 0) return

    // Find index of first future trip or today
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    let targetIndex = sortedTrips.value.findIndex(t => new Date(t.trip_date) >= today)
    
    // If no future trip, focus on the last one (latest past)
    if (targetIndex === -1) {
        targetIndex = sortedTrips.value.length - 1
    }

    const containerWidth = scrollContainer.value.clientWidth
    const targetLeft = targetIndex * ITEM_WIDTH
    
    // Center logic: Item position - Half Container + Half Item (Approx)
    // Adjusting a bit to ensure it feels centered
    const scrollPos = targetLeft - (containerWidth / 2) + (ITEM_WIDTH / 2)
    
    scrollContainer.value.scrollLeft = scrollPos
}

// Ensure scroll on load and data change
onMounted(() => {
    setTimeout(centerOnNextTrip, 100)
})

watch(sortedTrips, () => {
    setTimeout(centerOnNextTrip, 100)
})
</script>

<template>
  <div class="relative w-full overflow-hidden pt-4">
      <!-- Title Overlay -->
      <span class="absolute top-0 left-0 text-[10px] text-slate-400 z-30 pointer-events-none pl-1">分鐘</span>

      <div ref="scrollContainer" class="w-full overflow-x-auto pb-2 scrollbar-hide relative h-[280px]">
        <div :style="{ width: chartWidth, height: '100%' }">
            <Line :data="chartData" :options="chartOptions" />
        </div>
      </div>
      
      <!-- Fade Hint -->
      <div class="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent pointer-events-none z-10 lg:hidden"></div>
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
    display: none;
}
.scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
}
</style>
