<script setup lang="ts">
import { CalendarPlus } from 'lucide-vue-next'
import type { CpblSchedule } from '../../types/database'

defineProps<{ game: CpblSchedule | null }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'add', g: CpblSchedule): void }>()
</script>

<template>
  <Teleport to="body">
    <div v-if="game" class="fixed inset-0 z-[60] flex items-end justify-center bg-black/40" @click.self="emit('close')">
      <div class="w-full max-w-md bg-white rounded-t-3xl p-5 pb-safe shadow-xl">
        <div class="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4"></div>
        <h3 class="text-lg font-bold text-primary-900">⚾ {{ game.visiting_team_name }} vs {{ game.home_team_name }}</h3>
        <p class="text-sm text-primary-600 mt-1">{{ game.game_date }}　{{ game.field_abbe }}</p>
        <button class="w-full mt-5 flex items-center justify-center gap-1 py-3 rounded-2xl btn-primary font-bold text-sm" @click="emit('add', game)">
          <CalendarPlus class="w-4 h-4" /> 加入我的棒球事件
        </button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.pb-safe {
  padding-bottom: max(1.25rem, env(safe-area-inset-bottom, 20px));
}
</style>
