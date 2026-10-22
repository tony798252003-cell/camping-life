import { createRouter, createWebHistory } from 'vue-router'
import MainLayout from '../layouts/MainLayout.vue'
import { watch } from 'vue'
import { useAuth } from '../composables/useAuth'
import { authGuardTarget } from './authGuard'
import { normalizeJoinCode, savePendingJoinCode, takePendingJoinCode } from '../utils/familyJourney'

const joinSettingsRoute = (code: string) => ({ name: 'settings', query: { view: 'family', ...(code ? { code } : {}) } })

const routes = [
    {
        path: '/',
        component: MainLayout,
        children: [
            {
                path: '',
                name: 'home',
                component: () => import('../views/HomeView.vue')
            },
            {
                path: 'list',
                name: 'list',
                component: () => import('../components/TripListView.vue')
            },
            {
                path: 'calendar',
                name: 'calendar',
                component: () => import('../components/calendar/CalendarHome.vue')
            },
            {
                path: 'library',
                name: 'library',
                component: () => import('../components/CampsiteLibrary.vue')
            },
            {
                path: 'library/discover',
                name: 'library-discover',
                component: () => import('../components/campsite/DiscoverCampsitesView.vue')
            },
            {
                path: 'library/new',
                name: 'library-new',
                component: () => import('../components/campsite/AddCampsiteView.vue')
            },
            {
                path: 'lists/:id',
                name: 'family-list',
                component: () => import('../views/FamilyListView.vue')
            },
            {
                path: 'settings',
                name: 'settings',
                component: () => import('../views/SettingsView.vue')
            },
            {
                path: 'stats',
                name: 'stats',
                component: () => import('../views/StatsView.vue')
            }
        ]
    },
    {
        // 邀請連結：導到設定 → 家庭成員並帶入邀請碼，仍須使用者按「加入」確認
        path: '/join',
        name: 'join',
        redirect: (to: { query: Record<string, unknown> }) => joinSettingsRoute(normalizeJoinCode(to.query.code))
    },
    {
        path: '/builder',
        redirect: '/'
    },
    {
        path: '/auth',
        name: 'auth',
        component: () => import('../components/LoginView.vue')
    }
]


const router = createRouter({
    history: createWebHistory(),
    routes
})

// Navigation Guard for Auth
// 不在每次切頁時呼叫 supabase.auth.getSession()：它會跟背景 token 更新搶同一把鎖，
// 手機從背景回來時更新請求可能卡住，切 tab 就整個沒反應。改用 useAuth 記在記憶體的 session，
// 只有 app 剛啟動、初次登入檢查還沒完成時等一次。
const authReady = () => {
    const { isAuthReady } = useAuth()
    if (isAuthReady.value) return Promise.resolve()
    return new Promise<void>((resolve) => {
        const stop = watch(isAuthReady, (ready) => { if (ready) { stop(); resolve() } })
    })
}

router.beforeEach(async (to) => {
    await authReady()
    const { session } = useAuth()
    return authGuardTarget(to, !!session.value, { save: savePendingJoinCode, take: takePendingJoinCode })
})

export default router
