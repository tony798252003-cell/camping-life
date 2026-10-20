<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'
import { House, Calendar as CalendarIcon, Tent, BookOpen, Settings } from 'lucide-vue-next'
import NewItemSheet from '../components/calendar/NewItemSheet.vue'
import EventEditorSheet from '../components/calendar/EventEditorSheet.vue'
import { useEventEditor } from '../composables/useEventEditor'
import { useNewItemSheet } from '../composables/useNewItemSheet'
import { useTripModal } from '../composables/useTripModal'

const router = useRouter()
const route = useRoute()

// Props passed from App.vue
defineProps<{
  session: any
}>()

const newItem = useNewItemSheet()
const { openNew } = useTripModal()
const eventEditor = useEventEditor()

const onPick = (kind: 'event' | 'trip' | 'campsite', date?: string) => {
  newItem.close()
  if (kind === 'trip') openNew(date)
  else if (kind === 'event') eventEditor.openNew(date)
  else router.push({ name: 'library-new' })
}

const TABS = [
  { name: 'home', path: '/', label: '首頁', icon: House },
  { name: 'calendar', path: '/calendar', label: '行事曆', icon: CalendarIcon },
  { name: 'list', path: '/list', label: '行程', icon: Tent },
  { name: 'library', path: '/library', label: '圖鑑', icon: BookOpen },
  { name: 'settings', path: '/settings', label: '設定', icon: Settings },
]

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
    <nav class="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-primary-100 grid grid-cols-5 items-center z-40 pb-safe h-[76px]">
      <button
        v-for="t in TABS"
        :key="t.path"
        type="button"
        class="flex flex-col items-center justify-center gap-1 min-h-[48px] text-[11px] font-bold transition-colors"
        :class="route.name === t.name ? 'text-primary-600' : 'text-slate-500'"
        :aria-current="route.name === t.name ? 'page' : undefined"
        @click="go(t.path)"
      >
        <component :is="t.icon" class="w-[22px] h-[22px]" />{{ t.label }}
      </button>
    </nav>

    <EventEditorSheet />
    <NewItemSheet :open="newItem.isOpen.value" :date="newItem.date.value" @pick="onPick" @close="newItem.close()" />
  </div>
</template>

<style scoped>
.pb-safe {
  padding-bottom: env(safe-area-inset-bottom, 8px);
}
</style>
