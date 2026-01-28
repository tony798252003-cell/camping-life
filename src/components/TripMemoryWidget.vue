<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { supabase } from '../lib/supabase'
import type { TripPhoto } from '../types/database'
import { Calendar } from 'lucide-vue-next'

const memoryPhoto = ref<TripPhoto | null>(null)
const tripName = ref('')
const tripDate = ref('')
const loading = ref(true)

const fetchRandomMemory = async () => {
  loading.value = true
  try {
    // 1. Get all photos from past trips (simplified: get latest 10 and pick one, or random)
    // Supabase doesn't support random() easily without RPC.
    // We'll fetch latest 20 photos and pick one randomly.
    
    // We want photos where trip date < today.
    // Ideally we join with camping_trips, but let's just fetch random photos and check date?
    // Or just fetch any photo. "Memories" can be recent too.
    
    const { data } = await supabase
      .from('trip_photos')
      .select('*, camping_trips(campsite_name, trip_date, location, campsites(name))')
      .limit(20)
      .order('created_at', { ascending: false })
      
    if (data && data.length > 0) {
        // Pick random
        const randomIndex = Math.floor(Math.random() * data.length)
        const photo = data[randomIndex]
        memoryPhoto.value = photo as unknown as TripPhoto
        
        const trip = (photo as any).camping_trips
        if (trip) {
            // Priority: Explicit Trip Name > Linked Campsite Name > Fallback
            const linkedName = trip.campsites?.name
            tripName.value = trip.campsite_name || linkedName || '未命名旅程'
            tripDate.value = new Date(trip.trip_date).toLocaleDateString()
        }
    }
  } catch (e) {
    console.error('Error fetching memory', e)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchRandomMemory()
})
</script>

<template>
  <div v-if="memoryPhoto" class="w-full px-4 mb-6">
      <h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">MEMORIES</h3>
      
      <div class="relative w-full aspect-[4/3] rounded-[2rem] overflow-hidden shadow-md group">
          <img 
            :src="memoryPhoto.url" 
            class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
          
          <!-- Overlay -->
          <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex flex-col justify-end p-5">
              <div class="transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                  <div class="flex items-center gap-2 text-white/90 text-xs font-medium mb-1">
                      <Calendar class="w-3.5 h-3.5" />
                      <span>{{ tripDate }}</span>
                  </div>
                  <h4 class="text-white text-xl font-bold leading-tight">{{ tripName }}</h4>
              </div>
          </div>
      </div>
  </div>
</template>
