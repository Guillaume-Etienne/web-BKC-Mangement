import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import type { Lang } from '../types/database'
import { useAdminLang } from '../hooks/useAdminLang'

interface LanguageContextType {
  lang: Lang
  setLang: (lang: Lang) => void
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

interface LanguageProviderProps {
  children: ReactNode
  /** Controlled mode: pass the value down from a parent that already needs it
   *  itself (e.g. App.tsx, which computes pendingActions' messages before this
   *  provider even mounts). Omit to keep the old uncontrolled behaviour, where
   *  the provider owns the localStorage-backed state on its own. */
  lang?: Lang
  setLang?: (lang: Lang) => void
}

export function LanguageProvider({ children, lang: controlledLang, setLang: controlledSetLang }: LanguageProviderProps) {
  const own = useAdminLang()
  const lang = controlledLang ?? own.lang
  const setLang = controlledSetLang ?? own.setLang

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) {
    throw new Error('useLanguage must be used within LanguageProvider')
  }
  return ctx
}
