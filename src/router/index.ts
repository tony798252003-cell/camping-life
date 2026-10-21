import { createRouter, createWebHistory } from 'vue-router'
import MainLayout from '../layouts/MainLayout.vue'
import { supabase } from '../lib/supabase'

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
