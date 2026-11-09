# Nomaan Brothers — Production storefront and CMS

A mobile-first, browse-and-enquire catalogue for the traditional menswear and kidswear showroom in Mandi Bazar, Warangal. Built by Alif Growth Media. **The source of truth is the `main` branch. The SQL installer includes 18 ordered migrations plus live-client existing-table reconciliation.**

## Deployment and connected services

- Public storefront: https://numan-brothers-website-nine.vercel.app/
- Staff Studio: https://numan-brothers-website-nine.vercel.app/studio (same Vite/Vercel project; there is no separate CMS deployment).
- Source repository: https://github.com/nomaanbrothersthedesignersharw-max/Numan-Brothers-website
- Hosting: one Vercel project, `numan-brothers-website`, connected to this repository.
- Database/API: Supabase project `uinhybkdzevpxnugtvzf` (US East, PostgreSQL 17).

**Current commissioning status:** The frontend deployment is READY, but a deployment marked READY is not proof of business go-live. The active Supabase project contains the CMS schema, 23 category records, one published homepage row and one homepage draft row. It currently has no products, product drafts, media records, Storage objects or customer reviews. The media-approval Edge Function is not yet deployed. Real garment photography, verified contact numbers/social accounts, owner-approved policy text, a custom domain, staff-account verification and a tested restore/load plan remain release gates. The sample Plain Sherwani page is clearly marked **DEMO / NOT FOR SALE**. Payments, POS and accurate inventory are outside this catalogue's scope.

## Features

- Responsive Men’s Wear, Kids Wear and category routes; per-product pages with SKU, gallery and WhatsApp catalogue sharing.
- Five-second cinematic hero opener, left-slide reveal, skip/replay and reduced-motion/data-saver alternatives.
- Footer and contact pages display a single **locally bundled Instagram icon**. Only an owner-supplied valid HTTPS Instagram profile published in Studio activates the link; otherwise the icon stays disabled.
- Public legal-policy pages edited through Studio; empty policies clearly indicate pending owner approval.
- First-party customer reviews held pending until an authorized staff member moderates them.
- CMS for editable published garments, permanent server-generated SKU identities, Men/Kids category media, photo auto-labeling, bulk CSV import with optional SKU, owner approval, homepage text, social URL and revision history.
- Read-only storefront access to published records; restricted Supabase row-level and Storage policies.
- GitHub Actions typecheck, tests, PostgreSQL permission checks, production build and 18-viewport Chromium smoke checks. CodeQL and Dependabot are configured on the audit branch and become active after merge.

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

## Operating the live CMS

1. In Supabase Auth, provision a verified staff email and assign a server-controlled `app_metadata.nb_role` of `owner`, `admin` or `editor` as appropriate; user metadata does not grant publisher access.
2. Open **Studio → Website CMS**. Homepage text/contact fields can be maintained. Media approval is not yet operational: the `nb-media-approval` Supabase Edge Function must first be deployed and tested before uploaded files are approved for publication.
3. For Instagram, enter the shop owner’s official HTTPS profile in Studio → Website CMS → Footer. Host validation rejects unrelated destinations. **Save draft → Publish website changes**.
4. Products: choose Men’s/Kids’ category first to reserve NB-SH-00001-style permanent SKU, attach approved photographs, save private draft and publish. Search any live product by SKU, edit details/photos and select **Update published product**. Bulk CSV may leave SKU blank; export generated SKU mapping, assign camera photo batches to a single SKU, approve and match images before publishing.
5. Review incoming customer feedback under **Customer Reviews**. Public submissions stay pending; approve genuine reviews only.
6. Review the single Vercel project deployment, the GitHub Actions quality gate and the Supabase Edge Function status before changing production traffic.

## Branch policy

`main` is the release branch. For substantial changes, open a short-lived pull request branch and merge only after all required quality checks pass. Delete merged working branches manually after verifying the exact merged PR; CI does not automatically delete remote branches.

**Admin follow-up:** Configure GitHub branch protection/rulesets for `main` (required quality checks, prevent force pushes and restrict bypass). The connected GitHub integration cannot currently read or change branch protection settings, so this must be verified in GitHub repository settings.

## Documentation

- [Production operations and commissioning](docs/OPERATIONS.md)
- [Studio user guide](docs/CMS_USER_GUIDE.md)
- [Client handoff and single-project operating notes](docs/CLIENT_ONBOARDING.md)
- [One-paste new-project SQL (17 migrations)](supabase/sql-editor/NOMAN_BROTHERS_INSTALL_FRESH_PROJECT.sql)
- [One-time owner role SQL after creating Auth user](supabase/sql-editor/NOMAN_BROTHERS_ASSIGN_OWNER_AFTER_AUTH.sql)
- [SQL Editor installation and migrations](docs/NOMAN_SQL_EDITOR_COPY_PASTE.md)
- [Cinematic intro and video upload](docs/2026-11-09-cinematic-hero-production.md)
- [Social logos and license attribution](docs/SOCIAL_ICON_LICENSES.md)
- [Release acceptance checklist](docs/RELEASE_ACCEPTANCE.md)

## Release caveats

Browser automation and SQL permission simulation are strong regression checks but do not guarantee every real browser/device or authenticated user flow. Before full client signoff, perform real iPhone/Android/Safari QA, staff login and upload/publish tests, restore-point validation, accessibility review, and a content/legal approval pass. Verified phone/account details, policies and real product photographs must come from the business owner.
