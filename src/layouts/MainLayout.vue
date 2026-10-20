<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'
import { Calendar as CalendarIcon, Tent, MapPin, ChartColumn, Plus } from 'lucide-vue-next'
import NewItemSheet from '../components/calendar/NewItemSheet.vue'
import EventEditorSheet from '../components/calendar/EventEditorSheet.vue'
import { useCalendarFeed } from '../composables/useCalendarFeed'
import { useEventEditor } from '../composables/useEventEditor'
import { useNewItemSheet } from '../composables/useNewItemSheet'
import { useTripModal } from '../composables/useTripModal'

const router = useRouter()
const route = useRoute()

// Props passed from App.vue
defineProps<{
  session: any
}>()

const { selectedDate } = useCalendarFeed()
const newItem = useNewItemSheet()
const { openNew } = useTripModal()
const eventEditor = useEventEditor()

const onPick = (kind: 'event' | 'trip' | 'campsite', date?: string) => {
  newItem.close()
  if (kind === 'trip') openNew(date)
  else if (kind === 'event') eventEditor.openNew(date)
}

// Navigation helpers
const go = (path: string) => router.push(path)
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Global Header -->
    <header class="bg-white/50 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between relative">
      <!-- Brand / Logo (Left) -->
      <div class="flex items-center cursor-pointer" @click="go('/')">
           <img src="/images/title_logo.png" alt="Camp Life" class="h-8 md:h-10 w-auto object-contain" />
      </div>

      <!-- User Profile (Right) -->
      <div class="flex items-center gap-3 z-10 relative"> 
         <div v-if="session?.user" class="flex items-center gap-3">
            <!-- Name (Left of Avatar) -->
            <span class="font-bold text-primary-900 text-base md:text-lg tracking-tight">
                Hi, {{ session.user.user_metadata?.full_name || session.user.email?.split('@')[0] }}
            </span>

            <!-- Avatar (Click to Go to Settings) -->
             <div @click="go('/settings')" class="cursor-pointer relative group">
                 <div class="w-10 h-10 rounded-full bg-gray-200 border-2 border-white shadow-sm overflow-hidden transition-all group-hover:scale-105 group-hover:shadow-md group-active:scale-95 ring-2 ring-transparent group-hover:ring-primary-100">
                      <img v-if="session.user.user_metadata?.avatar_url" :src="session.user.user_metadata.avatar_url" class="w-full h-full object-cover" referrerpolicy="no-referrer" />
                      <div v-else class="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary-100 to-primary-200 text-primary-600 font-black text-lg">
                          {{ (session.user.user_metadata?.full_name || session.user.email)?.[0]?.toUpperCase() }}
                      </div>
                 </div>
             </div>
         </div>
      </div>
    </header>

    <!-- Main Content Slot -->
    <!-- We use router-view here for child routes (Home, List, etc) -->
    <!-- We propagate all props/attrs to the child view -->
    <main class="flex-1 overflow-y-auto pb-24">
        <router-view v-slot="{ Component }">
            <transition name="fade" mode="out-in">
                 <component :is="Component" v-bind="$attrs" />
            </transition>
        </router-view>
    </main>

    <!-- Bottom Navigation -->
    <nav class="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-primary-100 px-6 py-3 flex justify-between items-center z-40 pb-safe shadow-[0_-4px_20px_-1px_rgba(14,165,233,0.1)]">
        <button
          @click="go('/')"
          class="flex flex-col items-center gap-1 transition-all duration-300 w-16"
          :class="route.name === 'home' ? 'text-primary-600 scale-105' : 'text-primary-400 hover:text-primary-600'"
        >
          <CalendarIcon class="w-6 h-6" :class="{'fill-primary-100': route.name === 'home'}" />
          <span class="text-[10px] font-medium mb-1">行事曆</span>
        </button>

        <button
          @click="go('/list')"
          class="flex flex-col items-center gap-1 transition-all duration-300 w-16"
          :class="route.name === 'list' ? 'text-primary-600 scale-105' : 'text-primary-400 hover:text-primary-600'"
        >
          <Tent class="w-6 h-6" />
          <span class="text-[10px] font-medium mb-1">露營</span>
        </button>

        <!-- FAB (Add) - Central Orange Button -->
        <button
          @click="newItem.open(selectedDate)"
          aria-label="新增"
          class="btn-cta flex flex-col items-center justify-center -mt-10 rounded-full w-14 h-14 shadow-lg shadow-orange-500/30 hover:scale-105 active:scale-95 transition-all duration-300 border-4 border-surface-50 z-50 bg-accent-orange text-white"
        >
          <Plus class="w-7 h-7" />
        </button>

        <button
          @click="go('/library')"
          class="flex flex-col items-center gap-1 transition-all duration-300 w-16"
          :class="route.name === 'library' ? 'text-primary-600 scale-105' : 'text-primary-400 hover:text-primary-600'"
        >
          <MapPin class="w-6 h-6" />
          <span class="text-[10px] font-medium mb-1">營地</span>
        </button>

        <button
          @click="go('/stats')"
          class="flex flex-col items-center gap-1 transition-all duration-300 w-16"
          :class="route.name === 'stats' ? 'text-primary-600 scale-105' : 'text-primary-400 hover:text-primary-600'"
        >
          <ChartColumn class="w-6 h-6" />
          <span class="text-[10px] font-medium mb-1">統計</span>
        </button>
    </nav>

    <EventEditorSheet />
    <NewItemSheet :open="newItem.isOpen.value" :date="newItem.date.value" @pick="onPick" @close="newItem.close()" />
  </div>
</template>

<style scoped>
.pb-safe {
  padding-bottom: env(safe-area-inset-bottom, 20px);
}
</style>
