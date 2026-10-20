<script setup lang="ts">
import { useUserProfile } from '../../composables/useUserProfile'

const { showCpbl, setShowCpbl } = useUserProfile()
</script>

<template>
  <button
    class="shrink-0 px-3 py-1 rounded-full text-xs font-bold border transition-colors"
    :class="showCpbl ? 'bg-[#9d1c32] text-white border-transparent' : 'text-gray-400 border-gray-300 bg-transparent'"
    :aria-pressed="showCpbl"
    @click="setShowCpbl(!showCpbl)"
  >⚾ 桃猿</button>
</template>
