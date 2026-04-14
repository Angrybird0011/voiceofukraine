// ============================================================
// Supabase Edge Function: send-sms-otp
// Deploy: supabase functions deploy send-sms-otp
//
// FREE SMS OPTIONS:
//   1. Textbelt (textbelt.com) — 1 free SMS/day per IP
//      No account needed, just use key: "textbelt"
//   2. Twilio — Free trial gives $15 credit (~1000 SMS)
//      Get credentials at twilio.com
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Choose your SMS provider:
// 'textbelt' for free (1/day), 'twilio' for paid/trial
const SMS_PROVIDER = Deno.env.get('SMS_PROVIDER') || 'textbelt';
const TWILIO_SID   = Deno.env.get('TWILIO_ACCOUNT_SID') || '';
const TWILIO_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN') || '';
const TWILIO_FROM  = Deno.env.get('TWILIO_PHONE') || '';

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendViaTwilio(phone: string, message: string): Promise<boolean> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`;
  const body = new URLSearchParams({ To: phone, From: TWILIO_FROM, Body: message });
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });
  return res.ok;
}

async function sendViaTextbelt(phone: string, message: string): Promise<boolean> {
  const res = await fetch('https://textbelt.com/text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, message, key: 'textbelt' })
  });
  const data = await res.json();
  return data.success === true;
}

Deno.serve(async (req) => {
  // CORS
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
    const { phone } = await req.json();
    if (!phone) throw new Error('Phone number required');

    // Clean phone number
    const cleanPhone = phone.replace(/\s+/g, '').replace(/[^+\d]/g, '');

    // Generate OTP
    const otp = generateOtp();

    // Store in database
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);
    await supabase.from('sms_otps').insert({
      phone: cleanPhone,
      code: otp,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
    });

    // Send SMS
    const message = `Your Voice of Ukraine verification code: ${otp}. Valid for 10 minutes. 🇺🇦`;
    let sent = false;

    if (SMS_PROVIDER === 'twilio') {
      sent = await sendViaTwilio(cleanPhone, message);
    } else {
      sent = await sendViaTextbelt(cleanPhone, message);
    }

    if (!sent) {
      // Log but don't fail — let user know to check
      console.error('SMS send failed for', cleanPhone);
    }

    return new Response(JSON.stringify({ success: true, sent }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
});
