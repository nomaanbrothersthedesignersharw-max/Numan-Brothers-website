# Nomaan Brothers — Production storefront and CMS

A mobile-first, browse-and-enquire catalogue for the traditional menswear and kidswear showroom in Mandi Bazar, Warangal. Built by Alif Growth Media. **The only permanent source branch is `main`.**

## Live operations snapshot — 11 November 2026

This section records verified service state, not a promise that every commercial launch gate is complete.

| Area | Verified state |
|---|---|
| GitHub | `nomaanbrothersthedesignersharw-max/Numan-Brothers-website`; one branch (`main`); 11 merged PRs; no open PRs |
| Latest source | `4bcfa4b628f1299def1bdf8dfbdb81c9a3a7dfe4` |
| GitHub Actions | Website quality workflow and CodeQL passed on the latest source; local browser smoke passed 101/101 checks across the responsive matrix and live production smoke passed 15/15 checks |
| Supabase Preview check | Still fails against the old project ref `xiidzpsyuvfhyjudrrfq`; see the migration note below |
| Vercel | One Vite project, `numan-brothers-website`; latest Production deployment is READY on the latest source SHA |
| Public host | https://numan-brothers-website-nine.vercel.app/ |
| Studio | Same project at `/studio`; no separate CMS deployment |
| Runtime | Node 22.x; Production is public; Preview protection is separate |
| Database | Supabase `uinhybkdzevpxnugtvzf`, US East, PostgreSQL 17.11; project status ACTIVE_HEALTHY |
| Schema | 15 public application tables, all with RLS enabled; 40 public policies; three media buckets |
| Migration ledger | 21 repository migration versions now appear in the selected project's migration history |
| Edge Function | `nb-media-approval` is ACTIVE (version 3) with JWT verification enabled; its deployed source matches GitHub |
| Live records | 1 published product, 13 product drafts, 2 media metadata records, 4 Storage objects, 23 categories and 0 customer reviews at last count |
| Staff identity | 2 confirmed Auth users; 1 has the owner role |
| Plans | Vercel Hobby; Supabase Free |
| Domain / SEO | Only the Vercel-provided production domain is attached. Search indexing remains deliberately blocked until the business-owned canonical domain is confirmed. |

### Supabase migration and GitHub integration note

The chosen production database is `uinhybkdzevpxnugtvzf`. A read-only schema audit verified the expected catalogue tables, RLS, policies, functions, triggers, Storage buckets and required search indexes before the migration ledger was reconciled. Five pre-existing migration records were matched exactly to their SQL source; 16 earlier migrations were recorded as already represented in the live schema. **No historical migration SQL or fresh-project installer was replayed against production.**

The GitHub Supabase Preview check is still linked to the old, inaccessible project `xiidzpsyuvfhyjudrrfq` and reports a duplicate `nb_categories_public_select` policy. This is an external Supabase GitHub integration connection problem; it is not evidence that the selected `uinhy...` database is missing those migrations. Reconnect the GitHub integration from the selected Supabase project's **Project Settings → Integrations**, choose this repository and set the working directory to `.`. Confirm the resulting check links to `uinhybkdzevpxnugtvzf` before relying on it. Supabase GitHub integration configuration is documented at https://supabase.com/docs/guides/deployment/branching/github-integration.

### Current release blockers

- GitHub reports `main` as unprotected. Enable a ruleset/branch protection requiring the quality workflow and CodeQL, with force pushes disabled.
- Supabase Auth leaked-password protection is disabled. Supabase documents this as a Pro-plan feature; the current Free plan cannot enable it without an owner-approved upgrade.
- Vercel Hobby is restricted to personal/non-commercial use by Vercel's current plan terms; this is a commercial showroom, so owner approval to move to a commercial-eligible Pro/Enterprise plan is required before commercial launch. Supabase is Free; confirm backup, inactivity-pause and compute/traffic requirements before deciding on an upgrade.
- No business-owned custom domain is attached. The current `robots.txt` blocks crawling, prerendered pages use `noindex`, and `/sitemap.xml` and `/sitemap-static.xml` return 503 until an approved canonical origin is configured.
- The deployed media approval function (ACTIVE v3, JWT required) has not yet been exercised end-to-end with real owner/admin accounts. Live `/api/cms-status` checks pass for Auth health, public catalogue reads and anonymous denial of private drafts/media/revisions; these do not replace staff-session lifecycle tests. Test approve, revoke, archive, restore, delete, stale role and referenced-asset rejection before relying on it operationally.
- Supabase Free does not provide managed database backups and may pause low-activity projects; arrange encrypted off-site database exports and separate Storage-object backups, then prove a restore. Database and Storage backup/restore rehearsal, 10k-product/100k-media staging scale tests, Lighthouse/accessibility testing, and authenticated security testing remain outstanding.
- Owner-supplied product photography, exact contact/social details, business domain, and approved Privacy, Terms and Returns text must be supplied before public launch.

