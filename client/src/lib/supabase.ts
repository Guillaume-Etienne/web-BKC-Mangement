import { createClient } from '@supabase/supabase-js'
import { trackedFetch } from './loadingTracker'
import { clearTableCache } from './tableCache'

export type SupabaseEnv = 'prod' | 'test'

const prodUrl  = import.meta.env.VITE_SUPABASE_URL       as string
const prodKey  = import.meta.env.VITE_SUPABASE_ANON_KEY  as string
const testUrl  = import.meta.env.VITE_SUPABASE_TEST_URL  as string | undefined
const testKey  = import.meta.env.VITE_SUPABASE_TEST_KEY  as string | undefined

// Read defensively: an in-app browser (a link opened from WhatsApp or Facebook
// on Android) and a phone set to block all site data both make localStorage
// THROW, not return null. Unguarded at module scope, that exception stops this
// module from ever evaluating — and every page that imports it, the public
// booking form included, renders a white screen with nothing in the UI to say why.
function storedEnv(): string | null {
  try { return localStorage.getItem('supabase_env') } catch { return null }
}
const wantTest  = storedEnv() === 'test'
const canTest   = !!(testUrl && testKey)

export const currentEnv: SupabaseEnv = wantTest && canTest ? 'test' : 'prod'
export const testConfigured = canTest

export function switchEnv(env: SupabaseEnv) {
  try { localStorage.setItem('supabase_env', env) } catch { /* same reason as above */ }
  window.location.reload()
}

const url = currentEnv === 'test' ? testUrl! : prodUrl
const key = currentEnv === 'test' ? testKey! : prodKey

// Pages partagées (?share=<token>) : le token part dans un header sur CHAQUE requête
// REST, pour que les policies RLS token-aware filtrent les lignes côté base.
// Voir .claude/docs/phase2-rls-token-aware.md. L'app admin n'a pas de ?share= → pas
// de header → policies authenticated inchangées.
const shareToken = new URLSearchParams(window.location.search).get('share')

// trackedFetch feeds the green loading bar under the navigation.
export const supabase = createClient(url, key, {
  global: {
    fetch: trackedFetch,
    ...(shareToken ? { headers: { 'x-share-token': shareToken } } : {}),
  },
})

// Rows read by one admin are not left in memory for whoever signs in next.
supabase.auth.onAuthStateChange(event => { if (event === 'SIGNED_OUT') clearTableCache() })
