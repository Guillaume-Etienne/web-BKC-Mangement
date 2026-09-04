import { describe, it, expect } from 'vitest'
import { classifyError, isSelfHealing } from './recoverableError'

describe('classifyError', () => {
  it('recognises the crash our Android client actually hit — in French', () => {
    // Verbatim shape of what Chrome/Android reports when Google Translate has
    // swapped React's text nodes. The sentence is translated; the API name is not.
    const err = new Error(
      "Échec de l'exécution de « removeChild » sur « Node » : le nœud à supprimer n'est pas un enfant de ce nœud."
    )
    expect(classifyError(err)).toBe('dom-mutated')
  })

  it('recognises the same crash in English and in Spanish', () => {
    expect(classifyError(new Error(
      "Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node."
    ))).toBe('dom-mutated')
    expect(classifyError(new Error(
      "No se pudo ejecutar 'insertBefore' en 'Node': el nodo antes del cual se insertará no es hijo de este nodo."
    ))).toBe('dom-mutated')
  })

  it('recognises it from the DOMException name alone, whatever the message says', () => {
    expect(classifyError({ name: 'NotFoundError', message: '' })).toBe('dom-mutated')
  })

  it('files a stale chunk as a chunk, not as a network failure', () => {
    // This one carries BOTH signatures — the order of the table is the test.
    expect(classifyError(new Error(
      'Failed to fetch dynamically imported module: https://x.vercel.app/assets/BookingFormPage-a1b2.js'
    ))).toBe('chunk')
    expect(classifyError(new Error("Unexpected token '<'"))).toBe('chunk')
  })

  it('files a dropped connection as network', () => {
    expect(classifyError(new TypeError('Failed to fetch'))).toBe('network')
    expect(classifyError({ message: 'NetworkError when attempting to fetch resource.' })).toBe('network')
  })

  it('files a browser that refuses to store as storage', () => {
    expect(classifyError(new Error(
      "Failed to read the 'localStorage' property from 'Window': Access is denied for this document."
    ))).toBe('storage')
  })

  it('does not guess', () => {
    expect(classifyError(new Error('Cannot read properties of undefined'))).toBe('unknown')
    expect(classifyError(null)).toBe('unknown')
    expect(classifyError(undefined)).toBe('unknown')
  })

  it('only remounts by itself for the DOM family', () => {
    expect(isSelfHealing('dom-mutated')).toBe(true)
    // A silent remount on any of these would simply crash again.
    expect(isSelfHealing('chunk')).toBe(false)
    expect(isSelfHealing('network')).toBe(false)
    expect(isSelfHealing('unknown')).toBe(false)
  })
})