The site is a **read-only browse-and-enquire showroom**, not a payment gateway, stock ledger, POS or ERP. Do not publish invented products, contact details, reviews, legal policies or social URLs.

## Features

- Responsive Men’s Wear, Kids Wear and category routes; per-product pages with SKU, gallery and WhatsApp catalogue sharing.
- Five-second cinematic hero opener, left-slide reveal, skip/replay and reduced-motion/data-saver alternatives.
- Footer and contact pages display a single locally bundled Instagram icon. Only an owner-supplied valid HTTPS Instagram profile published in Studio activates the link; otherwise the icon stays disabled.
- Public legal-policy pages edited through Studio; empty policies clearly indicate pending owner approval.
- First-party customer reviews held pending until an authorized staff member moderates them.
- CMS for editable published garments, permanent server-generated SKU identities, Men/Kids category media, photo auto-labeling, bulk CSV import, owner approval, homepage text and revision history.
- Read-only storefront access to published records; restricted Supabase row-level and Storage policies.
- GitHub Actions typecheck, Bun tests, PostgreSQL permission checks, production build, 18-viewport Chromium smoke checks and a live production HTTP/CMS-readiness smoke. CodeQL and Dependabot are configured on `main`.

## Local development

Use Bun 1.4.0 (see `bun.lock`) and Node 22.

```bash
bun install --frozen-lockfile
cp .env.example .env  # enter public project values; never commit .env
bun run dev
bun run lint
bun test
bun run build
```

Production environment variables must be **public Supabase credentials only**:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
```

**Never** expose service-role, secret or database password in `VITE_` variables.

The `project_id` field in the root `supabase/config.toml` is a local CLI project identifier, not the hosted project reference. Link a developer checkout to the intended hosted project separately with:

```bash
supabase link --project-ref uinhybkdzevpxnugtvzf
```

## Operating the live CMS

1. In Supabase Auth, provision a verified staff email and assign a server-controlled `app_metadata.nb_role` of `owner`, `admin` or `editor` as appropriate; user metadata does not grant publisher access.
2. Open **Studio → Website CMS**. The `nb-media-approval` Edge Function is deployed with JWT verification; complete a supervised owner/admin test before live media approvals.
3. For Instagram, enter the shop owner's official HTTPS profile in Studio → Website CMS → Footer. Host validation rejects unrelated destinations. **Save draft → Publish website changes**.
4. Products: choose Men’s/Kids’ category first to reserve a permanent SKU, attach approved photographs, save private draft and publish. Search any live product by SKU, edit details/photos and select **Update published product**. Bulk CSV may leave SKU blank; export generated SKU mapping, assign camera photo batches to a single SKU, approve and match images before publishing.
5. Review incoming customer feedback under **Customer Reviews**. Public submissions stay pending; approve genuine reviews only.
6. Review the single Vercel project deployment, GitHub Actions quality gate, CodeQL and Supabase integration status before changing production traffic.

## Branch policy

`main` is the only permanent branch. GitHub is configured to delete merged head branches automatically. Keep new work in short-lived pull-request branches and merge only after required checks pass.

**Admin follow-up:** Protect `main` with required status checks and disabled force-pushes. The connected GitHub integration does not expose branch-protection write actions, so this must be configured in GitHub repository settings.

## Documentation

- [Production operations and commissioning](docs/OPERATIONS.md)
- [Studio user guide](docs/CMS_USER_GUIDE.md)
- [Client handoff and single-project operating notes](docs/CLIENT_ONBOARDING.md)
- [One-paste new-project SQL (21 migrations)](supabase/sql-editor/NOMAN_BROTHERS_INSTALL_FRESH_PROJECT.sql)
- [One-time owner role SQL after creating Auth user](supabase/sql-editor/NOMAN_BROTHERS_ASSIGN_OWNER_AFTER_AUTH.sql)
- [SQL Editor installation and migrations](docs/NOMAN_SQL_EDITOR_COPY_PASTE.md)
- [Cinematic intro and video upload](docs/2026-11-09-cinematic-hero-production.md)
- [Social logos and license attribution](docs/SOCIAL_ICON_LICENSES.md)
- [Current release acceptance checklist](docs/RELEASE_ACCEPTANCE.md)

## Release caveats

Browser automation and SQL permission simulation are strong regression checks but do not guarantee every real browser/device or authenticated user flow. Before full client signoff, perform real iPhone/Android/Safari QA, staff login and upload/publish tests, restore-point validation, accessibility review, commercial plan/domain confirmation and a content/legal approval pass. Verified phone/account details, policies and real product photographs must come from the business owner.
