// Supabase Edge Function — notify on a new enquiry (the light website form).
//
// Triggered by a pg_net TRIGGER on `enquiries` INSERT, server-side, so it fires
// even if the visitor closes the tab and cannot be called by anon.
//
// Sends up to 2 emails via Resend (no email_logs entry — these are
// notifications, not the official documents tracked there):
//   1. ADMIN  → contact@bilenekite.com : who wrote, and what they wrote
//   2. VISITOR → enquiry.email          : trilingual acknowledgment (FR/EN/ES)
//
// WHY A SEPARATE FUNCTION rather than a branch inside notify-submission:
// that one carries the wording of the booking-form emails, which is gui's own
// text and his decision to keep hardcoded. Adding a branch there would mean
// redeploying a function that works today, and editing a file whose copy is not
// mine to touch. This one can be deployed, broken and fixed on its own.
//
// Deploy : supabase functions deploy notify-enquiry --no-verify-jwt
// Secrets: RESEND_API_KEY (already there) + NOTIFY_ENQUIRY_SECRET (to create,
//          one value per project — see the migration for why it is not the
//          NOTIFY_SECRET that notify-submission uses).
// Trigger: see supabase/migrations/2026-08-14c_enquiry_notify_trigger.sql

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-notify-secret',
}

const FROM = 'BKC <no-reply@bilenekite.com>'
const ADMIN_EMAIL = 'contact@bilenekite.com'

type Lang = 'fr' | 'en' | 'es'
type Tr = Record<Lang, string>

const ACK: Record<string, Tr> = {
  subject: {
    fr: 'Bilene Kite Center : votre message est bien arrivé 🌊',
    en: 'Bilene Kite Center: we got your message 🌊',
    es: 'Bilene Kite Center: hemos recibido tu mensaje 🌊',
  },
  heading: {
    fr: 'Merci de nous avoir écrit !',
    en: 'Thanks for getting in touch!',
    es: '¡Gracias por escribirnos!',
  },
  body: {
    fr: 'Nous avons bien reçu votre message et nous vous répondons très vite, personnellement. Bon vent et à bientôt ! 🌊',
    en: 'We have your message and will come back to you very soon, personally. Fair winds and see you soon! 🌊',
    es: 'Hemos recibido tu mensaje y te responderemos muy pronto, personalmente. ¡Buen viento y hasta pronto! 🌊',
  },
  signoff: {
    fr: "L'équipe Bilene Kite Center",
    en: 'The Bilene Kite Center team',
    es: 'El equipo de Bilene Kite Center',
  },
}

function esc(v: unknown): string {
  return String(v ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c
  ))
}

function ackHtml(lang: Lang, name: string): string {
  const t = (x: Tr) => x[lang] ?? x.en
  return `<!DOCTYPE html><html><body style="margin:0;background:#f0f9ff;font-family:Segoe UI,Arial,sans-serif;color:#0f172a">
    <div style="max-width:560px;margin:0 auto;padding:32px 24px">
      <div style="background:#ffffff;border-radius:16px;padding:32px;box-shadow:0 2px 12px rgba(2,132,199,.08)">
        <div style="font-size:28px">🌊🪁</div>
        <h1 style="font-size:20px;margin:16px 0 8px">${esc(t(ACK.heading))}</h1>
        <p style="margin:0 0 8px;color:#334155">${esc(name) ? `${esc(name)},` : ''}</p>
        <p style="margin:0 0 24px;line-height:1.6;color:#334155">${esc(t(ACK.body))}</p>
        <p style="margin:0;color:#0284c7;font-weight:600">${esc(t(ACK.signoff))}</p>
      </div>
      <p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:16px">Bilene Kite Center · Mozambique</p>
    </div></body></html>`
}

