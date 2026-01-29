import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router'
import { supabase } from './lib/supabase'

const app = createApp(App)

// Ensure Supabase session is initialized before mounting to prevent AbortErrors
supabase.auth.getSession().then(() => {
    app.use(router)
    app.mount('#app')
})
