<script setup lang="ts">
import { OWNER_COLOR, OWNER_LABEL, type Owner } from '../../utils/calendar/visibility'

const OWNERS: Owner[] = ['family', 'me']
</script>

<template>
  <div class="flex gap-3.5 text-xs font-bold text-slate-600">
    <span v-for="o in OWNERS" :key="o" class="flex items-center gap-1.5">
      <span class="w-2.5 h-2.5 rounded-full" :style="{ backgroundColor: OWNER_COLOR[o] }"></span>{{ OWNER_LABEL[o] }}
    </span>
  </div>
</template>
