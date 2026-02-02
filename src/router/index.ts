import { createRouter, createWebHistory } from 'vue-router'
import MainLayout from '../layouts/MainLayout.vue'
import HomeView from '../components/HomeView.vue'
import TripListView from '../components/TripListView.vue'
import CalendarView from '../components/CalendarView.vue'
import CampsiteLibrary from '../components/CampsiteLibrary.vue'
import LoginView from '../components/LoginView.vue'
import SettingsView from '../views/SettingsView.vue'
import StatsView from '../views/StatsView.vue'
import { supabase } from '../lib/supabase'

const routes = [
    {
        path: '/',
        component: MainLayout,
        children: [
            {
                path: '',
                name: 'home',
                component: HomeView
            },
            {
                path: 'list',
                name: 'list',
                component: TripListView
            },
            {
                path: 'calendar',
                name: 'calendar',
                component: CalendarView
            },
            {
                path: 'library',
                name: 'library',
                component: CampsiteLibrary
            },
            {
                path: 'stats',
                name: 'stats',
                component: StatsView
            }
        ]
    },
    {
        path: '/settings',
        name: 'settings',
        component: SettingsView
    },
    {
        path: '/builder',
        name: 'builder',
        component: () => import('../views/CampsiteBuilder.vue')
    },
    {
        path: '/auth',
        name: 'auth',
        component: LoginView
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
            next({ name: 'auth' })
        } else if (session && to.name === 'auth') {
            next({ name: 'home' })
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
