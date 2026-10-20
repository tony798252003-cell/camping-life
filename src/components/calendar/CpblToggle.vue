<script setup lang="ts">
import { useUserProfile } from '../../composables/useUserProfile'

const { showCpbl, setShowCpbl } = useUserProfile()
</script>

<template>
  <button
    class="shrink-0 relative flex items-center gap-1.5 min-h-[32px] px-3 rounded-full bg-white text-xs font-bold text-primary-900 transition-opacity after:absolute after:-inset-y-2 after:inset-x-0 after:content-['']"
    :class="showCpbl ? '' : 'opacity-40'"
    :aria-pressed="showCpbl"
    @click="setShowCpbl(!showCpbl)"
  ><span class="w-2 h-2 rounded-full bg-[#9d1c32]"></span>桃猿賽程</button>
</template>
