import { useState, useCallback } from 'react'
import type { Lang } from '../types/database'
import { detectAdminLang } from '../data/i18n'

const STORAGE_KEY = 'admin_lang'

export function useAdminLang() {
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === 'fr' || stored === 'es' || stored === 'en') {
        return stored
      }
    } catch {
      // localStorage not available
    }
    return detectAdminLang()
  })

  const setLang = useCallback((newLang: Lang) => {
    setLangState(newLang)
    try {
      localStorage.setItem(STORAGE_KEY, newLang)
    } catch {
      // localStorage not available, continue anyway
    }
  }, [])

  return { lang, setLang }
}
