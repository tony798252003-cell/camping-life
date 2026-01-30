<script setup lang="ts">
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'
import type { CampingTripWithCampsite } from '../../types/database'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
)

const props = defineProps<{
  trips: CampingTripWithCampsite[]
}>()

const chartData = computed(() => {
  const counts: Record<string, number> = {}

  props.trips.forEach(t => {
    let key = '未知區域'
    
    if (t.campsites?.city && t.campsites?.district) {
      // e.g. "新竹縣 五峰鄉" -> "新竹五峰" for shorter labels if desired, or keep full
      // User asked for "新竹五峰", typically removing "縣/市/鄉/鎮" makes it cleaner but might be hard to regex perfectly.
      // Let's try to just concat first: "新竹縣五峰鄉"
      // Or simplify: Take first 2 chars of city + district.
      
      const city = t.campsites.city.replace(/[縣市]/g, '') // Remove 縣/市 suffix
      const district = t.campsites.district.replace(/[鄉鎮市區]/g, '') // Remove 鄉/鎮 suffixes
      key = `${city}${district}` 
    } else if (t.location) {
        // Fallback to location field if campsite link is missing
        // This is harder to group cleanly, maybe just take the first few chars
        key = t.location.substring(0, 3) 
    }

    counts[key] = (counts[key] || 0) + 1
  })

  // Sort by count descending
  const sortedEntries = Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8) // Top 8

  return {
    labels: sortedEntries.map(([k]) => k),
    datasets: [
      {
        label: '露營次數',
        backgroundColor: 'rgba(56, 189, 248, 0.8)', // Sky 400
        borderRadius: 4,
        data: sortedEntries.map(([, v]) => v),
        barThickness: 20
      }
    ]
  }
})

const chartOptions = {
  indexAxis: 'y' as const, // Horizontal bar
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false
    },
    tooltip: {
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      titleColor: '#1e293b',
      bodyColor: '#475569',
      borderColor: '#e2e8f0',
      borderWidth: 1,
      padding: 10,
      displayColors: false,
      callbacks: {
        label: (context: any) => `🚩 ${context.label}: ${context.raw} 次`
      }
    }
  },
  scales: {
    x: {
      grid: {
        display: false
      },
      ticks: {
         stepSize: 1,
         font: {
            family: "'Inter', sans-serif",
            size: 10
         }
      }
    },
    y: {
      grid: {
        display: false
      },
      ticks: {
        autoSkip: false,
        font: {
            family: "'Inter', sans-serif",
            size: 11,
            weight: 'bold' as const
        }
      }
    }
  }
}
</script>

<template>
  <div class="h-[300px] w-full">
    <Bar :data="chartData" :options="chartOptions" />
  </div>
</template>
