// Supabase Edge Function — proxy Resend API + log to email_logs
// Deploy: supabase functions deploy send-email
// Secret:  supabase secrets set RESEND_API_KEY=re_xxxxx

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const FROM = 'BKC <no-reply@bilenekite.com>'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { booking_id, type, to, subject, html } = await req.json()

    if (!booking_id || !type || !to || !subject || !html) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Create log entry (status=sent optimistically, updated to failed on error)
    const { data: log, error: logErr } = await supabase
      .from('email_logs')
      .insert({
        booking_id,
        type,
        status: 'sent',
        recipient_email: to,
        sent_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (logErr) throw new Error(`DB insert failed: ${logErr.message}`)

    // Call Resend
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM, to: [to], subject, html }),
    })

    const resendData = await resendRes.json()

    if (!resendRes.ok) {
      // Mark as failed
      await supabase
        .from('email_logs')
        .update({ status: 'failed', error: JSON.stringify(resendData) })
        .eq('id', log.id)

      return new Response(JSON.stringify({ error: resendData }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({ log_id: log.id, resend_id: resendData.id }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
