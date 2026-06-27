// Supabase Edge Function — notify on new public booking-form submission.
//
// Triggered by a DATABASE WEBHOOK on `form_submissions` INSERT (server-side,
// so it fires even if the client closes the tab and can't be spammed by anon).
//
// Sends 2 emails via Resend (no email_logs entry — these are notifications,
// not the official documents tracked there):
//   1. ADMIN  → contact@bilenekite.com : "new form submitted by X" + summary
//   2. CLIENT → submission.email        : trilingual acknowledgment (FR/EN/ES)
//
// Deploy : supabase functions deploy notify-submission --no-verify-jwt
// Secrets: RESEND_API_KEY (already set), NOTIFY_SECRET (shared with the webhook)
// Webhook: add HTTP header  x-notify-secret: <same value as NOTIFY_SECRET>

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-notify-secret',
}

const FROM = 'BKC <no-reply@bilenekite.com>'
const ADMIN_EMAIL = 'contact@bilenekite.com'

const FAQ_URL: Record<string, string> = {
  fr: 'https://www.bilenekite.com/fr/La-pr%c3%a9paration-de-votre-voyage-a-bilene-au-mozambique/',
  en: 'https://www.bilenekite.com/en/prepare-your-trip-to-bilene-mozambique/',
  es: 'https://www.bilenekite.com/es/preparar-tu-viaje-a-bilene-mozambique/',
}

type Lang = 'fr' | 'en' | 'es'

// ─── Client acknowledgment copy (mirrors formI18n success_msg) ────────────────
const ACK = {
  subject: {
    fr: 'Nous avons bien reçu votre demande 🌊',
    en: 'We received your request 🌊',
    es: 'Hemos recibido tu solicitud 🌊',
  },
  heading: {
    fr: 'Merci pour votre demande !',
    en: 'Thank you for your request!',
    es: '¡Gracias por tu solicitud!',
  },
  body: {
    fr: 'Nous avons bien reçu votre demande de réservation et revenons vers vous très vite pour confirmer les détails. Bon vent ! 🌊',
    en: 'We have received your booking request and will get back to you very soon to confirm the details. Fair winds! 🌊',
    es: 'Hemos recibido tu solicitud de reserva y te responderemos muy pronto para confirmar los detalles. ¡Buen viento! 🌊',
  },
  signoff: {
    fr: ‘L’équipe Bilene Kite Center’,
    en: ‘The Bilene Kite Center team’,
    es: ‘El equipo de Bilene Kite Center’,
  },
  faq_label: {
    fr: ‘Préparez votre voyage →’,
    en: ‘Prepare your trip →’,
    es: ‘Prepara tu viaje →’,
  },
  faq_hint: {
    fr: ‘Tout ce qu’il faut savoir avant d’arriver à Bilene.’,
    en: ‘Everything you need to know before arriving in Bilene.’,
    es: ‘Todo lo que necesitas saber antes de llegar a Bilene.’,
  },
}

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function clientAckHtml(lang: Lang, name: string): string {
  const t = (m: typeof ACK[keyof typeof ACK]) => m[lang] ?? m.en
  return `<!DOCTYPE html><html><body style="margin:0;background:#f0f9ff;font-family:Segoe UI,Arial,sans-serif;color:#0f172a">
    <div style="max-width:560px;margin:0 auto;padding:32px 24px">
      <div style="background:#ffffff;border-radius:16px;padding:32px;box-shadow:0 2px 12px rgba(2,132,199,.08)">
        <div style="font-size:28px">🌊🪁</div>
        <h1 style="font-size:20px;margin:16px 0 8px">${esc(t(ACK.heading))}</h1>
        <p style="margin:0 0 8px;color:#334155">${esc(name) ? `${esc(name)},` : ''}</p>
        <p style="margin:0 0 24px;line-height:1.6;color:#334155">${esc(t(ACK.body))}</p>
        <a href="${FAQ_URL[lang] ?? FAQ_URL.en}"
          style="display:inline-block;background:#0284c7;color:#ffffff;font-weight:600;font-size:14px;padding:12px 24px;border-radius:10px;text-decoration:none;margin-bottom:16px">
          ${esc(t(ACK.faq_label))}
        </a>
        <p style="margin:0 0 24px;font-size:13px;color:#64748b">${esc(t(ACK.faq_hint))}</p>
        <p style="margin:0;color:#0284c7;font-weight:600">${esc(t(ACK.signoff))}</p>
      </div>
      <p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:16px">Bilene Kite Center · Mozambique</p>
    </div></body></html>`
}

