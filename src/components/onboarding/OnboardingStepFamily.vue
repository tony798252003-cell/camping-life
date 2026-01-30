<script setup lang="ts">
import { ref } from 'vue'
import { supabase } from '../../lib/supabase'
import { Users, Plus, LogIn } from 'lucide-vue-next'

const emit = defineEmits<{
  next: [choice: 'create' | 'join' | 'skip']
}>()

const mode = ref<'choice' | 'create' | 'join'>('choice')
const familyName = ref('')
const inviteCode = ref('')
const error = ref('')
const isSubmitting = ref(false)

const handleChoice = (choice: 'create' | 'join' | 'skip') => {
  if (choice === 'skip') {
    emit('next', 'skip')
  } else {
    mode.value = choice
  }
}

const handleCreateFamily = async () => {
  if (!familyName.value.trim()) {
    error.value = '請輸入家庭名稱'
    return
  }

  isSubmitting.value = true
  error.value = ''

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('未登入')

    // Generate invite code (6 characters)
    const code = Math.random().toString(36).substring(2, 8).toUpperCase()

    // Create family
    const { data: family, error: familyError } = await supabase
      .from('families')
      .insert({
        name: familyName.value.trim(),
        invite_code: code,
        created_by: user.id
      })
      .select()
      .single()

    if (familyError) throw familyError

    // Update profile with family_id
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ family_id: family.id })
      .eq('id', user.id)

    if (profileError) throw profileError

    emit('next', 'create')
  } catch (err: any) {
    error.value = err.message || '建立家庭失敗'
  } finally {
    isSubmitting.value = false
  }
}

const handleJoinFamily = async () => {
  if (!inviteCode.value.trim()) {
    error.value = '請輸入邀請碼'
    return
  }

  isSubmitting.value = true
  error.value = ''

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('未登入')

    // Find family by invite code
    const { data: family, error: familyError } = await supabase
      .from('families')
      .select('id')
      .eq('invite_code', inviteCode.value.trim().toUpperCase())
      .single()

    if (familyError || !family) {
      error.value = '邀請碼無效或已過期'
      return
    }

    // Update profile with family_id
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ family_id: family.id })
      .eq('id', user.id)

    if (profileError) throw profileError

    emit('next', 'join')
  } catch (err: any) {
    error.value = err.message || '加入家庭失敗'
  } finally {
    isSubmitting.value = false
  }
}

const backToChoice = () => {
  mode.value = 'choice'
  error.value = ''
}
</script>

<template>
  <div>
    <!-- Choice Mode -->
    <div v-if="mode === 'choice'" class="text-center">
      <div class="mb-6">
        <div class="w-20 h-20 bg-gradient-to-br from-primary-400 to-primary-600 rounded-3xl flex items-center justify-center mx-auto mb-4">
          <Users class="w-10 h-10 text-white" />
        </div>
        <h2 class="text-2xl font-bold text-primary-900 mb-2">要不要建立家庭？</h2>
        <p class="text-primary-500">與家人共享露營記錄和裝備</p>
      </div>

      <div class="space-y-4 mb-8">
        <div class="bg-surface-50 rounded-2xl p-6 text-left">
          <div class="grid grid-cols-2 gap-4 text-sm text-primary-600">
            <div class="flex items-start gap-2">
              <span class="text-lg">📊</span>
              <span>共享露營行程記錄</span>
            </div>
            <div class="flex items-start gap-2">
              <span class="text-lg">🎒</span>
              <span>共同管理裝備清單</span>
            </div>
            <div class="flex items-start gap-2">
              <span class="text-lg">📅</span>
              <span>同步行事曆活動</span>
            </div>
            <div class="flex items-start gap-2">
              <span class="text-lg">👥</span>
              <span>多人協作編輯</span>
            </div>
          </div>
        </div>
      </div>

      <div class="space-y-3">
        <button
          @click="handleChoice('create')"
          class="w-full flex items-center justify-center gap-3 bg-primary-500 hover:bg-primary-600 text-white font-bold py-4 px-6 rounded-2xl transition-all duration-300 transform active:scale-95"
        >
          <Plus class="w-5 h-5" />
          <span>建立新家庭</span>
        </button>

        <button
          @click="handleChoice('join')"
          class="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-700 font-bold py-4 px-6 rounded-2xl border border-gray-200 transition-all duration-300 transform active:scale-95"
        >
          <LogIn class="w-5 h-5" />
          <span>加入現有家庭</span>
        </button>

        <button
          @click="handleChoice('skip')"
          class="w-full text-sm text-gray-400 hover:text-gray-600 py-2"
        >
          暫時不要
        </button>
      </div>
    </div>

    <!-- Create Family Mode -->
    <div v-else-if="mode === 'create'" class="text-center">
      <h2 class="text-2xl font-bold text-primary-900 mb-6">建立新家庭</h2>

      <div class="space-y-4">
        <div class="text-left">
          <label class="block text-sm font-medium text-primary-700 mb-2">家庭名稱</label>
          <input
            v-model="familyName"
            type="text"
            placeholder="例如：王家露營團"
            class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all"
            @keyup.enter="handleCreateFamily"
          />
        </div>

        <p v-if="error" class="text-sm text-red-500">{{ error }}</p>

        <div class="flex gap-3 pt-4">
          <button
            @click="backToChoice"
            class="flex-1 py-3 px-6 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all"
          >
            返回
          </button>
          <button
            @click="handleCreateFamily"
            :disabled="isSubmitting || !familyName.trim()"
            class="flex-1 py-3 px-6 rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span v-if="isSubmitting">建立中...</span>
            <span v-else>建立並繼續</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Join Family Mode -->
    <div v-else-if="mode === 'join'" class="text-center">
      <h2 class="text-2xl font-bold text-primary-900 mb-6">加入現有家庭</h2>

      <div class="space-y-4">
        <div class="text-left">
          <label class="block text-sm font-medium text-primary-700 mb-2">邀請碼</label>
          <input
            v-model="inviteCode"
            type="text"
            placeholder="輸入 6 位邀請碼"
            maxlength="6"
            class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all uppercase"
            @keyup.enter="handleJoinFamily"
          />
        </div>

        <p v-if="error" class="text-sm text-red-500">{{ error }}</p>

        <div class="flex gap-3 pt-4">
          <button
            @click="backToChoice"
            class="flex-1 py-3 px-6 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all"
          >
            返回
          </button>
          <button
            @click="handleJoinFamily"
            :disabled="isSubmitting || inviteCode.length !== 6"
            class="flex-1 py-3 px-6 rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span v-if="isSubmitting">加入中...</span>
            <span v-else>加入家庭</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
