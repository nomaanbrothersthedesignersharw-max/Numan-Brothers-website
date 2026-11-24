# Nomaan Brothers — Production Launch Readiness Checklist (Phase 5 #33–34)

All 5 phases of codebase, SQL migration, CI/CD, and accessibility hardening are complete on `main`. Before public marketing launch, complete the owner-level verification items below.

---

## 1. Supabase Production SQL & Auth Settings
- [ ] Run pending SQL migrations in **Supabase SQL Editor** (if not yet applied):
  - `supabase/migrations/20261125000000_restore_review_moderation.sql`
  - `supabase/migrations/20261125010000_phase2_scale_videos_and_indexes.sql`
  - `supabase/migrations/20261125030000_phase4_audit_and_atomic_publish.sql`
- [ ] Enable **Leaked Password Protection** in **Supabase Dashboard → Authentication → Providers → Email / Security**.
- [ ] Create a dedicated **Staging Supabase project** and assign its URL + publishable key to Vercel **Preview** environment variables.

## 2. GitHub & Vercel Production Configuration
- [ ] Confirm `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are set in **Vercel → Settings → Environment Variables** (Production & Preview).
- [ ] Configure GitHub `main` branch protection ruleset (see `docs/INFRASTRUCTURE_HARDENING.md`).
- [ ] Attach branded production domain in Vercel Domains and set `SITE_CANONICAL_URL` + GitHub Actions `PROD_BASE_URL` variable.
- [ ] Optional: connect Axiom or Better Stack Vercel Log Drain and set `SUPABASE_DB_URL` secret for weekly automated backups.

## 3. Showroom Legal & Business Content (`/studio`)
- [ ] Open `/studio` → **Website CMS → Legal Policies** and publish approved:
  - Privacy Policy
  - Terms & Conditions
  - Returns, Alterations & Exchanges Policy
- [ ] Confirm showroom phone, WhatsApp number, Mandi Bazar Warangal address, hours, and official Instagram HTTPS profile URL.

## 4. Real-Device QA Sign-Off
- [ ] **Android Chrome:** Browse Men's & Kids' collections, swipe product gallery, tap zoom lightbox, test WhatsApp enquiry button, submit a photo review (confirm it holds as pending until approved in Studio).
- [ ] **iPhone Safari:** Verify zero horizontal overflow, sticky CTA clearance above home indicator, video playback, and review photo upload from iOS Photos.
- [ ] **Desktop (Chrome / Safari / Edge):** Verify keyboard `Escape` / arrow navigation in product zoom lightbox, `/studio` login, resilient draft recovery banner, CSV export, and permanent media/product delete.
