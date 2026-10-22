import { ref, computed } from 'vue'
import { familyQueries, type FamilyInfo, type FamilyMember } from '../services/db/family'
import { useUserProfile } from './useUserProfile'

// 模組層級 ref（singleton）：登出時 reset()
const members = ref<FamilyMember[]>([])
const family = ref<FamilyInfo | null>(null)
// 家人 id → 名稱，事件副標「· {name}新增」用
const names = computed(() => new Map(members.value.map((m) => [m.id, m.name])))

export function useFamily() {
  const { familyId } = useUserProfile()

  // 沒有家庭時兩者皆空；載入失敗不擋畫面（副標退回「家人」）
  const load = async () => {
    const fid = familyId()
    if (!fid) {
      members.value = []
      family.value = null
      return
    }
    try {
      const [m, f] = await Promise.all([familyQueries.listMembers(), familyQueries.getFamily(fid)])
      members.value = m
      family.value = f
    } catch (e) {
      console.error('[useFamily] load error:', e)
    }
  }

  const join = (code: string) => familyQueries.join(code)

  const reset = () => {
    members.value = []
    family.value = null
  }

  return { members, family, names, load, join, reset }
}
