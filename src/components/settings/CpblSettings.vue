<template>
  <div class="p-6 space-y-6">
     <div class="bg-red-50 border border-red-100 rounded-xl p-4">
        <h3 class="font-bold text-red-800 mb-2 flex items-center gap-2">
           <ShieldAlert class="w-5 h-5" />
           危險操作區
        </h3>
        <p class="text-xs text-red-600 mb-4">
           此區域功能會直接修改資料庫大量數據，請謹慎使用。
        </p>
        
        <div class="space-y-4">
           <div class="bg-white p-4 rounded-lg border border-blue-200 shadow-sm mt-4">
              <h4 class="font-bold text-gray-800 mb-1 flex items-center gap-2">
                 同步 CPBL 賽程
              </h4>
              <p class="text-xs text-gray-500 mb-3">
                 從中華職棒官網抓取指定年度的賽程並寫入資料庫，供前台行事曆與新增行程時使用。此操作需要一些時間。
              </p>
              
              <div class="flex gap-2 mb-3">
                 <input type="number" v-model="syncYear" class="px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm w-32 flex-1" placeholder="年份" />
              </div>
              
              <div class="flex flex-col gap-2">
                  <button 
                     @click="handleSyncCpbl"
                     :disabled="isSyncingCpbl"
                     class="w-full justify-center py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                     <Loader2 v-if="isSyncingCpbl" class="w-4 h-4 animate-spin" />
                     {{ isSyncingCpbl ? '同步中...' : '開始同步賽程' }}
                  </button>
                  <button
                     @click="handleResyncCpbl"
                     :disabled="isSyncingCpbl"
                     class="w-full justify-center py-2 bg-white border border-blue-600 text-blue-700 font-bold rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                     重新同步整年
                  </button>
              </div>
           </div>
        </div>
     </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Loader2, ShieldAlert } from 'lucide-vue-next'
import { syncCpblScheduleForYear, resyncCpblYear } from '../../services/cpblService'
import { useConfirm } from '../../composables/useConfirm'
import { useNotification } from '../../composables/useNotification'

const { confirm: confirmDialog } = useConfirm()
const { success: notifySuccess, error: notifyError } = useNotification()

// CPBL Sync Logic
const isSyncingCpbl = ref(false)
const syncYear = ref(new Date().getFullYear())

const handleSyncCpbl = async () => {
  if (!confirm(`確定要同步 ${syncYear.value} 年度的 CPBL 賽程嗎？這可能會需要 10~20 秒。`)) {
    return
  }
  isSyncingCpbl.value = true
  try {
    await syncCpblScheduleForYear(syncYear.value)
    alert('✅ CPBL 賽程同步完成！')
  } catch (error: any) {
    console.error('CPBL 同步失敗:', error)
    alert('❌ 同步失敗: ' + error.message)
  } finally {
    isSyncingCpbl.value = false
  }
}

const handleResyncCpbl = async () => {
  const ok = await confirmDialog({
    title: `重新同步 ${syncYear.value} 年`,
    message: '會刪除官方已取消或改期的舊比賽，已加入你行事曆的比賽不受影響。',
    type: 'warning',
  })
  if (!ok) return
  isSyncingCpbl.value = true
  try {
    const { upserted, deleted } = await resyncCpblYear(syncYear.value)
    notifySuccess(`新增/更新 ${upserted} 場、移除 ${deleted} 場`)
  } catch (error: any) {
    console.error('CPBL 重新同步失敗:', error)
    notifyError('重新同步失敗，未刪除任何比賽：' + error.message)
  } finally {
    isSyncingCpbl.value = false
  }
}
</script>
