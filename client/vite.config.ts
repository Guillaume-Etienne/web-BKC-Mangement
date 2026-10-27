import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { execSync } from 'node:child_process'

// App version shown under "BKC" in the menu: V1.<number of commits>, so it goes up
// by itself with every push and tells which build a device is running. The short
// hash and build date go in its tooltip.
//
// Vercel clones only the last ~10 commits, and `git fetch --unshallow` does not work
// there (it showed "V1.10"). In that case the count comes from the GitHub API (public
// repo): the "last" page of /commits?per_page=1 IS the number of commits up to a sha.
// If nothing works, "V1.?" — never a wrong number.
const git = (cmd: string) => execSync(`git ${cmd}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
const REPO = 'Guillaume-Etienne/web-BKC-Mangement'

async function commitCount(sha: string): Promise<string> {
  let shallow = true
  try { shallow = git('rev-parse --is-shallow-repository') === 'true' } catch { /* no git */ }
  if (shallow) {
    try { git('fetch --unshallow --quiet'); shallow = git('rev-parse --is-shallow-repository') === 'true' } catch { /* try the API */ }
  }
  if (!shallow) { try { return git('rev-list --count HEAD') } catch { /* fall through */ } }
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/commits?per_page=1&sha=${sha}`, { signal: AbortSignal.timeout(8000) })
    const last = res.headers.get('link')?.match(/[?&]page=(\d+)>; rel="last"/)?.[1]
    if (res.ok && last) return last
  } catch { /* offline */ }
  return '?'
}

export default defineConfig(async () => {
  let sha = process.env.VERCEL_GIT_COMMIT_SHA ?? ''
  if (!sha) { try { sha = git('rev-parse HEAD') } catch { /* no git */ } }
  const count = await commitCount(sha)
  return {
    plugins: [react(), tailwindcss()],
    define: {
      __APP_VERSION__: JSON.stringify(`V1.${count}`),
      __APP_BUILD__: JSON.stringify(`${sha.slice(0, 7)} · ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`),
    },
  }
})
