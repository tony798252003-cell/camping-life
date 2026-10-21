<template>
  <div class="h-full">
    <GearROIView v-if="mode === 'advanced-gear'" :trips="trips" />
    <TentManagement v-else :trips="trips" />
  </div>
</template>

<script setup lang="ts">
import type { CampingTripWithCampsite } from '../../types/database'
import GearROIView from '../GearROIView.vue'
import TentManagement from '../TentManagement.vue'

defineProps<{
  mode: 'tent' | 'advanced-gear'
  trips?: CampingTripWithCampsite[]
}>()
</script>
