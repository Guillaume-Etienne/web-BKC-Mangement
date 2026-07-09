import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { DocumentTemplateType, DocumentTemplateRow } from '../types/database'
import type { TravelGuideSection } from '../data/travelGuide'

// Guide sections stored in the document_templates table (admin-only).
// `saved` is the DB snapshot: null means the table has no rows yet for this
// doc_type (first run / not migrated) — the caller falls back to defaults
// (or the legacy localStorage content for the travel guide) and the first
// Save seeds the table.

function rowToSection(r: DocumentTemplateRow): TravelGuideSection {
  return { id: r.id, order: r.sort_order, is_active: r.is_active, title: r.title, content: r.content }
}

function sectionToRow(s: TravelGuideSection, docType: DocumentTemplateType): DocumentTemplateRow {
  return {
    id: s.id, doc_type: docType, sort_order: s.order,
    is_active: s.is_active, title: s.title, content: s.content,
    updated_at: new Date().toISOString(),
  }
}

export function useDocumentSections(docType: DocumentTemplateType) {
  const [saved,   setSaved]   = useState<TravelGuideSection[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('document_templates')
      .select('*')
      .eq('doc_type', docType)
      .order('sort_order')
      .then(({ data }) => {
        if (cancelled) return
        const rows = (data ?? []) as DocumentTemplateRow[]
        setSaved(rows.length > 0 ? rows.map(rowToSection) : null)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [docType])

  // Upserts all sections, removes stale ones. Returns null on success, error message otherwise.
  const save = useCallback(async (sections: TravelGuideSection[]): Promise<string | null> => {
    setSaving(true)
    try {
      const rows = sections.map(s => sectionToRow(s, docType))
      const { error } = await supabase
        .from('document_templates')
        .upsert(rows, { onConflict: 'doc_type,id' })
      if (error) return error.message
      const ids = sections.map(s => s.id)
      if (ids.length > 0) {
        const { error: delError } = await supabase
          .from('document_templates')
          .delete()
          .eq('doc_type', docType)
          .not('id', 'in', `(${ids.join(',')})`)
        if (delError) return delError.message
      }
      setSaved(sections)
      return null
    } finally {
      setSaving(false)
    }
  }, [docType])

  return { saved, loading, saving, save }
}
