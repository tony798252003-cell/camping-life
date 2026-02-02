<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { supabase } from '../lib/supabase'
import Konva from 'konva'
import { ChevronLeft, Plus, Trash2, RotateCcw, ZoomIn, ZoomOut, Save, Tent } from 'lucide-vue-next'
import { useRouter } from 'vue-router'

const router = useRouter()

// Canvas Configuration
const stageConfig = ref({
  width: window.innerWidth,
  height: window.innerHeight,
  scaleX: 1,
  scaleY: 1,
  x: 0,
  y: 0,
  draggable: true
})

// Game State
const backgroundConfig = ref({
  image: null as HTMLImageElement | null,
  width: 2000,
  height: 2000
})

const items = ref<any[]>([])
const selectedShapeName = ref('')
const inventory = ref<any[]>([])
const isInventoryOpen = ref(true)

// Grid Configuration
const TILE_WIDTH = 64
const TILE_HEIGHT = 32

// Dynamic Grid Center
const gridCenterX = computed(() => backgroundConfig.value.width / 2)
const gridCenterY = computed(() => backgroundConfig.value.height / 2 + 50) // Slight adjustment for "ground" level

// Coordinate Helpers
const isoToScreen = (u: number, v: number) => {
  return {
    x: (u - v) * (TILE_WIDTH / 2) + gridCenterX.value,
    y: (u + v) * (TILE_HEIGHT / 2) + gridCenterY.value
  }
}

const screenToIso = (x: number, y: number) => {
  const adjX = x - gridCenterX.value
  const adjY = y - gridCenterY.value
  return {
    u: (adjX / (TILE_WIDTH / 2) + adjY / (TILE_HEIGHT / 2)) / 2,
    v: (adjY / (TILE_HEIGHT / 2) - adjX / (TILE_WIDTH / 2)) / 2
  }
}

const gridLines = computed(() => {
  if (!backgroundConfig.value.image) return []

  const lines = []
  // Generate a larger diamond grid
  const GRID_ROWS = 30
  const GRID_COLS = 30

  // Vertical Lines (along V axis)
  for (let u = -GRID_COLS/2; u <= GRID_COLS/2; u++) {
    const start = isoToScreen(u, -GRID_ROWS/2)
    const end = isoToScreen(u, GRID_ROWS/2)
    lines.push({
      points: [start.x, start.y, end.x, end.y],
      stroke: 'rgba(255, 255, 255, 0.6)', // Increased opacity
      strokeWidth: 1.5,
    })
  }

  // Horizontal Lines (along U axis)
  for (let v = -GRID_ROWS/2; v <= GRID_ROWS/2; v++) {
    const start = isoToScreen(-GRID_COLS/2, v)
    const end = isoToScreen(GRID_COLS/2, v)
    lines.push({
      points: [start.x, start.y, end.x, end.y],
      stroke: 'rgba(255, 255, 255, 0.6)', // Increased opacity
      strokeWidth: 1.5,
    })
  }
  
  return lines
})

// Load Resources
onMounted(async () => {
  // 1. Load Background Image
  const image = new Image()
  image.src = '/images/game_bg_extended.png'
  image.onload = () => {
    backgroundConfig.value.image = image
    backgroundConfig.value.width = image.width
    backgroundConfig.value.height = image.height

    // Calculate scale to "cover" the screen (ensure no gray bg visible)
    // Or just fit comfortably. Let's try 3/4 view fit. 
    // Usually for game background, we want it large enough to scroll.
    // If we just fit screen, items might be too small.
    // Let's ensure a minimum reasonable scale, but start centered.

    // Logic: Initial scale should make items readable.
    // If on mobile, maybe zoom out a bit to see more context, but not too small.
    // Let's assume the bg is large (e.g. 1024px+). 
    // On mobile (375px), we need to scale down significantly if we want to see whole map,
    // BUT isometric art looks better when detailed.
    
    // DECISION: Start with a scale that fits roughly 80% of the image width or defaults to 0.5 on mobile
    const initialScale = window.innerWidth < 768 ? 0.5 : 1
    
    stageConfig.value.scaleX = initialScale
    stageConfig.value.scaleY = initialScale
    
    // Center the view on the image center
    // Stage X = ScreenCenter - (ImageCenter * Scale)
    stageConfig.value.x = (window.innerWidth / 2) - ((image.width / 2) * initialScale)
    stageConfig.value.y = (window.innerHeight / 2) - ((image.height / 2) * initialScale)
  }

  // 2. Load User's Tents
  await fetchUserGear()
  
  // 3. Setup Resize Listener
  window.addEventListener('resize', fitStage)
})

