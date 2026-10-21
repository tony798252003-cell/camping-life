<script setup lang="ts">
import { computed } from 'vue'
import { Lock, Pencil, Trash2, Users } from 'lucide-vue-next'
import { useCalendarEvents } from '../../composables/useCalendarEvents'
import { useConfirm } from '../../composables/useConfirm'
import { useEventCategories } from '../../composables/useEventCategories'
import { useEventEditor } from '../../composables/useEventEditor'
import { useNotification } from '../../composables/useNotification'
import { fromEventRow } from '../../utils/calendar/eventRow'

const props = defineProps<{ eventId: string | null }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const { events, remove } = useCalendarEvents()
const { categories } = useEventCategories()
const { confirm } = useConfirm()
const { openEdit } = useEventEditor()
const { success, error: notifyError } = useNotification()

const row = computed(() => (props.eventId ? events.value.find((e) => e.id === props.eventId) ?? null : null))
const cat = computed(() => categories.value.find((c) => c.id === row.value?.category_id))
const input = computed(() => (row.value ? fromEventRow(row.value) : null))
const when = computed(() => {
  const i = input.value
  if (!i) return ''
  const range = i.startDate === i.endDate ? i.startDate : `${i.startDate} ～ ${i.endDate}`
  return i.allDay ? `${range}　全天` : `${range}　${i.startTime}–${i.endTime}`
})

const onEdit = () => {
  if (!row.value) return
  const r = row.value
  emit('close')
  openEdit(r)
}

const onDelete = async () => {
  if (!row.value) return
  const id = row.value.id
  const ok = await confirm({
    title: '刪除事件',
    message: `確定要刪除「${row.value.title}」嗎？`,
    confirmText: '刪除',
    type: 'danger',
  })
  if (!ok) return
  try {
    await remove(id)
    success('已刪除')
    emit('close')
  } catch (e) {
    console.error('[EventDetailSheet] delete error:', e)
    notifyError('刪除失敗，請再試一次')
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="row" class="fixed inset-0 z-[60] flex items-end justify-center bg-black/40" @click.self="emit('close')">
      <div class="w-full max-w-md bg-white rounded-t-[28px] p-5 pb-safe shadow-xl max-h-[80vh] overflow-y-auto">
        <div class="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4"></div>
        <span
          v-if="cat"
          class="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold text-white mb-2"
          :style="{ backgroundColor: cat.color }"
        >{{ cat.name }}</span>
        <h3 class="text-xl font-black text-primary-900">{{ row.title }}</h3>
        <p class="text-[13px] font-semibold text-slate-600 mt-1">{{ when }}</p>
        <p v-if="row.description" class="text-[15px] text-primary-900 mt-3 whitespace-pre-wrap">{{ row.description }}</p>
        <p class="text-[11px] text-slate-500 mt-3 flex items-center gap-1">
          <template v-if="row.visibility === 'shared'"><Users class="w-3 h-3" /> 全家</template>
          <template v-else><Lock class="w-3 h-3" /> 只有我</template>
        </p>

        <div class="flex gap-3 mt-5">
          <button class="flex-1 flex items-center justify-center gap-1 min-h-[48px] rounded-[14px] bg-red-50 text-red-600 font-bold text-[13px]" @click="onDelete()">
            <Trash2 class="w-4 h-4" /> 刪除
          </button>
          <button class="flex-1 flex items-center justify-center gap-1 min-h-[48px] rounded-[14px] btn-primary font-bold text-[13px]" @click="onEdit()">
            <Pencil class="w-4 h-4" /> 編輯
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.pb-safe {
  padding-bottom: max(1.25rem, env(safe-area-inset-bottom, 20px));
}
</style>
