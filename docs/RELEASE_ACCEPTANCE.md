# Nomaan Brothers — Release Acceptance and Go/No-Go Ledger

**Release status: NO-GO — NOT YET PRODUCTION-COMMISSIONED.**

A Vercel deployment marked READY proves that an artifact deployed; it does not prove that the store is commercially, operationally or security ready. Audit date: 2026-11-09.

## Current verified topology

| Area | Audited value |
|---|---|
| GitHub | `nomaanbrothers.../Numan-Brothers-website` standalone repo; `main` SHA `c8ad7e3d0c197ff7d0bf14a2d3cabf7420093eff` |
| Vercel | One Vite project, `numan-brothers-website`; production deployment READY |
| Public host | `https://numan-brothers-website-nine.vercel.app` |
| Studio | Same project at `/studio`; no separate CMS project |
| Vercel runtime | Node 22.x; preview SSO only, production public |
| Supabase | `uinhybkdzevpxnugtvzf`, US East, PostgreSQL 17.11 |
| Schema | 15 application tables, all with RLS enabled; 23 categories |
| Live content | Two confirmed Auth users; one published homepage row and one draft; no products, product drafts, media metadata, Storage objects or reviews |
| Edge Functions | None deployed; source `nb-media-approval` is present in GitHub |
| Migration ledger | Supabase migration-history API currently returns no applied migrations; reconcile after a schema diff, never blindly replay the installer |
| Domain | No custom domain attached; only a Vercel-provided domain is verified |
| Git protection | `main` currently reports unprotected; branch-protection API access is not available to the connected GitHub integration |
| CI evidence | No workflow runs were returned in the audit; this release branch must produce a green run before merge |
| Hosting plan | Vercel Hobby; confirm a commercial-capable plan before commercial production use |

## Work completed during this audit

- Production Supabase URL was verified to target the accessible `uinhybkdzevpxnugtvzf` project. Its Vercel publishable key was checked against the matching active Supabase publishable key; no key value is recorded here.
- Vercel preview protection was narrowed to Preview only so that Production is not SSO-gated for customers.
- Vercel Node version aligned to Node 22.x, matching the documented CI/runtime baseline.
- An isolated Git branch was created for source fixes.
- CSV parsing was hardened for BOM, LF/CRLF/CR, malformed characters after a closing quote and record limits.
- CSV error export now neutralizes actual control-character prefixes before spreadsheet formula markers.
- Live smoke test now targets the actual single deployed site and permits the safe showroom contact fallback instead of requiring unconfigured phone data.
- Workflow no longer targets the stale second CMS deployment URL.
- Added Dependabot updates for the Bun lockfile and GitHub Actions, plus CodeQL JavaScript/TypeScript analysis. These workflows become active after the branch is merged; they still need successful runs.
- Added migration 17 to revoke unnecessary anonymous SKU-counter privileges and remove authenticated DELETE/REFERENCES/TRIGGER/TRUNCATE while retaining the SELECT/INSERT/UPDATE permissions required by the staff-only reservation function. The migration and both SQL bundles are in the PR; it has not been applied to the live database pending schema-history reconciliation and a recovery point.

The changes above are branch/project configuration work; they have not been merged to `main` or promoted as a new Production deployment.

## Required release gates

### Code and CI

- [ ] Pull request reviewed and merged only after all quality workflow jobs pass on the exact proposed SHA.
- [ ] TypeScript, Bun tests, PostgreSQL role/RLS tests, SQL installer consistency and Chromium viewport matrix pass.
- [ ] Live public smoke test passes against the actual Production domain after deployment.
- [ ] GitHub branch protection is enabled on `main`; require the quality workflow and prevent force-push/bypass.
- [ ] Enable dependency security alerts and a secret-scanning/push-protection policy; review existing repository history for accidentally committed credentials.
- [ ] Confirm source contains no service-role key, database password or private API credential.

### Supabase and CMS