const fitStage = () => {
  stageConfig.value.width = window.innerWidth
  stageConfig.value.height = window.innerHeight
}

const fetchUserGear = async () => {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return
  
  const { data } = await supabase
    .from('camping_gear')
    .select('*')
    .eq('user_id', session.user.id)
    .eq('type', 'tent')
  
  if (data) inventory.value = data
}

// Interactions
    
    // Snapping Logic
    const snapToGrid = (x: number, y: number) => {
      // 1. Convert Screen X,Y to Grid U,V
      const { u, v } = screenToIso(x, y)
      
      // 2. Round U,V to nearest integer (tile)
      const snappedU = Math.round(u)
      const snappedV = Math.round(v)
      
      // 3. Convert back to Screen X,Y
      return isoToScreen(snappedU, snappedV)
    }

    const handleDragStart = (e: any) => {
      const id = e.target.id()
      selectedShapeName.value = id
      
      // Bring to top
      const item = items.value.find(i => i.id === id)
      if (item) {
         const index = items.value.indexOf(item)
         items.value.splice(index, 1)
         items.value.push(item)
      }
    }

    const handleDragEnd = (e: any) => {
      // Update position in state with Grid Snapping
      const id = e.target.id()
      const item = items.value.find(i => i.id === id)
      
      if (id === 'reference-char') return

      if (item) {
        // Use position from transformer if available? No, simpler to just use target x/y
        const rawX = e.target.x()
        const rawY = e.target.y()
        
        // Snap logic
        const snapped = snapToGrid(rawX, rawY)

        item.x = snapped.x
        item.y = snapped.y
        
        // Update Konva node position visually immediately
        e.target.position({ x: snapped.x, y: snapped.y })
      }
    }

    // Footprint Indicator Logic
    const activeFootprint = computed(() => {
        if (!selectedShapeName.value) return null
        const item = items.value.find(i => i.id === selectedShapeName.value)
        if (!item) return null
        if (!item.image) return null
        
        // Use custom size if set, otherwise estimate
        const wTiles = item.isoWidth || Math.max(1, Math.round((item.image.width * item.scaleX) / TILE_WIDTH))
        const hTiles = item.isoDepth || Math.max(1, Math.round((item.image.width * item.scaleX) / (TILE_WIDTH * 0.8)))
        
        // 4 corners relative to center (0,0 is grid center) -> screen relative?
        // We need to draw the diamond centered at item.x, item.y
        // But the "center" of the item in our data model is the center of the image.
        // We want the footprint at the "feet" of the image.
        
        // Center of footprint in Screen Coords:
        const centerX = item.x
        const centerY = item.y + (item.image.height * item.scaleY) / 2
        
        // Vector logic:
        // Top Corner: -hTiles/2 along V, -wTiles/2 along U? No
        
        // Let's use the helper by simulating offsets
        // U Vector (1, 0) -> Screen Delta?
        // V Vector (0, 1) -> Screen Delta?
        
        // Corners from centered U,V (0,0) with extent wTiles, hTiles
        // 1. Top (min Y): -w/2 * U + -h/2 * V ??
        // No, let's just use the vertices relative to center
        
        // U goes Right-Down. V goes Left-Down.
        // Top corner is (-w/2, -h/2) ??
        // Let's test: -1 * U + -1 * V = (-w/2 - -w/2, -h/2 + -h/2)? No.
        
        // If center is 0,0.
        // Top corner is at u = -w/2, v = -h/2 ?
        // Screen X = (-w/2 - -h/2) * ... = (-w/2 + h/2) * ... 
        // Screen Y = (-w/2 + -h/2) * ... 
        
        // Top corner: -w/2 along U, -h/2 along V
        const topX = (-wTiles/2 - -hTiles/2) * (TILE_WIDTH / 2)
        const topY = (-wTiles/2 + -hTiles/2) * (TILE_HEIGHT / 2)
        
        // Right corner: +w/2 along U, -h/2 along V
        const rightX = (wTiles/2 - -hTiles/2) * (TILE_WIDTH / 2)
        const rightY = (wTiles/2 + -hTiles/2) * (TILE_HEIGHT / 2)
        
        // Bottom corner: +w/2, +h/2
        const botX = (wTiles/2 - hTiles/2) * (TILE_WIDTH / 2)
        const botY = (wTiles/2 + hTiles/2) * (TILE_HEIGHT / 2)
        
        // Left corner: -w/2, +h/2
        const leftX = (-wTiles/2 - hTiles/2) * (TILE_WIDTH / 2)
        const leftY = (-wTiles/2 + hTiles/2) * (TILE_HEIGHT / 2)
        
        return {
           points: [
               topX, topY,
               rightX, rightY,
               botX, botY,
               leftX, leftY
           ],
           x: centerX,
           y: centerY,
           label: `${wTiles}x${hTiles}`,
           size: wTiles
        }
    })

    const handleStageClick = (e: any) => {
      // Click on empty area deselects
      if (e.target === e.target.getStage()) {
        selectedShapeName.value = ''
        return
      }
      
      // Click on image
      const clickedOnTransformer = e.target.getParent().className === 'Transformer'
      if (clickedOnTransformer) return
    
      const name = e.target.name()
      const id = e.target.id()
      
      if (name === 'item-image') {
        selectedShapeName.value = id
      } else {
        selectedShapeName.value = ''
      }
    }

