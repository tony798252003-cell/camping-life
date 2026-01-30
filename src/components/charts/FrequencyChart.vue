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
import type { CampingTrip } from '../../types/database'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
)

const props = defineProps<{
  trips: CampingTrip[]
}>()

const chartData = computed(() => {
  const monthCounts = new Array(12).fill(0)
  
  props.trips.forEach(t => {
    const date = new Date(t.trip_date)
    const month = date.getMonth() // 0-11
    monthCounts[month]++
  })

  return {
    labels: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
    datasets: [
      {
        label: '露營次數',
        backgroundColor: '#f97316', // Orange 500
        borderRadius: 6,
        data: monthCounts
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
        title: (items: any) => `${items[0].label}`,
        label: (context: any) => `🔥 露營: ${context.raw} 次`
      }
    }
  },
  scales: {
    x: {
      grid: {
        display: false
      },
      ticks: {
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
        stepSize: 1,
        font: {
            family: "'Inter', sans-serif",
            size: 10
        }
      }
    }
  }
}
</script>

<template>
  <div class="h-[250px] w-full">
    <Bar :data="chartData" :options="chartOptions" />
  </div>
</template>
