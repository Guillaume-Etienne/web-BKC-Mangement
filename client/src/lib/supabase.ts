import { createClient } from '@supabase/supabase-js'

export type SupabaseEnv = 'prod' | 'test'

const prodUrl  = import.meta.env.VITE_SUPABASE_URL       as string
const prodKey  = import.meta.env.VITE_SUPABASE_ANON_KEY  as string
const testUrl  = import.meta.env.VITE_SUPABASE_TEST_URL  as string | undefined
const testKey  = import.meta.env.VITE_SUPABASE_TEST_KEY  as string | undefined

const wantTest  = localStorage.getItem('supabase_env') === 'test'
const canTest   = !!(testUrl && testKey)

export const currentEnv: SupabaseEnv = wantTest && canTest ? 'test' : 'prod'
export const testConfigured = canTest

export function switchEnv(env: SupabaseEnv) {
  localStorage.setItem('supabase_env', env)
  window.location.reload()
}

const url = currentEnv === 'test' ? testUrl! : prodUrl
const key = currentEnv === 'test' ? testKey! : prodKey

export const supabase = createClient(url, key)
