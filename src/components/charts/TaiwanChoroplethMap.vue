<script setup lang="ts">
import type { CampingTripWithCampsite } from '../../types/database'

const props = defineProps<{
  trips: CampingTripWithCampsite[]
}>()
</script>

<template>
  <div class="relative w-full h-full flex items-center justify-center py-4">
    <svg
      viewBox="0 0 400 500"
      class="w-full max-w-md h-[400px]"
      xmlns="http://www.w3.org/2000/svg"
    >
      <!-- SVG paths will be added here -->
      <text x="200" y="250" text-anchor="middle" fill="#94a3b8" font-size="14">
        地圖載入中...
      </text>
    </svg>
  </div>
</template>
