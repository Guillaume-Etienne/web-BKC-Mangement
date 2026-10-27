import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { execSync } from 'node:child_process'

// App version shown under "BKC" in the menu: V1.<number of commits>, so it goes up
// by itself with every push and tells which build a device is running. The short
// hash and build date go in its tooltip. If git is unavailable, show "V1.?".
const git = (cmd: string) => execSync(`git ${cmd}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()

function appVersion() {
  try {
    // A shallow checkout (CI) would count only the commits it fetched
    if (git('rev-parse --is-shallow-repository') === 'true') {
      try { git('fetch --unshallow --quiet') } catch { /* keep the partial count */ }
    }
    return { count: git('rev-list --count HEAD'), sha: git('rev-parse --short HEAD') }
  } catch {
    return { count: '?', sha: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? '' }
  }
}

const v = appVersion()

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(`V1.${v.count}`),
    __APP_BUILD__: JSON.stringify(`${v.sha} · ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`),
  },
})
