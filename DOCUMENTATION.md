# 🇺🇦 Voice of Ukraine — Complete Project Documentation

**Version:** 2.0 | **Last Updated:** April 2025
**Stack:** Static HTML/CSS/JS + Supabase (Auth, DB, Edge Functions) + GitHub Pages

---

## Table of Contents
1. [Project Overview](#1-project-overview)
2. [File Structure](#2-file-structure)
3. [Step-by-Step Setup](#3-step-by-step-setup)
4. [Supabase Backend Setup](#4-supabase-backend-setup)
5. [Free SMS OTP Setup](#5-free-sms-otp-setup)
6. [GitHub Pages Deployment](#6-github-pages-deployment)
7. [Domain & Email Setup](#7-domain--email-setup)
8. [Admin Panel Guide](#8-admin-panel-guide)
9. [Adding New Articles](#9-adding-new-articles)
10. [OTP Email System](#10-otp-email-system)
11. [User Data Collected](#11-user-data-collected)
12. [Security & Privacy](#12-security--privacy)
13. [Troubleshooting](#13-troubleshooting)
14. [Cost Summary (Free Tiers)](#14-cost-summary-free-tiers)

---

## 1. Project Overview

**Voice of Ukraine** is a bilingual (EN/UA) blog-style website where:
- Public visitors see article previews (3–4 lines) with a blur gate
- Free account creation (email OTP verified) unlocks full content
- Optional phone/SMS OTP collection (marked as optional in signup)
- GPS location, IP address, country, city collected at signup
- Admin panel at `/admin.html` shows all user data
- Articles are plain `.md` files — drop a file in, it auto-appears

### Key Technologies
| Layer | Technology | Cost |
|-------|-----------|------|
| Frontend hosting | GitHub Pages | **Free** |
| Database + Auth | Supabase | **Free** (500MB, 50K users) |
| Email OTP | Supabase Auth (built-in) | **Free** |
| SMS OTP | Textbelt / Twilio trial | **Free/Trial** |
| Contact form | Formspree | **Free** (50 submissions/month) |
| IP geolocation | ipapi.is | **Free** (1000 req/day) |
| CDN fonts | Google Fonts | **Free** |

---

## 2. File Structure

```
voiceofukraine/                    ← GitHub repository root
│
├── .github/
│   └── workflows/
│       └── deploy.yml             ← Auto-deploys frontend/ to GitHub Pages
│
├── frontend/                      ← Everything served to the public
│   ├── index.html                 ← Homepage with article grid
│   ├── signup.html                ← 4-step registration + OTP
│   ├── login.html                 ← Magic link / OTP login
│   ├── article.html               ← Single article reader
│   ├── about.html                 ← About page
│   ├── contact.html               ← Contact form
│   ├── admin.html                 ← Admin dashboard (password protected)
│   │
│   ├── css/
│   │   └── styles.css             ← All styles
│   │
│   ├── js/
│   │   ├── app.js                 ← Core JS: auth, language, nav, helpers
│   │   └── articles.js            ← Markdown loader + renderer
│   │
│   └── articles/                  ← ← YOUR ARTICLES GO HERE
│       ├── ukraine-sunrise-2027.md
│       ├── kharkiv-resilience.md
│       ├── culture-renaissance.md
│       ├── diaspora-warsaw.md
│       ├── solar-ukraine.md
│       ├── mariupol-architects.md
│       ├── medics-93rd.md
│       └── language-revival.md
│
├── backend/
│   ├── schema.sql                 ← Run once in Supabase SQL Editor
│   └── functions/
│       ├── send-sms-otp/index.ts  ← Edge Function: send SMS OTP
│       └── verify-sms-otp/index.ts← Edge Function: verify SMS OTP
│
└── docs/
    └── DOCUMENTATION.md           ← This file
```

---

## 3. Step-by-Step Setup

### Prerequisites
- GitHub account (free)
- Supabase account (free) — supabase.com
- Text editor (VS Code recommended)

### Step 1 — Create GitHub Repository

1. Go to **github.com** → click **New repository**
2. Name it: `voiceofukraine` (or any name)
3. Set to **Public** (required for free GitHub Pages)
4. Click **Create repository**
5. Upload all files maintaining the folder structure shown above

### Step 2 — Configure Supabase (see Section 4)

### Step 3 — Add Your Supabase Keys to app.js

Open `frontend/js/app.js` and replace:
```javascript
const SUPABASE_URL  = 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_ANON = 'YOUR_ANON_KEY';
```

With your actual values from Supabase → Project Settings → API.

### Step 4 — Enable GitHub Pages

1. Go to your repository → **Settings** → **Pages**
2. Source: **GitHub Actions**
3. The workflow in `.github/workflows/deploy.yml` will auto-deploy
4. Your site will be live at: `https://YOUR_USERNAME.github.io/voiceofukraine`

---

## 4. Supabase Backend Setup

### 4a. Create Supabase Project

1. Go to **supabase.com** → Sign Up (free)
2. Click **New Project**
3. Choose a name: `voiceofukraine`
4. Set a strong database password (save it!)
5. Choose region closest to your users (e.g., Frankfurt for Europe)
6. Wait ~2 minutes for project to initialise

### 4b. Run Database Schema

1. Go to **SQL Editor** → **New Query**
2. Copy the entire contents of `backend/schema.sql`
3. Paste and click **Run**
4. You should see: "Success. No rows returned."

### 4c. Get Your API Keys

Go to **Project Settings** → **API**:
- **Project URL** → copy to `SUPABASE_URL` in app.js
- **anon public** key → copy to `SUPABASE_ANON` in app.js
- **service_role** key → save securely (used for admin and edge functions ONLY)

⚠️ **Never put the service_role key in frontend code**

### 4d. Configure Email Auth (OTP)

1. Go to **Authentication** → **Providers** → **Email**
2. Enable: ✅ Enable Email provider
3. Disable: ☐ Confirm email (we use OTP magic link instead)
4. Go to **Authentication** → **Email Templates**
5. Edit the **Magic Link** template:

```html
Subject: Your Voice of Ukraine verification code

<h2>🇺🇦 Voice of Ukraine</h2>
<p>Your verification code is:</p>
<h1 style="letter-spacing:0.2em; color:#1a4d8f;">{{ .Token }}</h1>
<p>This code expires in 10 minutes.</p>
<p>If you didn't request this, ignore this email.</p>
<p><em>Слава Україні! 🇺🇦</em></p>
```

### 4e. Set Auth Redirect URLs

Go to **Authentication** → **URL Configuration**:
- **Site URL:** `https://YOUR_USERNAME.github.io/voiceofukraine`
- **Redirect URLs:** add `https://YOUR_USERNAME.github.io/voiceofukraine/login.html`

### 4f. Deploy Edge Functions (for SMS OTP)

Install Supabase CLI:
```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

Set environment variables:
```bash
supabase secrets set SMS_PROVIDER=textbelt
# OR for Twilio:
supabase secrets set SMS_PROVIDER=twilio
supabase secrets set TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxx
supabase secrets set TWILIO_AUTH_TOKEN=your_auth_token
supabase secrets set TWILIO_PHONE=+1xxxxxxxxxx
```

Deploy functions:
```bash
supabase functions deploy send-sms-otp
supabase functions deploy verify-sms-otp
```

### 4g. Set Admin User

1. Go to **Authentication** → **Users**
2. Click **Invite user** and enter your admin email
3. Set a strong password via the user menu → **Edit user**
4. In `frontend/admin.html`, update line:
   ```javascript
   const ADMIN_EMAIL = 'admin@voiceofukraine.org';
   ```
   Change to your actual admin email.

---

## 5. Free SMS OTP Setup

### Option A — Textbelt (Completely Free, No Account)
- **1 free SMS per IP per day**
- No setup required — works out of the box
- Good for: testing and low-volume use
- The default in our edge function (`key: 'textbelt'`)

### Option B — Twilio Trial (Best for Production)
1. Sign up at **twilio.com** (free)
2. Get free trial credit (~$15 = ~500-1000 SMS)
3. Go to Console → Get a phone number (free with trial)
4. Copy: Account SID, Auth Token, Phone Number
5. Set as Supabase secrets (see 4f above)
6. Set `SMS_PROVIDER=twilio` in secrets

### Option C — Fast2SMS (Free Indian numbers)
If your audience includes India:
1. Sign up at **fast2sms.com**
2. Get free API key
3. Modify `send-sms-otp/index.ts` to call Fast2SMS API

### Option D — WhatsApp OTP via WhatsApp Business API
For WhatsApp OTP (free tier available):
1. Sign up at **360dialog.com** or **Gupshup**
2. They offer free tier for verification messages
3. Add a WhatsApp-specific edge function

---

## 6. GitHub Pages Deployment

### Automatic Deployment (Recommended)

The `.github/workflows/deploy.yml` file handles this automatically:
- Every time you push to `main` branch → site updates in ~2 minutes
- Go to **Actions** tab in GitHub to monitor deployments

### Manual Upload (Alternative)

If you prefer not to use GitHub Actions:
1. Go to repo **Settings** → **Pages**
2. Source: **Deploy from a branch**
3. Branch: `main`, folder: `/frontend`
4. Save — site deploys in ~1 minute

### Custom Domain with GitHub Pages

1. Register domain (see Section 7)
2. In repo **Settings** → **Pages** → **Custom domain**
3. Enter: `voiceofukraine.org`
4. In your DNS provider, add:
   ```
   Type: A    Name: @    Value: 185.199.108.153
   Type: A    Name: @    Value: 185.199.109.153
   Type: A    Name: @    Value: 185.199.110.153
   Type: A    Name: @    Value: 185.199.111.153
   Type: CNAME Name: www Value: YOUR_USERNAME.github.io
   ```
5. GitHub auto-provisions HTTPS (Let's Encrypt)

---

## 7. Domain & Email Setup

### Recommended Domain Registrars
| Registrar | Price/yr | Notes |
|-----------|----------|-------|
| Cloudflare | ~$10 | Best value, no markup |
| Namecheap | ~$10–14 | Free WHOIS privacy |
| Porkbun | ~$8–12 | Cheapest options |

### Suggested Domain Names
- `voiceofukraine.org` ← recommended
- `holosukrainy.org`
- `ukrainevoices.net`
- `voiceua.org`

### Free Email Setup (Zoho Mail — 5 free accounts)

1. Go to **zoho.com/mail** → Business Email → Free plan
2. Enter your domain name
3. Verify domain ownership (add TXT record to DNS)
4. Add MX records to DNS:
   ```
   MX 10  mx.zoho.eu  (for European users)
   MX 20  mx2.zoho.eu
   MX 50  mx3.zoho.eu
   ```
5. Create these mailboxes:
   - `editor@voiceofukraine.org`
   - `press@voiceofukraine.org`
   - `tips@voiceofukraine.org`
   - `noreply@voiceofukraine.org`
   - `admin@voiceofukraine.org`

### Supabase Outgoing Email (SMTP)

For branded OTP emails (from `noreply@voiceofukraine.org`):
1. Go to **Project Settings** → **Auth** → **SMTP Settings**
2. Enable custom SMTP
3. Use Zoho SMTP:
   ```
   Host:     smtp.zoho.eu
   Port:     587
   Username: noreply@voiceofukraine.org
   Password: [your Zoho password]
   Sender:   Voice of Ukraine <noreply@voiceofukraine.org>
   ```

---

## 8. Admin Panel Guide

### Accessing the Admin Panel

Navigate to: `https://YOUR_SITE/admin.html`

Login with your admin Supabase credentials (email + password set in step 4g).

### What the Admin Panel Shows

For every registered user:
| Field | Description |
|-------|-------------|
| Full Name | Entered at signup |
| Email | Verified email address |
| Phone | Optional — if provided |
| SMS Verified | Whether phone was OTP-verified |
| Country | Selected from dropdown |
| City | Entered at signup |
| GPS Lat/Lon | Browser geolocation (if user allowed) |
| IP Address | Captured from ipapi.is at signup |
| IP City | Geolocation from IP |
| IP Country | Country from IP |
| ISP/Org | Internet provider from IP |
| User Agent | Browser/device string |
| Joined | Signup timestamp |

### Admin Features
- **Search** — filter by name, email, or any text field
- **Country filter** — dropdown to filter by country
- **View button** — full detail modal popup
- **Delete button** — permanently removes user (with confirmation)
- **Export CSV** — downloads all filtered users as a CSV file
- **Pagination** — 20 users per page

### Keeping the Admin Secure
- The admin page requires Supabase credentials to load any data
- Never share the URL publicly
- Use a strong admin password
- Consider adding `.htaccess` protection if using Apache hosting

---

## 9. Adding New Articles

This is the key workflow for content management. No CMS, no database — just files.

### Step 1 — Create a Markdown File

Create a new file in `frontend/articles/` with any name ending in `.md`:

```
frontend/articles/my-new-article.md
```

### Step 2 — Add Frontmatter (Required)

Every article must start with this header block:

```markdown
---
title: Your Article Title in English
title_uk: Назва статті українською
author: Author Full Name
author_initials: AB
author_color: #1a4d8f
author_role: Correspondent, City
date: 2025-04-01
category: frontlines
read_time: 7
emoji: 🪖
excerpt: One or two sentence summary in English shown in article cards.
excerpt_uk: Один або два речення українською для карток статей.
---
```

### Category Options
| Value | Label EN | Label UA |
|-------|----------|----------|
| `frontlines` | Front Lines | Передова |
| `culture` | Culture | Культура |
| `diaspora` | Diaspora | Діаспора |
| `rebuild` | Rebuilding | Відбудова |
| `future` | Predictions | Передбачення |

### Step 3 — Write Your Article Body

After the closing `---`, write your article in standard Markdown:

```markdown
Opening paragraph of your article here. This will be visible in the 
preview (unblurred) section.

Second paragraph. This will be slightly blurred in the preview.

## Section Heading

More content here, only visible to logged-in members.

> This is a blockquote — great for pull quotes.

## Another Section

Continue writing...
```

### Step 4 — Register the Article

Open `frontend/js/articles.js` and add your filename to the top of `ARTICLE_INDEX`:

```javascript
const ARTICLE_INDEX = [
  'my-new-article.md',       // ← Add here (newest first)
  'ukraine-sunrise-2027.md',
  'kharkiv-resilience.md',
  // ... rest of existing articles
];
```

### Step 5 — Publish

```bash
git add .
git commit -m "Add article: My New Article"
git push origin main
```

GitHub Actions will deploy automatically in ~2 minutes.

### Article Writing Tips
- **First paragraph**: Hook — make it vivid and human. It's the visible preview.
- **Second paragraph**: Bridge — partially visible, blurred. Make it tantalising.
- **Rest**: Full article for members only.
- Always write from a human perspective — real people, real quotes, real details.
- For `future` category: ground predictions in data and trends, not vague hope.
- Recommended length: 600–1500 words.

---

## 10. OTP Email System

### How It Works (Supabase Auth)

1. User enters email on signup → frontend calls `POST /auth/v1/otp`
2. Supabase generates a 6-digit token → sends via SMTP
3. User enters code → frontend calls `POST /auth/v1/verify`
4. On success: Supabase returns `access_token` + `refresh_token`
5. Frontend stores token in localStorage → user is logged in

### Email OTP Flow Diagram
```
User enters email
       ↓
POST /auth/v1/otp { email }
       ↓
Supabase sends email with 6-digit code
       ↓
User enters code in 6-box input
       ↓
POST /auth/v1/verify { email, token, type: 'magiclink' }
       ↓
Success → access_token returned → saveSession()
       ↓
User redirected to article / homepage
```

### SMS OTP Flow Diagram
```
User enters phone (optional step)
       ↓
POST /functions/v1/send-sms-otp { phone }
       ↓
Edge Function → generates 6-digit code → stores in sms_otps table
       ↓
Sends SMS via Textbelt or Twilio
       ↓
User enters SMS code
       ↓
POST /functions/v1/verify-sms-otp { phone, code }
       ↓
Edge Function checks sms_otps table → marks verified
       ↓
profile.phone_verified = true saved to DB
```

---

## 11. User Data Collected

### At Signup (Step 1)
- Full name
- Email address
- Country (dropdown)
- City (text field)
- Phone number (optional, checkbox)

### Email Verification (Step 2)
- Email verified ✅ (Supabase handles this)

### SMS Verification (optional)
- Phone number verified ✅

### Location (Step 3)
- GPS latitude and longitude (only if user clicks checkbox and allows browser)

### Automatic Collection (background, Step 4)
- IP address
- IP-based city
- IP-based country
- ISP/Organisation name
- Browser User Agent string
- Signup timestamp

All data is stored in the `profiles` table in Supabase and viewable in `admin.html`.

---

## 12. Security & Privacy

### What's Protected
- Admin panel requires Supabase login to access any data
- User profiles only readable by the user themselves (Row Level Security)
- Service role key (bypasses RLS) is NEVER in frontend code
- OTP codes expire after 10 minutes
- SMS OTP codes deleted after verification

### GDPR Considerations
If serving EU users, add a Privacy Policy page mentioning:
- Data collected: name, email, phone (optional), location (optional), IP
- Purpose: account verification and personalisation
- Retention: until account deleted
- User rights: right to access, correct, delete (via admin)
- Contact: editor@voiceofukraine.org

### Recommended Privacy Policy Page
Create `frontend/privacy.html` with above information and link in footer.

---

## 13. Troubleshooting

### "OTP not arriving in email"
1. Check Supabase → Authentication → Logs
2. Verify SMTP settings if using custom email
3. Check spam folder
4. Supabase free tier has rate limits: 3 OTP emails/hour per email

### "SMS not sending"
1. Textbelt free tier: 1 SMS per IP per day — use Twilio for more
2. Check Supabase → Edge Functions → Logs
3. Verify phone number includes country code (+44, +1, etc.)

### "Admin page shows no users"
1. Verify you're logged in with the admin Supabase account
2. Check your admin email matches `ADMIN_EMAIL` in admin.html
3. Check Supabase → Database → Table Editor → profiles table

### "Articles not loading"
1. Check browser console for 404 errors
2. Verify filename in `ARTICLE_INDEX` matches actual filename exactly
3. Check that frontmatter `---` blocks are correctly formatted

### "GitHub Pages 404"
1. Confirm GitHub Actions workflow ran successfully (Actions tab)
2. Check Settings → Pages → source is set to GitHub Actions
3. Make sure index.html is in the `frontend/` folder

### "Supabase CORS errors"
1. Go to Supabase → Project Settings → API → CORS
2. Add your GitHub Pages URL: `https://USERNAME.github.io`
3. Also add `http://localhost:8080` for local testing

---

## 14. Cost Summary (Free Tiers)

| Service | Free Tier | Limits | Upgrade Cost |
|---------|-----------|--------|-------------|
| **GitHub Pages** | ✅ Free | 1GB storage, 100GB bandwidth/month | N/A |
| **Supabase** | ✅ Free | 500MB DB, 50,000 users, 2 edge functions | $25/month |
| **Supabase Auth OTP** | ✅ Free | 3 OTPs/hour per email, 30/hour total | Included |
| **Textbelt SMS** | ✅ Free | 1 SMS/IP/day | $0.006/SMS |
| **Twilio SMS** | ✅ Trial ($15) | ~500–1000 SMS | ~$0.0075/SMS |
| **Zoho Mail** | ✅ Free | 5 accounts, 5GB each | $1/user/month |
| **Formspree** | ✅ Free | 50 contact submissions/month | $10/month |
| **ipapi.is** | ✅ Free | 1000 IP lookups/day | $9/month |
| **Google Fonts** | ✅ Free | Unlimited | N/A |
| **Domain** | ❌ Paid | — | ~$10–14/year |

**Total monthly cost for a new site: ~$0** (domain is ~$10/year = $0.83/month)

---

## Quick Start Checklist

- [ ] Create GitHub account and repository
- [ ] Upload all project files to repository
- [ ] Create Supabase project (free)
- [ ] Run `backend/schema.sql` in Supabase SQL Editor
- [ ] Copy Supabase URL + anon key into `js/app.js`
- [ ] Configure Auth redirect URLs in Supabase
- [ ] Set up Supabase SMTP for branded emails (optional)
- [ ] Enable GitHub Pages (Settings → Pages → GitHub Actions)
- [ ] Visit your live site at `https://USERNAME.github.io/REPO`
- [ ] Deploy SMS edge functions (`supabase functions deploy`)
- [ ] Set admin email in `admin.html`
- [ ] Register a domain and point to GitHub Pages (optional)
- [ ] Set up Zoho Mail for branded email addresses (optional)
- [ ] Test signup → OTP → article access flow end-to-end
- [ ] Test admin.html with your admin credentials
- [ ] Add first original article to `frontend/articles/`

---

*Слава Україні! 🇺🇦*
*Built with love for Ukraine's story.*
