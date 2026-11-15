import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { LoadIssueBanner, LoadFailedScreen } from './LoadIssueBanner'

describe('LoadIssueBanner', () => {
  it('speaks the page language, with a reload button', () => {
    const html = renderToStaticMarkup(<LoadIssueBanner lang="fr" />)
    expect(html).toContain('role="alert"')
    expect(html).toContain('peuvent être incomplets')
    expect(html).toContain('Recharger')
  })

  it('has Portuguese for the drivers and the taxi manager', () => {
    expect(renderToStaticMarkup(<LoadIssueBanner lang="pt" />)).toContain('Recarregar')
  })

  it('falls back to English for a language it does not know', () => {
    expect(renderToStaticMarkup(<LoadIssueBanner lang="de" />)).toContain('may be incomplete')
  })
})

describe('LoadFailedScreen', () => {
  it('blames the connection, never the link', () => {
    const html = renderToStaticMarkup(<LoadFailedScreen lang="es" />)
    expect(html).toContain('Compruebe su conexión')
    expect(html).not.toMatch(/introuvable|not found|no encontrad/i)
  })
})
