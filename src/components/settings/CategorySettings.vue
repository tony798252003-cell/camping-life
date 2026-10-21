<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ChevronUp, ChevronDown, Trash2, Plus, Check } from 'lucide-vue-next'
import { useEventCategories } from '../../composables/useEventCategories'
import { useConfirm } from '../../composables/useConfirm'
import { useNotification } from '../../composables/useNotification'

const PALETTE = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b']
const DEFAULT_COLOR = '#3b82f6'

const { myCategories: categories, load, create, update, remove } = useEventCategories()
const { confirm } = useConfirm()
const { error: notifyError } = useNotification()

// editingId: 目前展開編輯的分類 id；'new' 代表新增表單
const editingId = ref<string | null>(null)
const draftName = ref('')
const draftColor = ref(DEFAULT_COLOR)
const isSaving = ref(false)

onMounted(() => {
  load()
})

// DB unique(owner_id, name) 違反（Postgres 23505）轉成友善訊息
const toMessage = (e: unknown, fallback: string) => {
  const err = e as { code?: string }
  return err?.code === '23505' ? '已經有同名的分類了' : fallback
}

const startEdit = (id: string, name: string, color: string) => {
  editingId.value = id
  draftName.value = name
  draftColor.value = color
}

const startNew = () => {
  editingId.value = 'new'
  draftName.value = ''
  draftColor.value = DEFAULT_COLOR
}

const save = async () => {
  const name = draftName.value.trim()
  if (!name) {
    notifyError('請輸入分類名稱')
    return
  }
  isSaving.value = true
  try {
    if (editingId.value === 'new') await create(name, draftColor.value)
    else if (editingId.value) await update(editingId.value, { name, color: draftColor.value })
    editingId.value = null
  } catch (e) {
    console.error('[CategorySettings] save error:', e)
    notifyError(toMessage(e, '儲存分類失敗，請稍後再試'))
  } finally {
    isSaving.value = false
  }
}

const handleRemove = async (id: string, name: string) => {
  const ok = await confirm({
    title: `刪除「${name}」`,
    message: '這個分類的事件會變成無分類（顯示為個人色）',
    confirmText: '刪除',
    type: 'danger',
  })
  if (!ok) return
  try {
    await remove(id)
    if (editingId.value === id) editingId.value = null
  } catch (e) {
    console.error('[CategorySettings] remove error:', e)
    notifyError('刪除分類失敗，請稍後再試')
  }
}

// 以目前列表順序重新編號，只更新 sort_order 與 index 不同的列（舊資料可能全是 0）
const move = async (index: number, delta: -1 | 1) => {
  const target = index + delta
  const list = [...categories.value]
  if (target < 0 || target >= list.length) return
  const a = list[index]
  const b = list[target]
  if (!a || !b) return
  list[index] = b
  list[target] = a
  try {
    for (const [i, c] of list.entries()) {
      if (c.sort_order !== i) await update(c.id, { sort_order: i })
    }
  } catch (e) {
    console.error('[CategorySettings] move error:', e)
    notifyError('調整排序失敗，請稍後再試')
    await load()
  }
}
</script>

<template>
  <div class="p-4 space-y-3">
    <div
      v-for="(c, i) in categories"
      :key="c.id"
      class="bg-white rounded-[18px]"
    >
      <div class="flex items-center gap-2 p-3">
        <button
          class="flex-1 flex items-center gap-3 text-left min-w-0"
          @click="editingId === c.id ? (editingId = null) : startEdit(c.id, c.name, c.color)"
        >
          <span class="w-4 h-4 rounded-full shrink-0" :style="{ backgroundColor: c.color }"></span>
          <span class="text-[15px] font-bold text-primary-900 truncate">{{ c.name }}</span>
        </button>
        <button
          :disabled="i === 0"
          aria-label="上移"
          class="w-11 h-11 flex items-center justify-center text-slate-500 disabled:opacity-30"
          @click="move(i, -1)"
        >
          <ChevronUp class="w-5 h-5" />
        </button>
        <button
          :disabled="i === categories.length - 1"
          aria-label="下移"
          class="w-11 h-11 flex items-center justify-center text-slate-500 disabled:opacity-30"
          @click="move(i, 1)"
        >
          <ChevronDown class="w-5 h-5" />
        </button>
        <button
          v-if="c.system_key !== 'camping' && c.system_key !== 'baseball'"
          aria-label="刪除"
          class="w-11 h-11 flex items-center justify-center text-red-500"
          @click="handleRemove(c.id, c.name)"
        >
          <Trash2 class="w-5 h-5" />
        </button>
      </div>

      <div v-if="editingId === c.id" class="px-3 pb-3 space-y-3 border-t border-primary-100 pt-3">
        <input
          v-model="draftName"
          maxlength="20"
          class="w-full px-4 min-h-[48px] bg-white border border-primary-100 rounded-[14px] text-[15px] focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
          placeholder="分類名稱"
        />
        <div class="flex flex-wrap gap-3">
          <button
            v-for="color in PALETTE"
            :key="color"
            :aria-label="color"
            class="w-11 h-11 rounded-full flex items-center justify-center"
            :style="{ backgroundColor: color }"
            @click="draftColor = color"
          >
            <Check v-if="draftColor === color" class="w-4 h-4 text-white" />
          </button>
        </div>
        <button
          :disabled="isSaving"
          class="w-full min-h-[48px] font-bold text-white bg-primary-500 rounded-[14px] disabled:opacity-70"
          @click="save"
        >
          儲存
        </button>
      </div>
    </div>

    <div v-if="editingId === 'new'" class="bg-white rounded-[18px] p-3 space-y-3">
      <input
        v-model="draftName"
        maxlength="20"
        class="w-full px-4 min-h-[48px] bg-white border border-primary-100 rounded-[14px] text-[15px] focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
        placeholder="新分類名稱"
      />
      <div class="flex flex-wrap gap-3">
        <button
          v-for="color in PALETTE"
          :key="color"
          :aria-label="color"
          class="w-11 h-11 rounded-full flex items-center justify-center"
          :style="{ backgroundColor: color }"
          @click="draftColor = color"
        >
          <Check v-if="draftColor === color" class="w-4 h-4 text-white" />
        </button>
      </div>
      <div class="flex gap-2">
        <button class="flex-1 min-h-[48px] font-bold text-primary-700 bg-primary-100 rounded-[14px]" @click="editingId = null">取消</button>
        <button
          :disabled="isSaving"
          class="flex-1 min-h-[48px] font-bold text-white bg-primary-500 rounded-[14px] disabled:opacity-70"
          @click="save"
        >
          新增
        </button>
      </div>
    </div>

    <button
      v-else
      class="w-full flex items-center justify-center gap-2 min-h-[56px] bg-white border border-dashed border-primary-200 text-primary-700 rounded-[18px] font-bold active:scale-[0.98]"
      @click="startNew"
    >
      <Plus class="w-5 h-5" />
      新增分類
    </button>
  </div>
</template>
