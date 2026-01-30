<script setup lang="ts">
import { computed } from 'vue'
import { Doughnut } from 'vue-chartjs'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js'
import type { CampingTripWithCampsite } from '../../types/database'

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend
)

const props = defineProps<{
  trips: CampingTripWithCampsite[]
}>()

const filteredTrips = computed(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return props.trips.filter(t => new Date(t.trip_date) < today)
})

const chartData = computed(() => {
  const nightRushCount = filteredTrips.value.filter(t => t.night_rush).length
  const normalCount = filteredTrips.value.length - nightRushCount

  return {
    labels: ['夜衝', '一般'],
    datasets: [
      {
        backgroundColor: ['#6366f1', '#e2e8f0'], // Indigo 500, Slate 200
        borderWidth: 0,
        data: [nightRushCount, normalCount]
      }
    ]
  }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '70%', // Donut thickness
  plugins: {
    legend: {
      position: 'bottom' as const,
      labels: {
        usePointStyle: true,
        padding: 20,
        font: {
            family: "'Inter', sans-serif",
            size: 12
        }
      }
    },
    tooltip: {
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      titleColor: '#1e293b',
      bodyColor: '#475569',
      borderColor: '#e2e8f0',
      borderWidth: 1,
      padding: 12,
      displayColors: true,
      callbacks: {
        label: (context: any) => {
            const label = context.label || '';
            const value = context.raw || 0;
            const total = context.chart._metasets[context.datasetIndex].total;
            const percentage = Math.round((value / total) * 100) + '%';
            return `${label}: ${value} 次 (${percentage})`;
        }
      }
    }
  }
}

const percentage = computed(() => {
    if (filteredTrips.value.length === 0) return 0
    return Math.round((filteredTrips.value.filter(t => t.night_rush).length / filteredTrips.value.length) * 100)
})
</script>

<template>
  <div class="h-[250px] w-full relative flex items-center justify-center">
    <Doughnut :data="chartData" :options="chartOptions" />
    
    <!-- Central Text -->
    <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
        <div class="text-3xl font-black text-indigo-500">{{ percentage }}%</div>
        <div class="text-xs text-slate-400 font-medium uppercase tracking-wider">夜衝率</div>
    </div>
  </div>
</template>
