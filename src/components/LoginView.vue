<script setup lang="ts">
import { ref } from 'vue'
import { supabase } from '../lib/supabase'
import { Tent } from 'lucide-vue-next'

const loading = ref(false)

const handleLogin = async () => {
  try {
    loading.value = true
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    })
    if (error) throw error
  } catch (error) {
    if (error instanceof Error) {
      alert(error.message)
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-surface-50 p-4 relative overflow-hidden">
    
    <!-- Background Decoration -->
    <div class="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div class="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary-100/50 rounded-full blur-[100px]"></div>
        <div class="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-accent-orange/10 rounded-full blur-[100px]"></div>
    </div>

    <div class="max-w-md w-full bg-white/80 backdrop-blur-xl rounded-[2.5rem] p-8 md:p-12 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 relative z-10 flex flex-col items-center text-center">
      
      <!-- Logo / Icon -->
      <div class="w-20 h-20 bg-gradient-to-br from-primary-400 to-primary-600 rounded-[2rem] flex items-center justify-center shadow-lg shadow-primary-500/30 mb-8 rotate-3 transform hover:rotate-6 transition-transform duration-500">
        <Tent class="w-10 h-10 text-white" />
      </div>

      <!-- Title -->
      <div class="mb-2">
         <img src="/images/title_logo.png" alt="搭帳日誌" class="h-12 md:h-14 w-auto object-contain mx-auto" />
      </div>
      
      <p class="text-primary-500/80 font-medium mb-10 tracking-wide text-sm">
        記錄每一次美好的露營時刻
      </p>

      <!-- Login Button -->
      <button 
        @click="handleLogin"
        :disabled="loading"
        class="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-700 font-bold py-4 px-6 rounded-2xl border border-gray-200 shadow-sm transition-all duration-300 transform active:scale-95 hover:shadow-md hover:border-primary-200 group relative overflow-hidden"
      >
        <span v-if="loading" class="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-500"></span>
        <div v-else class="flex items-center gap-3">
            <!-- Google Icon SVG -->
            <svg class="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z"/>
                <path fill="#EA4335" d="M12 4.81c1.6 0 3.02.55 4.13 1.62l3.1-3.1C17.45 1.57 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span>使用 Google 帳號登入</span>
        </div>
      </button>

      <div class="mt-8 text-xs text-primary-300/60 font-medium">
         © {{ new Date().getFullYear() }} Camping Life
      </div>
    </div>
  </div>
</template>
