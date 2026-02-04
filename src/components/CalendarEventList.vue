<script setup lang="ts">
import { ref, computed } from 'vue'
import { Users, ChevronRight } from 'lucide-vue-next'
import type { ViewEvent } from '../types/calendarView'

const props = defineProps<{
    events: ViewEvent[]
}>()

const emit = defineEmits<{
    (e: 'click-event', event: ViewEvent): void
}>()

// Filter State
const currentFilter = ref<'all' | 'trip' | 'custom'>('all')

const sortedFilteredEvents = computed(() => {
    let filtered = props.events

    if (currentFilter.value === 'trip') {
        filtered = filtered.filter(e => e.type === 'trip')
    } else if (currentFilter.value === 'custom') {
        filtered = filtered.filter(e => e.type === 'custom')
    }

    // Sort Ascending
    return [...filtered].sort((a, b) => a.date.getTime() - b.date.getTime())
})
</script>

<template>
    <div class="px-2 h-full flex flex-col">
        <div class="flex items-center justify-between mb-4 shrink-0">
            <h3 class="text-lg font-black text-primary-800 flex items-center gap-2">
                <Users class="w-5 h-5 text-primary-500" />
                所有行程
            </h3>
            
            <!-- Filter Controls -->
            <div class="flex items-center bg-gray-100 rounded-lg p-1">
                <button 
                    v-for="filter in ['all', 'trip', 'custom']" 
                    :key="filter"
                    @click="currentFilter = filter as any"
                    class="px-3 py-1 text-xs font-bold rounded-md transition-all"
                    :class="currentFilter === filter ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'"
                >
                    {{ filter === 'all' ? '全部' : (filter === 'trip' ? '露營' : '其他') }}
                </button>
            </div>
        </div>

        <div class="flex-1 overflow-y-auto min-h-0">
            <div class="flex flex-col gap-3 pb-20"> <!-- pb-20 for mobile spacer -->
                <div 
                    v-for="event in sortedFilteredEvents" 
                    :key="event.id"
                    class="bg-white rounded-xl p-4 shadow-sm border border-primary-100 flex items-center gap-4 active:scale-98 transition-transform cursor-pointer hover:shadow-md"
                    @click="emit('click-event', event)"
                >
                    <!-- Date Box -->
                    <div class="flex flex-col items-center justify-center bg-primary-50 rounded-lg w-14 h-14 border border-primary-100 shrink-0">
                        <span class="text-xs font-bold text-primary-400 inset-0 leading-none">{{ event.date.getMonth() + 1 }}月</span>
                        <span class="text-xl font-black text-primary-700 leading-tight">{{ event.date.getDate() }}</span>
                    </div>
                    
                    <!-- Content -->
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-1">
                            <span class="w-2 h-2 rounded-full" :style="{ backgroundColor: event.color }"></span>
                            <span class="text-xs font-bold text-primary-400 uppercase tracking-wider">
                                {{ event.type === 'trip' ? '露營' : '行程' }}
                            </span>
                        </div>
                        <h4 class="font-bold text-primary-900 truncate">{{ event.title }}</h4>
                        <p v-if="event.subtitle" class="text-xs text-gray-500 truncate mt-0.5">
                            {{ event.subtitle }}
                        </p>
                    </div>
                    
                    <ChevronRight class="w-5 h-5 text-gray-300" />
                </div>

                <div v-if="sortedFilteredEvents.length === 0" class="text-center py-10 text-gray-400 text-sm">
                    目前還沒有任何行程喔！
                </div>
            </div>
        </div>
    </div>
</template>