function adminHtml(r: Record<string, unknown>, sourceLabel: string): string {
  const row = (label: string, val: unknown) =>
    val != null && val !== ''
      ? `<tr><td style="padding:4px 12px 4px 0;color:#64748b;white-space:nowrap">${esc(label)}</td>`
        + `<td style="padding:4px 0;font-weight:600">${esc(val)}</td></tr>`
      : ''

  // The message is the whole point of this email: it is where the party size,
  // the dates and the wishes actually are. Shown in full, not truncated.
  const message = esc(r.message).replace(/\n/g, '<br>')

  return `<!DOCTYPE html><html><body style="margin:0;background:#f8fafc;font-family:Segoe UI,Arial,sans-serif;color:#0f172a">`
    + `<div style="max-width:620px;margin:0 auto;padding:32px 24px">`
    + `<div style="background:#ffffff;border-radius:16px;padding:32px;box-shadow:0 2px 12px rgba(15,23,42,.06)">`
    + `<h1 style="font-size:20px;margin:0 0 4px">📣 New enquiry</h1>`
    + `<p style="margin:0 0 24px;color:#64748b">Qualify it in the <strong>Enquiries</strong> tab.</p>`
    + `<table style="font-size:14px;border-collapse:collapse;margin-bottom:20px">`
    + row('Name', r.name)
    + row('Email', r.email)
    + row('Phone', r.phone)
    + row('Language', r.language)
    + row('Found us via', sourceLabel || r.source_other)
    + `</table>`
    + (message
        ? `<h2 style="font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8;margin:0 0 8px">Their message</h2>`
          + `<div style="font-size:14px;line-height:1.6;background:#f8fafc;border-radius:10px;padding:16px">${message}</div>`
        : `<p style="color:#94a3b8;font-size:14px">No message.</p>`)
    + `</div></div></body></html>`
}

async function sendEmail(apiKey: string, to: string, subject: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  })
  if (!res.ok) {
    console.error(`Resend failed for ${to}: ${await res.text()}`)
    return false
  }
  return true
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  // Its OWN secret, deliberately not the NOTIFY_SECRET that notify-submission
  // uses. Supabase secrets cannot be read back once set — only a digest is
  // shown — so reusing that one would have meant overwriting a value the
  // booking-form trigger still carries hardcoded, repairing the enquiry emails
  // by breaking the ones that work.
  //
  // Fail CLOSED: a missing secret refuses every call rather than turning this
  // into an open relay. Same rule as notify-submission since the 2026-07-28 fix.
  const secret = Deno.env.get('NOTIFY_ENQUIRY_SECRET')
  if (!secret) console.error('NOTIFY_ENQUIRY_SECRET is not set — refusing all calls')
  if (!secret || req.headers.get('x-notify-secret') !== secret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  try {
    const apiKey = Deno.env.get('RESEND_API_KEY')
    if (!apiKey) throw new Error('RESEND_API_KEY not set')

    const body = await req.json()
    const record = (body.record ?? body) as Record<string, unknown>
    const lang = (['fr', 'en', 'es'].includes(String(record.language)) ? record.language : 'en') as Lang

    // The trigger passes the source label along; without it the admin email
    // would show a UUID, which tells nobody anything.
    const sourceLabel = String(body.source_label ?? '')

    const adminOk = await sendEmail(
      apiKey, ADMIN_EMAIL,
      `📣 Enquiry — ${String(record.name ?? 'someone')}`,
      adminHtml(record, sourceLabel),
    )

    let clientOk: boolean | null = null
    const visitorEmail = String(record.email ?? '').trim()
    if (visitorEmail) {
      clientOk = await sendEmail(
        apiKey, visitorEmail,
        ACK.subject[lang] ?? ACK.subject.en,
        ackHtml(lang, String(record.name ?? '')),
      )
    }

    return new Response(JSON.stringify({ adminOk, clientOk }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('notify-enquiry failed:', e)
    // 200 on purpose: the enquiry is already saved, and a retrying trigger
    // would send the same email again. A failure here is a missing email, and
    // it belongs in the logs — never in the visitor's experience.
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