const updateTransformer = (e: any) => {
  // update the state of the transformed item
  const node = e.target
  const id = node.id()
  const item = items.value.find(i => i.id === id)
  
  if (item) {
     item.x = node.x()
     item.y = node.y()
     item.rotation = node.rotation()
     item.scaleX = node.scaleX()
     item.scaleY = node.scaleY()
  }
}

// Transformer Reference
const transformer = ref()

watch(selectedShapeName, (name) => {
  const transformerNode = transformer.value?.getNode()
  const stage = transformerNode?.getStage()
  
  if (!stage || !name) {
     transformerNode?.nodes([])
     return
  }
  
  const selectedNode = stage.findOne('#' + name)
  if (selectedNode === transformerNode.node()) {
    return
  }

  if (selectedNode) {
    transformerNode.nodes([selectedNode])
  } else {
    transformerNode.nodes([])
  }
})

// Add Item from Inventory
const addItem = (gear: any) => {
  if (!gear.image_url) return
  
  // Pre-load image
  const img = new Image()
  img.src = gear.image_url
  img.onload = () => {
    // Calculate center of current view
    // (viewWidth/2 - stageX) / scale
    const stage = stageConfig.value
    const cx = (window.innerWidth / 2 - (stage.x || 0)) / stage.scaleX
    const cy = (window.innerHeight / 2 - (stage.y || 0)) / stage.scaleY
    
    items.value.push({
       id: `item-${Date.now()}`,
       x: cx,
       y: cy,
       rotation: 0,
       scaleX: 0.3, // Start smaller for better proportion
       scaleY: 0.3,
       image: img,
       name: gear.name
    })
    selectedShapeName.value = items.value[items.value.length - 1].id
  }
}

// Controls
const zoomIn = () => {
   stageConfig.value.scaleX *= 1.2
   stageConfig.value.scaleY *= 1.2
}
const zoomOut = () => {
   stageConfig.value.scaleX /= 1.2
   stageConfig.value.scaleY /= 1.2
}
const deleteSelected = () => {
   if (!selectedShapeName.value) return
   items.value = items.value.filter(i => i.id !== selectedShapeName.value)
   selectedShapeName.value = ''
}
const rotateLeft = () => {
  if (!selectedShapeName.value) return
  const item = items.value.find(i => i.id === selectedShapeName.value)
  if (item) item.rotation -= 45
}
const rotateRight = () => {
  if (!selectedShapeName.value) return
  const item = items.value.find(i => i.id === selectedShapeName.value)
  if (item) item.rotation += 45
}

// Size Controls
const increaseWidth = () => {
  if (!selectedShapeName.value) return
  const item = items.value.find(i => i.id === selectedShapeName.value)
  if (item) item.isoWidth = (item.isoWidth || 1) + 1
}
const decreaseWidth = () => {
  if (!selectedShapeName.value) return
  const item = items.value.find(i => i.id === selectedShapeName.value)
  if (item && (item.isoWidth || 0) > 1) item.isoWidth = item.isoWidth - 1
}
const increaseDepth = () => {
  if (!selectedShapeName.value) return
  const item = items.value.find(i => i.id === selectedShapeName.value)
  if (item) item.isoDepth = (item.isoDepth || 1) + 1
}
const decreaseDepth = () => {
  if (!selectedShapeName.value) return
  const item = items.value.find(i => i.id === selectedShapeName.value)
  if (item && (item.isoDepth || 0) > 1) item.isoDepth = item.isoDepth - 1
}

const downloadSnapshot = () => {
  const stage = Konva.stages[0] // quick access
  if (stage) {
     const dataURL = stage.toDataURL({ pixelRatio: 2 })
     const link = document.createElement('a')
     link.download = `my-campsite-${Date.now()}.png`
     link.href = dataURL
     document.body.appendChild(link)
     link.click()
     document.body.removeChild(link)
  }
}
</script>

