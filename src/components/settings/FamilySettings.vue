<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Copy } from 'lucide-vue-next'
import { useAuth } from '../../composables/useAuth'
import { useCalendarEvents } from '../../composables/useCalendarEvents'
import { useConfirm } from '../../composables/useConfirm'
import { useEventCategories } from '../../composables/useEventCategories'
import { useFamily } from '../../composables/useFamily'
import { useNotification } from '../../composables/useNotification'
import { useTrips } from '../../composables/useTrips'
import { useUserProfile } from '../../composables/useUserProfile'

const { session } = useAuth()
const { members, family, load: loadFamily, join } = useFamily()
const { fetchProfile, familyId } = useUserProfile()
const { fetchTrips } = useTrips()
const { load: loadEvents } = useCalendarEvents()
const { load: loadCategories } = useEventCategories()
const { confirm } = useConfirm()
const { success, error: notifyError } = useNotification()

const code = ref('')
const joining = ref(false)

onMounted(() => {
  loadFamily()
})

const copyCode = async () => {
  if (!family.value) return
  try {
    await navigator.clipboard.writeText(family.value.invite_code)
    success('已複製邀請碼')
  } catch {
    notifyError('複製失敗，請手動選取邀請碼')
  }
}

const handleJoin = async () => {
  const input = code.value.trim()
  const userId = session.value?.user?.id
  if (!input || !userId || joining.value) return
  if (family.value && input.toUpperCase() === family.value.invite_code.toUpperCase()) {
    notifyError('你已經在這個家庭了')
    return
  }
  const ok = await confirm({
    title: '加入另一個家庭',
    message: '加入後會改看對方家庭的行事曆與行程。你原本的露營行程與事件不會搬過去。',
    confirmText: '加入',
    type: 'warning',
  })
  if (!ok) return
  joining.value = true
  try {
    await join(input)
    code.value = ''
    // 家庭變了：行程、事件、分類、成員都要重新載入
    await fetchProfile(userId)
    await Promise.all([fetchTrips(userId, familyId()), loadEvents(), loadCategories(), loadFamily()])
    success('已加入家庭')
  } catch (e) {
    console.error('[FamilySettings] join error:', e)
    notifyError((e as { code?: string })?.code === 'P0002' ? '邀請碼不正確' : '加入失敗，請稍後再試')
  } finally {
    joining.value = false
  }
}
</script>

<template>
  <div class="p-4 space-y-4">
    <section class="bg-white rounded-[18px] p-4 space-y-2">
      <h3 class="text-[11px] font-semibold text-slate-500">成員</h3>
      <p v-if="members.length === 0" class="text-[13px] text-slate-500">還沒有家庭成員</p>
      <ul v-else class="space-y-1">
        <li v-for="m in members" :key="m.id" class="flex items-center gap-2 min-h-[44px]">
          <span class="text-[15px] font-bold text-primary-900 truncate">{{ m.name }}</span>
          <span v-if="m.id === session?.user?.id" class="text-[11px] font-bold text-primary-600 shrink-0">我</span>
          <span v-if="m.is_head" class="text-[11px] font-bold text-slate-500 shrink-0">家長</span>
        </li>
      </ul>
    </section>

    <section v-if="family" class="bg-white rounded-[18px] p-4 space-y-2">
      <h3 class="text-[11px] font-semibold text-slate-500">我的邀請碼</h3>
      <div class="flex items-center gap-2">
        <span class="flex-1 text-xl font-black tracking-widest text-primary-900 select-all">{{ family.invite_code }}</span>
        <button
          class="w-11 h-11 flex items-center justify-center rounded-full bg-primary-100 text-primary-700"
          aria-label="複製邀請碼"
          @click="copyCode"
        >
          <Copy class="w-5 h-5" />
        </button>
      </div>
      <p class="text-[11px] text-slate-500">把邀請碼給家人，對方在自己的設定頁輸入就能加入</p>
    </section>

    <section class="bg-white rounded-[18px] p-4 space-y-3">
      <h3 class="text-[11px] font-semibold text-slate-500">輸入邀請碼加入家庭</h3>
      <input
        v-model="code"
        maxlength="32"
        autocapitalize="characters"
        class="w-full px-4 min-h-[48px] bg-white border border-primary-100 rounded-[14px] text-[15px] focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
        placeholder="邀請碼"
      />
      <button
        :disabled="!code.trim() || joining"
        class="w-full min-h-[48px] font-bold text-white bg-primary-500 rounded-[14px] disabled:opacity-50"
        @click="handleJoin"
      >
        加入
      </button>
    </section>
  </div>
</template>
