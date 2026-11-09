# Nomaan Brothers — Production storefront and CMS

A mobile-first, browse-and-enquire catalogue for the traditional menswear and kidswear showroom in Mandi Bazar, Warangal. Built by Alif Growth Media. **The source of truth is the `main` branch. The SQL installer includes 15 ordered migrations plus live-client existing-table reconciliation.**

## Live services

- Customer storefront: https://numan-brothers-website.vercel.app/
- Staff CMS: https://numan-brothers-cms-showroom.vercel.app/studio
- GitHub: https://github.com/helloalifstudio-coder/Numan-Brothers-website
- Data: dedicated Nomaan Brothers Supabase project, with Auth, RLS, PostgreSQL and approved media storage.

**What is live vs pending:** A responsive public website and Studio are deployed. Some content cannot be completed without client approval: real photos and brand film, verified social links, approved privacy/return/terms statements and actual garments. Decorative sample artwork is illustrative; the Plain Sherwani demo is labeled **NOT FOR SALE**, not database stock. Payments, POS and accurate inventory are outside this catalogue's scope.

## Features

- Responsive Men’s Wear, Kids Wear and category routes; per-product pages with SKU, gallery and WhatsApp catalogue sharing.
- Five-second cinematic hero opener, left-slide reveal, skip/replay and reduced-motion/data-saver alternatives.
- Footer and contact pages display a single **locally bundled Instagram icon**. Only an owner-supplied valid HTTPS Instagram profile published in Studio activates the link; otherwise the icon stays disabled.
- Public legal-policy pages edited through Studio; empty policies clearly indicate pending owner approval.
- First-party customer reviews held pending until an authorized staff member moderates them.
- CMS for product drafts, category selection, generated SKUs, media approvals, bulk import, homepage sections, policy text, social URLs and revisions.
- Read-only storefront access to published records; restricted Supabase row-level and Storage policies.
- GitHub Actions typecheck, tests, PostgreSQL permission checks, production build and 18-breakpoint Chromium smoke checks, including live deployments.

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
2. Open **Studio → Website CMS**. Upload and approve media via the Media workflow, select imagery and a compressed brand film, and edit text, profiles or policies.
3. For Instagram, enter the shop owner’s official HTTPS profile in Studio → Website CMS → Footer. Host validation rejects unrelated destinations. **Save draft → Publish website changes**.
4. Products require the correct Men’s/Kids’ category and generated SKU. Publish only approved photos and verified descriptions; confirm mobile UI and WhatsApp sharing from the product page.
5. Review incoming customer feedback under **Customer Reviews**. Public submissions stay pending; approve genuine reviews only.
6. Review both Vercel deployments and the GitHub Actions quality gate before changing production traffic.

## Branch policy

`main` is the only persistent branch. For substantial changes, open a short-lived pull request branch and merge after quality checks. A post-success GitHub Actions maintenance job checks each temporary `agm/` branch against its **exact unchanged merged PR head** and deletes it; unmerged, protected, or modified work is preserved. No extra Netlify builds or previews are created.

**Admin follow-up:** Configure GitHub branch protection/rulesets for `main` (required status checks, prevent force pushes, approved changes where appropriate); that repository setting is separate from source code.

## Documentation

- [Production operations and commissioning](docs/OPERATIONS.md)
- [Studio user guide](docs/CMS_USER_GUIDE.md)
- [Client deployment](docs/CLIENT_ONBOARDING.md)
- [SQL Editor installation and migrations](docs/NOMAN_SQL_EDITOR_COPY_PASTE.md)
- [Cinematic intro and video upload](docs/2026-11-09-cinematic-hero-production.md)
- [Social logos and license attribution](docs/SOCIAL_ICON_LICENSES.md)
- [Release acceptance checklist](docs/RELEASE_ACCEPTANCE.md)

## Release caveats

Browser automation and SQL permission simulation are strong regression checks but do not guarantee every real browser/device or authenticated user flow. Before full client signoff, perform real iPhone/Android/Safari QA, staff login and upload/publish tests, restore-point validation, accessibility review, and a content/legal approval pass. Verified phone/account details, policies and real product photographs must come from the business owner.
