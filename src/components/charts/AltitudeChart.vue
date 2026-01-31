<script setup lang="ts">
import { computed } from 'vue'
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
}>()

const chartData = computed(() => {
  // Sort trips by date
  const sortedTrips = [...props.trips].sort((a, b) => new Date(a.trip_date).getTime() - new Date(b.trip_date).getTime())

  return {
    datasets: [
      {
        label: '海拔高度 (m)',
        backgroundColor: (context: any) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 400);
          gradient.addColorStop(0, 'rgba(14, 165, 233, 0.5)'); // Sky blue
          gradient.addColorStop(1, 'rgba(14, 165, 233, 0.0)');
          return gradient;
        },
        borderColor: '#0ea5e9', // Sky 500
        pointBackgroundColor: '#0284c7', // Sky 600
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: '#0284c7',
        fill: true,
        tension: 0.4, // Smooth curves
        data: sortedTrips.map(t => {
          const date = new Date(t.trip_date)
          // Map date to 0-11.99 range (e.g. Jan 1 = 0, Jan 15 ~ 0.5)
          const monthIndex = date.getMonth()
          const day = date.getDate()
          const daysInMonth = new Date(date.getFullYear(), monthIndex + 1, 0).getDate()
          const xVal = monthIndex + (day / daysInMonth)
          
          return {
            x: xVal,
            y: t.altitude || t.campsites?.altitude || 0,
            // Custom data for tooltip
            tripName: t.campsite_name || t.campsites?.name || '未知名稱',
            tripDate: t.trip_date
          }
        })
      }
    ]
  }
})

const chartOptions = {
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
      padding: 12,
      displayColors: false,
      callbacks: {
        title: (context: any) => {
           const raw = context[0].raw
           return `${raw.tripDate} ${raw.tripName}`
        },
        label: (context: any) => `⛰️ 海拔: ${context.raw.y} m`
      }
    }
  },
  scales: {
    x: {
      type: 'linear' as const,
      min: 0,
      max: 11,
      grid: {
        display: true, // Show grid for months
        color: '#f1f5f9'
      },
      ticks: {
         stepSize: 1,
         callback: (value: string | number) => {
             // value is 0-11
             const numValue = typeof value === 'string' ? parseFloat(value) : value
             return `${Math.floor(numValue) + 1}月`
         },
         font: {
            family: "'Inter', sans-serif",
            size: 10
         }
      }
    },
    y: {
      beginAtZero: true,
      grid: {
        color: '#f1f5f9',
        borderDash: [5, 5]
      },
      ticks: {
        padding: 10,
        font: {
            family: "'Inter', sans-serif",
            size: 10
        }
      }
    }
  },
  interaction: {
      intersect: false,
      mode: 'index' as const
  }
}
</script>

<template>
  <div class="h-[300px] w-full">
    <Line :data="chartData" :options="chartOptions" />
  </div>
</template>
