-- ============================================================
-- VOICE OF UKRAINE — SUPABASE DATABASE SCHEMA
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. PROFILES TABLE
-- Stores all user data collected at signup
CREATE TABLE IF NOT EXISTS public.profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name       TEXT,
  email           TEXT UNIQUE,
  phone           TEXT,
  phone_verified  BOOLEAN DEFAULT FALSE,
  country         TEXT,
  city            TEXT,
  lat             NUMERIC(9,5),
  lon             NUMERIC(9,5),
  ip_address      TEXT,
  ip_city         TEXT,
  ip_country      TEXT,
  ip_isp          TEXT,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 2. INDEX for fast lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email   ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_country ON public.profiles(country);
CREATE INDEX IF NOT EXISTS idx_profiles_created ON public.profiles(created_at DESC);

-- 3. ROW LEVEL SECURITY
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read and update their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Users can insert their own profile (during signup)
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Admins can view ALL profiles (uses service role key)
-- This is handled via the service_role key in the backend,
-- which bypasses RLS automatically.

-- 4. SMS OTP TABLE (temporary codes)
CREATE TABLE IF NOT EXISTS public.sms_otps (
  id          SERIAL PRIMARY KEY,
  phone       TEXT NOT NULL,
  code        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  expires_at  TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '10 minutes'),
  verified    BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_sms_otps_phone ON public.sms_otps(phone);

-- Auto-delete expired OTPs
CREATE OR REPLACE FUNCTION delete_expired_otps()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM public.sms_otps WHERE expires_at < NOW();
END;
$$;

-- 5. CONTACT MESSAGES TABLE
CREATE TABLE IF NOT EXISTS public.contact_messages (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  subject     TEXT,
  message     TEXT NOT NULL,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  read        BOOLEAN DEFAULT FALSE
);

-- 6. ARTICLE READS TABLE (track which articles users read)
CREATE TABLE IF NOT EXISTS public.article_reads (
  id          SERIAL PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  article     TEXT NOT NULL,
  read_at     TIMESTAMPTZ DEFAULT NOW()
);

-- 7. TRIGGER: update profiles.updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- AFTER RUNNING THIS SCHEMA:
-- 1. Go to Supabase → Authentication → Email Templates
--    Customise the "Magic Link" template with your branding
-- 2. Go to Authentication → URL Configuration
--    Set Site URL to: https://YOUR_GITHUB_USERNAME.github.io/voiceofukraine
--    Add Redirect URLs: https://YOUR_GITHUB_USERNAME.github.io/voiceofukraine/login.html
-- 3. Go to Authentication → Providers → Email
--    Enable: "Enable email confirmations" — OFF (we use OTP only)
-- ============================================================
