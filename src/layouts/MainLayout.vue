<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'
import { Home, Calendar as CalendarIcon, List as ListIcon, Search, Plus } from 'lucide-vue-next'

const router = useRouter()
const route = useRoute()

// Props passed from App.vue
defineProps<{
  session: any
}>()

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
            <span class="font-display font-bold text-primary-900 text-base md:text-lg tracking-tight">
                Hi, {{ session.user.user_metadata?.full_name || session.user.email?.split('@')[0] }}
            </span>

            <!-- Avatar (Click to Go to Settings) -->
             <div @click="go('/settings')" class="cursor-pointer relative group">
                 <div class="w-10 h-10 rounded-full bg-gray-200 border-2 border-white shadow-sm overflow-hidden transition-all group-hover:scale-105 group-hover:shadow-md group-active:scale-95 ring-2 ring-transparent group-hover:ring-primary-100">
                      <img v-if="session.user.user_metadata?.avatar_url" :src="session.user.user_metadata.avatar_url" class="w-full h-full object-cover" />
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
          <Home class="w-6 h-6" :class="{'fill-primary-100': route.name === 'home'}" />
          <span class="text-[10px] font-medium mb-1">首頁</span>
        </button>
  
        <button 
          @click="go('/list')"
          class="flex flex-col items-center gap-1 transition-all duration-300 w-16"
          :class="route.name === 'list' ? 'text-primary-600 scale-105' : 'text-primary-400 hover:text-primary-600'"
        >
          <ListIcon class="w-6 h-6" />
          <span class="text-[10px] font-medium mb-1">足跡</span>
        </button>
  
        <!-- FAB (Add) - Emits 'add' event up to App.vue (handled via attrs) -->
        <button 
          @click="$emit('add')"
          class="btn-cta flex flex-col items-center justify-center -mt-10 rounded-full w-14 h-14 shadow-lg shadow-orange-500/30 hover:scale-105 active:scale-95 transition-all duration-300 border-4 border-surface-50 z-50"
        >
          <Plus class="w-7 h-7" />
        </button>
  
        <button 
          @click="go('/calendar')"
          class="flex flex-col items-center gap-1 transition-all duration-300 w-16"
          :class="route.name === 'calendar' ? 'text-primary-600 scale-105' : 'text-primary-400 hover:text-primary-600'"
        >
          <CalendarIcon class="w-6 h-6" :class="{'fill-primary-100': route.name === 'calendar'}" />
          <span class="text-[10px] font-medium mb-1">行事曆</span>
        </button>
  
        <button 
          @click="go('/library')"
          class="flex flex-col items-center gap-1 transition-all duration-300 w-16"
          :class="route.name === 'library' ? 'text-primary-600 scale-105' : 'text-primary-400 hover:text-primary-600'"
        >
          <Search class="w-6 h-6" :class="{'fill-primary-100': route.name === 'library'}" />
          <span class="text-[10px] font-medium mb-1">找營地</span>
        </button>
    </nav>
  </div>
</template>

<style scoped>
.pb-safe {
  padding-bottom: env(safe-area-inset-bottom, 20px);
}
</style>