<template>
  <div class="fixed inset-0 overflow-hidden bg-gray-900 select-none touch-none">
    
    <!-- Top Bar -->
    <div class="absolute top-0 left-0 right-0 z-20 p-4 pointer-events-none flex justify-between items-start">
       <button @click="router.push('/')" class="pointer-events-auto bg-white/90 p-2 rounded-full shadow-lg text-gray-800 hover:bg-white transition">
          <ChevronLeft class="w-6 h-6" />
       </button>
       
       <div class="pointer-events-auto flex gap-2">
          <button @click="downloadSnapshot" class="bg-primary-600 text-white px-4 py-2 rounded-full shadow-lg font-bold hover:bg-primary-700 transition flex items-center gap-2">
             <Save class="w-4 h-4" /> 存成圖片
          </button>
       </div>
    </div>

    <!-- Canvas -->
    <v-stage 
      ref="stage" 
      :config="stageConfig" 
      @mousedown="handleStageClick" 
      @touchstart="handleStageClick"
    >
      <v-layer ref="layer">
        <!-- Background -->
        <v-image 
           v-if="backgroundConfig.image"
           :config="{
             image: backgroundConfig.image,
             x: 0,
             y: 0,
             width: backgroundConfig.width,
             height: backgroundConfig.height
           }"
        />

        <!-- Visual Grid -->
        <v-line 
           v-for="(line, index) in gridLines"
           :key="`grid-${index}`"
           :config="line"
        />
        
        <!-- Footprint Indicator -->
        <v-group 
           v-if="activeFootprint"
           :config="{
              x: activeFootprint.x,
              y: activeFootprint.y
           }"
        >
           <!-- Filled Base -->
           <v-line :config="{
              points: activeFootprint.points,
              fill: 'rgba(74, 222, 128, 0.3)', // Green-400 with opacity
              closed: true,
              stroke: '#4ade80',
              strokeWidth: 2
           }" />
           
           <!-- Size Label -->
           <v-text :config="{
              text: activeFootprint.label,
              fontSize: 14,
              fontStyle: 'bold',
              fill: 'white',
              align: 'center',
              width: 100,
              items: [],
              offsetX: 50,
              offsetY: 20,
              shadowColor: 'black',
              shadowBlur: 2,
              shadowOpacity: 0.5
           }" />
        </v-group>
        
        <!-- Items -->
        <v-image 
           v-for="item in items" 
           :key="item.id"
           :config="{
             id: item.id,
             x: item.x,
             y: item.y,
             rotation: item.rotation,
             scaleX: item.scaleX,
             scaleY: item.scaleY,
             image: item.image,
             name: 'item-image',
             draggable: true,
             offsetX: item.image ? item.image.width / 2 : 0,
             offsetY: item.image ? item.image.height / 2 : 0,
           }"
           @dragstart="handleDragStart"
           @dragend="handleDragEnd"
           @transformend="updateTransformer"
        />
        
        <!-- Transformer (Selection Box) -->
        <v-transformer 
           ref="transformer"
           :config="{
              borderStroke: '#3b82f6',
              borderStrokeWidth: 2,
              anchorStroke: '#3b82f6',
              anchorFill: '#fff',
              anchorSize: 10,
              rotateAnchorOffset: 30
           }" 
        />

      </v-layer>
    </v-stage>
    
    <!-- Setup Transformer Reference in VueKonva -->
    <!-- Note: VueKonva handles transformer via ref manually accessing node usually, or simple logic -->
    
    <!-- UI Controls (Bottom Right) -->
    <div class="absolute bottom-32 right-4 z-20 flex flex-col gap-2 pointer-events-auto">
       <button @click="zoomIn" class="bg-white p-3 rounded-full shadow-xl text-gray-700 hover:bg-gray-50"><ZoomIn class="w-5 h-5"/></button>
       <button @click="zoomOut" class="bg-white p-3 rounded-full shadow-xl text-gray-700 hover:bg-gray-50"><ZoomOut class="w-5 h-5"/></button>
    </div>

    <!-- Active Item Controls -->
    <div v-if="selectedShapeName" class="absolute top-20 left-1/2 -translate-x-1/2 z-20 bg-white/90 backdrop-blur px-4 py-3 rounded-2xl shadow-xl flex flex-col gap-3 pointer-events-auto animate-in slide-in-from-top-4 fade-in min-w-[200px]">
        
        <!-- Rotate & Delete -->
        <div class="flex justify-between items-center w-full gap-4">
             <div class="flex gap-2">
                <button @click="rotateLeft" class="text-gray-600 flex flex-col items-center p-1 hover:bg-gray-100 rounded">
                   <RotateCcw class="w-5 h-5 -scale-x-100" /> <span class="text-[10px]">左轉</span>
                </button>
                <button @click="rotateRight" class="text-gray-600 flex flex-col items-center p-1 hover:bg-gray-100 rounded">
                   <RotateCcw class="w-5 h-5" /> <span class="text-[10px]">右轉</span>
                </button>
             </div>
             <div class="w-px bg-gray-300 h-8"></div>
             <button @click="deleteSelected" class="text-red-500 flex flex-col items-center p-1 hover:bg-red-50 rounded">
                <Trash2 class="w-5 h-5" /> <span class="text-[10px]">刪除</span>
             </button>
        </div>

        <!-- Size Controls -->
        <div class="border-t pt-2 w-full">
            <div class="text-[10px] text-gray-500 font-bold mb-1 text-center">佔地尺寸 (格)</div>
            <div class="flex justify-between gap-4">
                <!-- Width -->
                <div class="flex flex-col items-center">
                   <span class="text-[10px] text-gray-400">寬度 (Width)</span>
                   <div class="flex items-center bg-gray-100 rounded-lg mt-1">
                      <button @click="decreaseWidth" class="p-1 px-2 hover:bg-gray-200 rounded-l-lg">-</button>
                      <span class="text-xs font-mono w-6 text-center">{{ activeFootprint?.label.split('x')[0] || 1 }}</span>
                      <button @click="increaseWidth" class="p-1 px-2 hover:bg-gray-200 rounded-r-lg">+</button>
                   </div>
                </div>
                <!-- Depth -->
                <div class="flex flex-col items-center">
                   <span class="text-[10px] text-gray-400">深度 (Depth)</span>
                   <div class="flex items-center bg-gray-100 rounded-lg mt-1">
                      <button @click="decreaseDepth" class="p-1 px-2 hover:bg-gray-200 rounded-l-lg">-</button>
                      <span class="text-xs font-mono w-6 text-center">{{ activeFootprint?.label.split('x')[1] || 1 }}</span>
                      <button @click="increaseDepth" class="p-1 px-2 hover:bg-gray-200 rounded-r-lg">+</button>
                   </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Inventory Sidebar / Bottom Sheet -->
    <div 
       class="absolute bottom-0 inset-x-0 bg-surface-50 rounded-t-3xl shadow-[0_-5px_20px_rgba(0,0,0,0.2)] z-30 transition-transform duration-300 ease-spring"
       :class="isInventoryOpen ? 'translate-y-0' : 'translate-y-[85%]'"
    >
       <!-- Handle -->
       <div @click="isInventoryOpen = !isInventoryOpen" class="flex justify-center py-3 cursor-pointer active:opacity-70">
           <div class="w-12 h-1.5 bg-gray-300 rounded-full"></div>
       </div>
       
       <!-- Content -->
       <div class="px-6 pb-8 h-[220px] overflow-y-auto">
          <div class="flex items-center justify-between mb-4">
              <h3 class="font-bold text-gray-600 flex items-center gap-2">
                 <Tent class="w-5 h-5 text-primary-600" />
                 我的裝備庫 
                 <span class="bg-gray-200 text-xs px-2 py-0.5 rounded-full text-gray-600">{{ inventory.length }}</span>
              </h3>
          </div>
          
          <div class="flex gap-4 overflow-x-auto pb-4 snap-x">
             <div 
               v-if="inventory.length === 0" 
               class="flex-shrink-0 w-32 h-32 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl text-gray-400 p-4 text-center text-xs"
             >
                <Tent class="w-8 h-8 mb-2 opacity-50" />
                尚無帳篷<br/>請先新增裝備
             </div>
             
             <button 
               v-for="gear in inventory" 
               :key="gear.id" 
               @click="addItem(gear)"
               class="flex-shrink-0 w-32 group relative"
             >
                <div class="w-32 h-32 bg-white rounded-xl border border-gray-200 shadow-sm flex items-center justify-center p-2 group-hover:border-primary-500 group-hover:shadow-md transition overflow-hidden">
                   <img :src="gear.image_url" class="w-full h-full object-contain" :alt="gear.name" />
                </div>
                <span class="text-xs font-bold text-gray-700 mt-2 block truncate text-center px-1">{{ gear.name }}</span>
                <div class="absolute top-2 right-2 bg-primary-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition shadow-sm">
                   <Plus class="w-4 h-4" />
                </div>
             </button>
          </div>
       </div>
    </div>

  </div>
</template>

<style scoped>
.ease-spring {
   transition-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1);
}
</style>