function adminNotifyHtml(record: Record<string, unknown>): string {
  const p = (record.payload ?? {}) as Record<string, unknown>
  const travelers = Array.isArray(p.travelers) ? p.travelers : []

  const row = (label: string, val: unknown) =>
    val != null && val !== ''
      ? `<tr><td style="padding:4px 12px 4px 0;color:#64748b;white-space:nowrap">${esc(label)}</td>`
        + `<td style="padding:4px 0;font-weight:600">${esc(val)}</td></tr>`
      : ''

  // Kite summary for one traveler
  const kiteSummary = (t: Record<string, unknown>): string => {
    if (!t.does_kite) return '— no kite'
    const parts: string[] = []
    if (t.kite_level) parts.push(String(t.kite_level))
    if (t.brings_own_gear) parts.push(t.needs_storage ? 'own gear + storage' : 'own gear')
    if (t.wants_kite_lessons) parts.push('lessons')
    if (t.wants_kite_rental) parts.push('rental')
    if (t.wants_wing_lessons) parts.push('wing')
    return '🪁 ' + (parts.join(' · ') || 'kiter')
  }

  // Per-traveler cards
  const crewHtml = travelers.map((raw, i) => {
    const t = raw as Record<string, unknown>
    const name = esc(`${t.first_name ?? ''} ${t.last_name ?? ''}`.trim()) || '—'
    const passport = esc(String(t.passport_number ?? '')) || '—'
    return `<div style="padding:8px 0;border-bottom:1px solid #f1f5f9">`
      + `<div style="display:flex;justify-content:space-between;gap:16px">`
      + `<span style="font-weight:600">${i + 1}. ${name}</span>`
      + `<span style="color:#64748b;font-family:monospace">${passport}</span>`
      + `</div>`
      + `<div style="font-size:12px;color:#0284c7;margin-top:2px">${esc(kiteSummary(t))}</div>`
      + `</div>`
  }).join('')

  return `<!DOCTYPE html><html><body style="margin:0;background:#f8fafc;font-family:Segoe UI,Arial,sans-serif;color:#0f172a">`
    + `<div style="max-width:620px;margin:0 auto;padding:32px 24px">`
    + `<div style="background:#ffffff;border-radius:16px;padding:32px;box-shadow:0 2px 12px rgba(15,23,42,.06)">`
    + `<h1 style="font-size:20px;margin:0 0 4px">📝 New booking form submitted</h1>`
    + `<p style="margin:0 0 24px;color:#64748b">Review it in the <strong>Submissions</strong> tab of the app.</p>`

    + `<h2 style="font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8;margin:0 0 8px">Summary</h2>`
    + `<table style="font-size:14px;border-collapse:collapse;margin-bottom:24px">`
    + row('Reference', record.reference_name)
    + row('Email', record.email)
    + row('Phone', p.phone)
    + row('Travelers', record.num_travelers)
    + row('Country entry', p.country_entry_date)
    + row('Country exit', p.country_exit_date)
    + row('Nights in Bilene', p.nights_bilene)
    + row('Language', record.language)
    + row('Referral', p.referral_source)
    + `</table>`

    + `<h2 style="font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8;margin:0 0 8px">`
    + `Crew (${travelers.length})</h2>`
    + `<div style="font-size:14px;margin-bottom:24px">${crewHtml || '<p style="color:#94a3b8">—</p>'}</div>`

    + `<h2 style="font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8;margin:0 0 8px">Emergency contact</h2>`
    + `<table style="font-size:14px;border-collapse:collapse">`
    + row('Name', p.emergency_contact_name)
    + row('Phone', p.emergency_contact_phone)
    + row('Email', p.emergency_contact_email)
    + row('Relation', p.emergency_contact_relation)
    + `</table>`

    + `</div></div></body></html>`
}

async function sendEmail(apiKey: string, to: string, subject: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  })
  if (!res.ok) {
    const err = await res.text()
    console.error(`Resend failed for ${to}: ${err}`)
    return false
  }
  return true
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  // Verify the shared secret set on the webhook (anon can't forge it).
  const secret = Deno.env.get('NOTIFY_SECRET')
  if (secret && req.headers.get('x-notify-secret') !== secret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  try {
    const apiKey = Deno.env.get('RESEND_API_KEY')
    if (!apiKey) throw new Error('RESEND_API_KEY not set')

    // Database Webhook payload: { type, table, schema, record, old_record }
    const body = await req.json()
    const record = (body.record ?? body) as Record<string, unknown>

    const lang = (['fr', 'en', 'es'].includes(String(record.language)) ? record.language : 'en') as Lang
    const clientEmail = String(record.email ?? '').trim()
    const refName = String(record.reference_name ?? '').trim()

    // 1. Admin notification (always)
    const adminOk = await sendEmail(
      apiKey, ADMIN_EMAIL,
      `New booking form — ${refName || clientEmail || 'unknown'}`,
      adminNotifyHtml(record),
    )

    // 2. Client acknowledgment (only if we have an email)
    let clientOk = false
    if (clientEmail) {
      clientOk = await sendEmail(
        apiKey, clientEmail,
        ACK.subject[lang] ?? ACK.subject.en,
        clientAckHtml(lang, refName),
      )
    }

    return new Response(JSON.stringify({ adminOk, clientOk }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
