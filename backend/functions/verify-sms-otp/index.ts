// ============================================================
// Supabase Edge Function: verify-sms-otp
// Deploy: supabase functions deploy verify-sms-otp
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });
  }

  try {
    const { phone, code } = await req.json();
    if (!phone || !code) throw new Error('Phone and code required');

    const cleanPhone = phone.replace(/\s+/g, '').replace(/[^+\d]/g, '');
    const supabase   = createClient(SUPABASE_URL, SUPABASE_SERVICE);

    // Look up the most recent unexpired, unverified OTP for this phone
    const { data, error } = await supabase
      .from('sms_otps')
      .select('id, code, expires_at, verified')
      .eq('phone', cleanPhone)
      .eq('verified', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) throw new Error('No valid OTP found. Please request a new code.');
    if (data.code !== code.trim()) throw new Error('Incorrect code. Please try again.');

    // Mark as verified
    await supabase.from('sms_otps').update({ verified: true }).eq('id', data.id);

    return new Response(JSON.stringify({ valid: true }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ valid: false, error: e.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
});
