# 🇺🇦 Voice of Ukraine · Голос України

**Independent bilingual journalism supporting Ukraine — English & Ukrainian**

[![Deploy to GitHub Pages](https://github.com/YOUR_USERNAME/voiceofukraine/actions/workflows/deploy.yml/badge.svg)](https://github.com/YOUR_USERNAME/voiceofukraine/actions/workflows/deploy.yml)

Live site: **[voiceofukraine.org](https://voiceofukraine.org)**

---

## Stack
- **Frontend**: Pure HTML/CSS/JS — no framework, blazing fast
- **Backend**: [Supabase](https://supabase.com) — Auth, PostgreSQL, Edge Functions
- **Hosting**: GitHub Pages (free)
- **Articles**: Markdown files in `frontend/articles/`

## Features
- 🔒 Email OTP verification (Supabase Auth)
- 📱 Optional SMS/WhatsApp OTP (Textbelt free or Twilio)
- 📍 GPS + IP geolocation collection
- 🌍 Full EN ↔ UA language toggle
- 🛡️ Admin panel with full user table, search, CSV export
- 📝 Article system — drop a `.md` file, it auto-appears on site
- 📰 Blur gate — 3 lines visible, rest blurred until signup

## Quick Start

See **[docs/DOCUMENTATION.md](docs/DOCUMENTATION.md)** for the full setup guide.

```bash
# 1. Clone repo
git clone https://github.com/YOUR_USERNAME/voiceofukraine.git

# 2. Edit frontend/js/app.js — add your Supabase keys
# 3. Push to GitHub — auto-deploys via GitHub Actions
git push origin main
```

## Adding an Article

1. Create `frontend/articles/my-article.md` with frontmatter (see docs)
2. Add filename to `ARTICLE_INDEX` in `frontend/js/articles.js`
3. `git push` → live in 2 minutes

## Admin Panel

Visit `/admin.html` → login with Supabase admin credentials.
Displays: name, email, phone, GPS, IP, location, user agent, join date.

---

*Слава Україні! 🇺🇦*
