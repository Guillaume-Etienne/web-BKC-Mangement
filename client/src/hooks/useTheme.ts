import { useEffect, useState } from 'react'
import { writeLocal } from '../utils/safeStorage'

const STORAGE_KEY = 'bkc_theme'
type Theme = 'light' | 'dark'

function apply(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(
    () => (document.documentElement.classList.contains('dark') ? 'dark' : 'light')
  )

  useEffect(() => { apply(theme) }, [theme])

  function toggleTheme() {
    setTheme(t => {
      const next = t === 'dark' ? 'light' : 'dark'
      writeLocal(STORAGE_KEY, next)
      return next
    })
  }

  return { theme, toggleTheme }
}