- [ ] Review the populated target project owner, billing and recovery configuration. The previous project ref `xiidzpsyuvfhyjudrrfq` is not accessible through the current connection; establish its ownership and confirm whether it contains any data before retiring it.
- [ ] Compare the live Supabase schema with all 18 source migrations and reconcile the currently empty migration ledger without re-running the fresh installer; only then apply migration 17 and verify direct table privileges and the SKU reservation RPC.
- [ ] Deploy and test `nb-media-approval` with a non-production test image and actual owner/admin accounts; test approve, revoke, archive, restore, delete, stale role and referenced asset rejection.
- [ ] Enable leaked-password protection in Supabase Auth and review the `pg_trgm` public-schema advisor finding.
- [ ] Review and consolidate the two overlapping permissive policy pairs only after regression tests prove equivalent access for anonymous, editor and publisher roles.
- [ ] Confirm database backup cadence, restore a backup to a separate project, and independently restore Storage objects.
- [ ] Run the 5-product workflow: create SKU, upload, approve, attach, draft, publish, edit, archive, restore and publish homepage.
- [ ] Verify no fake demo content is included in the live catalogue. The sample Plain Sherwani stays `DEMO / NOT FOR SALE`.

### Business content and storefront

- [ ] Attach and verify the business-owned custom domain and canonical URL.
- [ ] Validate HTTPS, redirects, DNS, sitemap, robots, canonical tags and structured data on the verified domain.
- [ ] Confirm real product photography, descriptions, sizes, prices (where displayed) and image rights.
- [ ] Confirm owner-approved contact numbers, social URLs and business address; never invent these.
- [ ] Approve real Privacy, Terms and Returns policy text before publishing.
- [ ] Test Studio login, session expiry, role removal and owner/admin privileges on the actual project.

### Performance, security and resilience

- [ ] Run k6 on staging through gradual 50/100/250/500/1,000 virtual-user stages, followed by stress and soak tests. Record request p50/p95/p99, error rate, DB load and recovery behavior.
- [ ] Test 10,000 synthetic products and 100,000 synthetic media metadata rows in staging; record measured query times, API performance and costs.
- [ ] Run Lighthouse CI on storefront, category, product, contact and Studio login routes. Record Core Web Vitals and accessibility findings.
- [ ] Run CodeQL/dependency/secret scans and an authenticated/unauthenticated OWASP ZAP scan on staging.
- [ ] Configure uptime/error alerts, and rehearse rollback and database/media restoration.
- [ ] Reassess Vercel and Supabase region placement based on measured Hyderabad/India traffic latency. Current functions use IAD1 and Supabase is US East.

### Ownership and commercial readiness

- [ ] Move hosting to a Vercel plan permitted for commercial use or choose another commercial host.
- [ ] Confirm the client owns or administers GitHub, Supabase, Vercel and domain registrar accounts.
- [ ] Complete MFA, access review and a named incident-response owner.
- [ ] Record the exact release SHA, green CI URL, Supabase migration evidence, restore evidence, load-test report, custom domain, rollback target, owner signoff and date.
- [ ] Only after every required gate is evidenced, authorize Production promotion.

## Release evidence ledger

Fill this ledger with evidence from the exact release commit. Do not guess or backfill pass statuses.

| Item | Evidence |
|---|---|
| Release SHA | PENDING |
| GitHub Actions URL (same SHA) | PENDING |
| Protected `main` verification | PENDING |
| Supabase schema diff/migration reconciliation | PENDING |
| Edge Function deploy + auth tests | PENDING |
| RLS/Storage role tests | PENDING |
| Database + Storage restore drill | PENDING |
| Staging load-test report | PENDING |
| Lighthouse/accessibility report | PENDING |
| Security scan report | PENDING |
| Owner-approved domain + canonical | PENDING |
| Business content/policy approval | PENDING |
| Production deployment + live smoke test | PENDING |
| Business owner signoff | PENDING |

**Never label the site production-ready solely because Vercel says READY or source compilation succeeds.**
