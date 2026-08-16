// Supabase Edge Function — keep the Brevo API key alive.
//
// A Brevo API key deactivates after 90 days with no call. The only thing that
// calls Brevo today is `notify-enquiry`, on every form enquiry — fine while
// the season is busy, silent during the April→August lull. This function is
// the parade: called monthly by pg_cron, it makes ONE cheap read-only call
// (GET /v3/account) so the counter resets. Nothing is sent, nothing is read
// back and stored — the only point is "an API call happened".
//
// WHY A SEPARATE FUNCTION rather than a flag on notify-enquiry: this one is
// driven by a cron schedule, not a row insert, and has nothing to do with
// enquiries — bundling them would mean a keepalive failure showing up in the
// enquiry email path, or vice versa.
//
// WHY THE KEY STAYS HERE, NOT CALLED FROM SQL DIRECTLY: `pg_net` can POST
// anywhere, but the API key must live in exactly one place (Edge Function
// secrets, never in a migration file or in Postgres). The cron job calls this
// function; this function is the only thing that ever touches BREVO_API_KEY.
//
// Deploy : supabase functions deploy brevo-ping --no-verify-jwt
// Secrets: BREVO_PING_SECRET (to create, one value per project — its own
//          secret, not NOTIFY_ENQUIRY_SECRET or NOTIFY_SECRET: see those
//          migrations for why one secret per consumer). BREVO_API_KEY already
//          exists on PROD; absent on TEST by design (see ENQUIRIES.md).
// Trigger: see supabase/migrations/2026-08-16_brevo_keepalive_ping.sql

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  // Its own secret — fail CLOSED, same rule as notify-enquiry: a missing
  // secret refuses every call rather than leaving an open endpoint that lets
  // anyone spend our Brevo quota.
  const secret = Deno.env.get('BREVO_PING_SECRET')
  if (!secret) console.error('BREVO_PING_SECRET is not set — refusing all calls')
  if (!secret || req.headers.get('x-notify-secret') !== secret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    })
  }

  const key = Deno.env.get('BREVO_API_KEY')
  // Not configured (TEST, by design) is not an error — same convention as
  // pushToBrevo in notify-enquiry: nothing to keep alive, nothing to report.
  if (!key) {
    return new Response(JSON.stringify({ skipped: true, reason: 'BREVO_API_KEY not set' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const res = await fetch('https://api.brevo.com/v3/account', {
      headers: { 'api-key': key, accept: 'application/json' },
    })
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300)
      console.error(`Brevo keepalive refused: ${res.status} ${detail}`)
      return new Response(JSON.stringify({ ok: false, status: res.status }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      })
    }
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('Brevo keepalive unreachable:', e)
    // 200 on purpose: a cron job retried on the same schedule next month is
    // enough. This is a background chore, never something a user is waiting on.
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })
  }
})
