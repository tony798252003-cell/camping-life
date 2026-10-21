import { createRouter, createWebHistory } from 'vue-router'
import MainLayout from '../layouts/MainLayout.vue'
import { supabase } from '../lib/supabase'
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
router.beforeEach(async (to, _from, next) => {
    try {
        const { data: { session } } = await supabase.auth.getSession()

        if (!session && to.name !== 'auth') {
            // 邀請連結未登入：記下邀請碼，登入（OAuth 整頁跳轉回首頁）後再導回
            if (to.name === 'settings' && to.query.view === 'family') savePendingJoinCode(normalizeJoinCode(to.query.code))
            next({ name: 'auth' })
        } else if (session && (to.name === 'auth' || to.name === 'home')) {
            const pending = takePendingJoinCode()
            if (pending) next(joinSettingsRoute(pending))
            else if (to.name === 'auth') next({ name: 'home' })
            else next()
        } else {
            next()
        }
    } catch (error) {
        // If session check fails (e.g. AbortError), we might want to default to auth or just proceed if it's safe.
        // For safety, if we can't verify session, send to auth if not already there.
        console.warn('[Router] Session check warning:', error)
        if (to.name !== 'auth') {
            next({ name: 'auth' })
        } else {
            next()
        }
    }
})

export default router
