# Noman Brothers — Production Readiness Audit (9 November 2026)

## Scope and source of truth
- GitHub: `helloalifstudio-coder/Numan-Brothers-website`, production branch `main`.
- Two Vercel production projects deliberately deploy the same `main` SHA.
- Connected Supabase project inspected: `zazdxmukmcayblsteulk` (Mumbai region).
- The separate Supabase project described as owned by another Gmail account is **not connected to this inspection**; never infer it has the same schema, media, Auth roles or migrations.
- Existing portfolio project is a **read-only browse-and-enquire showroom** with staff CMS; not a payment gateway, stock ledger, POS or ERP.

## What was verified from live services
- Before this hardening change: GitHub had one branch, last Actions CI succeeded, and both Vercel production builds were READY on the same commit.
- Connected Supabase project status ACTIVE_HEALTHY, PostgreSQL 17, 15 Noman application tables, 41 app-table RLS policies, no app tables missing RLS, 3 configured media buckets and an ACTIVE JWT-verified `nb-media-approval` Edge Function.
- Live counts at inspection: 0 products, 0 media assets, 0 import jobs, 0 saved product drafts, 1 homepage public record, 1 review and 1 staff account assigned `admin` metadata. Counts can change after inspection.
- The currently published homepage did not contain a configured Instagram profile. Do not guess an Instagram handle.
- Published homepage contact/WhatsApp details are configured, but the hero photo, intro video, three legal policy texts and Instagram profile are empty as of inspection.
- The two Vercel projects have the public Supabase URL and an encrypted publishable key; neither had `SITE_CANONICAL_URL` configured at inspection, so do not claim the site is approved for search indexing. A real client-approved canonical domain and legal/content sign-off are prerequisites.

## Improvements introduced in this change
1. Forward-only database migration `20261109190000_media_lifecycle_scale_indexes.sql`: protect archive, revocation and deletion when files are referenced from products, categories, approved pages or saved drafts, including homepage featured cards and section videos.
2. Import-history FK uses `ON DELETE SET NULL`, preserving import audit rows when a genuinely unused media object is deleted.
3. Cover eight foreign-key columns recommended by Supabase Performance Advisor, and drop exactly one confirmed duplicate index (retain `nb_product_drafts_changed_idx`).
4. Tighten the Edge Function's own preflight to include `featuredImages` and prevent revoking media still referenced by saved homepage drafts.
5. Extend SQL Editor fresh install to all 15 migrations, update existing-table setup with covering indexes, and add PostgreSQL regression tests.
6. The fresh SQL Editor installer is for a **new empty** client account; the existing-table installer is for a pre-initialized account. They are not interchangeable, and applying SQL via the Editor does not automatically populate CLI migration history.

## Items NOT proved just by CI (release blockers)
- Owner-supplied real garment inventory, approved photographs/videos, Instagram account and legal policy texts are absent or not fully confirmed.
- Authentic owner/admin/editor sign-in, role changes and revocation, upload/retry, media copy/delete, publish/restore and import of 10,000 real members/products/media have not been exercised under a live staff session.
- Database changes and the Edge Function must be deployed and checked in each **specific** Supabase account. Do not assume the other Gmail's project is configured.
- Storage and database writes are different services; an Edge Function cannot make them atomically transactional. Keep periodic reconciliation/backups and test failure recovery before heavy production use.
- 10,000+ records performance targets require measured database load testing and monitoring on representative data, not only static index checks.
- Security Advisor reports `pg_trgm` installed in `public` and Auth leaked-password protection disabled; owner should review in Supabase Dashboard. Moving installed extensions can affect dependent indexes, and changing Auth project settings needs authorized dashboard/admin access.
- Performance Advisor also reports multiple permissive RLS policies. Review before combining policies, since a careless consolidation can change authorization semantics.
- Vercel Web Analytics frontend code is present; confirm Vercel project analytics is enabled to see visits.
- Confirm backup/restore procedure and owner acceptance. See `docs/RELEASE_ACCEPTANCE.md`.

## Safe acceptance sequence
1. Merge only after GitHub PostgreSQL, TypeScript, Bun tests, browser viewport and live route checks succeed.
2. Apply the new migration **only to the verified intended** Supabase project using `supabase db push` or the managed migration tool; verify metadata, indexes and triggers after apply.
3. Deploy the matching `nb-media-approval` Edge Function and verify JWT enforcement in the project.
4. As a legitimate authorized owner/admin, upload a permitted photo, publish product/home, attempt to revoke/delete an in-use asset (must fail), detach then retry, restore, import CSV, review customer feedback, and inspect customer pages.
5. Validate both Vercel deployments cite the same source SHA and all configured project environment variables point at the intended account.
6. On representative data test pagination/search, upload latency and media egress, back up the database, and get showroom owner approval.
