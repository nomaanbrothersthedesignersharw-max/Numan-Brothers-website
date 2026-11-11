# Nomaan Brothers — Release Acceptance and Go/No-Go Ledger

**Release status: NO-GO — deployment is live, but commercial production commissioning is incomplete.**  
**Last verified:** 11 November 2026.

A Vercel deployment marked READY proves that an artifact deployed; it does not prove that the store is commercially, operationally or security ready. This ledger separates verified engineering state from owner decisions and remaining acceptance tests.

## Current verified topology

| Area | Audited value |
|---|---|
| GitHub | `nomaanbrothersthedesignersharw-max/Numan-Brothers-website`; only `main` branch remains |
| PRs | 11 earlier PRs merged; PR #12 is the current production-readiness hardening PR |
| Latest source SHA | `4bcfa4b628f1299def1bdf8dfbdb81c9a3a7dfe4` |
| GitHub Actions | TypeScript/build and CodeQL passed; local Chromium smoke passed 101/101 checks across 18 viewport widths and 6 representative routes; live production browser smoke passed 15/15 checks |
| Supabase Preview check | Latest PR check SKIPPED — no Supabase preview branch associated; details URL still points at old project `xiidzpsyuvfhyjudrrfq` |
| Vercel | One Vite project, `numan-brothers-website`; latest Production deployment READY on the latest source SHA |
| Public host | `https://numan-brothers-website-nine.vercel.app` |
| Studio | Same project at `/studio`; no separate CMS project |
| Vercel runtime/region | Node 22.x; deployment region IAD1 |
| Supabase | `uinhybkdzevpxnugtvzf`, US East, PostgreSQL 17.11, project ACTIVE_HEALTHY |
| Schema | 15 public application tables; every public table has RLS enabled; 40 public policies |
| Storage | Three buckets: private `nb-media`, public approved delivery `nb-media-public`, private staging `nb-media-staging` |
| Live data at last check | 0 published products, 0 product drafts, 2 media metadata records, 4 Storage objects, 23 categories, 0 reviews (11 Nov 2026 live count) |
| Auth | 2 confirmed users; 1 owner role |
| Edge Function | `nb-media-approval` ACTIVE, version 3, `verify_jwt=true`; deployed source exactly matches repository source |
| Migration ledger | 21 versions listed for the repository's 21 migration files (details below) |
| Domain/SEO | Only Vercel-provided domain attached; no business-owned custom domain or canonical origin |
| Git protection | `main` reports unprotected; automatic delete of merged head branches is enabled |
| Plans | Vercel Hobby; Supabase Free |

## Verified work completed

- Post-merge main SHA `4bcfa4b628f1299def1bdf8dfbdb81c9a3a7dfe4` is deployed READY to Production. GitHub Actions run #102 and CodeQL run #102 both passed. Public live Playwright smoke covered 15 checks, including `/`, `/studio` response, security headers and real/fallback contact actions. Local browser regression passed 101 checks with zero failures.
- Live `/api/cms-status` returned 200: Supabase Auth health, public catalogue access and anonymous denial of private drafts/media/revisions all passed. This is not an authenticated CMS or Storage lifecycle test.
- The production homepage and representative collection route return HTTP 200. Studio returns HTTP 200 with `X-Robots-Tag: noindex` and `Cache-Control: private, no-store`. The public `robots.txt` blocks all crawling and `/sitemap.xml` plus `/sitemap-static.xml` return 503 while the owner-approved canonical domain is absent; this is intentional.

### Repository and delivery
- GitHub has one permanent branch, `main`; all 10 pull requests are merged and none are open.
- The latest source SHA above passed TypeScript/build, CodeQL and the 18-viewport browser smoke job.
- Vercel's latest Production deployment is READY and points to that exact SHA.
- The live homepage, `/studio`, `/men` and `/kids` respond successfully. No Vercel runtime error clusters were reported in the selected seven-day query.
- Vercel production env's deployed JavaScript bundle was checked to contain the selected `uinhybkdzevpxnugtvzf` URL and its matching publishable key. No secret key was observed in the browser bundle.

### Supabase schema and migration history
- Read-only inventory passed: 15 expected public tables, all with RLS; 40 public policies; 3 configured Storage buckets; secure staff index view; required CMS RPCs; and private internal schema checks.
- Expected CMS functions and triggers are present. The one old Studio index name absent from the database is replaced by `nb_product_drafts_changed_idx` on the same columns.
- The five existing migration-history rows were compared with their matching source SQL and statements matched exactly, despite timestamp differences in the old history.
- The migration history now lists all 21 source migration versions. Sixteen older migrations were added as history-only records after their installed schema objects were checked. The five SQL-backed records were aligned to their source filenames.
- **No migration SQL was replayed and no fresh-project installer was run against production.** This was migration-history metadata reconciliation, not a database reset or schema replay.
- The `pg_trgm` extension is in the `extensions` schema. Required video-gallery indexes and the secure staff view are present.
- Public review column grants were inspected: anonymous users can submit the intended fields and read approved-review fields; they cannot update moderation status. RLS controls which rows are visible.
- `nb-media-approval` is live with JWT verification and its deployed source matches GitHub. Its approve/revoke/archive/restore/delete flows still require authenticated owner/admin end-to-end tests.

### Remaining Supabase Preview integration gap
- The latest GitHub `Supabase Preview` check for PR #12 was skipped because no Supabase branch is associated with that PR. Its details URL still points to `xiidzpsyuvfhyjudrrfq`, not the selected `uinhybkdzevpxnugtvzf` production project.
- An earlier run against the old integration returned SQLSTATE 42710 because `nb_categories_public_select` already existed on that old project's preview database. The latest skipped result is not a successful database preview.
- The current connected Supabase account cannot inspect or administer that old project. Do not attempt to repair or modify it blindly.
- Reconnect Supabase GitHub integration from the selected project's **Project Settings → Integrations**, choose this repository and set working directory to `.`. Confirm the new check links to `uinhybkdzevpxnugtvzf`. Supabase's GitHub integration guide: https://supabase.com/docs/guides/deployment/branching/github-integration.
- Supabase organization Free plan currently has no active development branches. Automatic preview branches may require a paid plan; production connection and branch preview are separate settings.

## Current release gates

### Must resolve before commercial launch
- [ ] Populate and owner-approve the real product catalogue. The live production count is currently 0 published products and 0 product drafts; the sample garment is explicitly demo-only. Upload legitimate product records, sizes, images and any displayed prices before launch.
- [ ] Connect the Supabase GitHub integration to `uinhybkdzevpxnugtvzf`; confirm the check no longer links to the old project and a new preview run succeeds.
- [ ] Resolve the Supabase Auth leaked-password warning. Security Advisor reports it disabled. Supabase currently documents leaked-password protection as Pro-plan-and-above; the project is Free, so this needs owner-approved billing or a formal risk acceptance with alternative controls: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.
- [ ] Protect GitHub `main`: require the website quality workflow and CodeQL, prevent force pushes, and restrict bypass.
- [ ] Move Vercel from Hobby to a commercial-eligible Pro/Enterprise plan before commercial use. Vercel's current Hobby terms restrict it to personal/non-commercial use. The owner must approve the paid plan and its price first.
- [ ] Decide whether to upgrade Supabase from Free or maintain encrypted off-site database exports plus independent Storage backups and a proven restore. Free projects may pause after inactivity and do not include managed backups.
- [ ] Attach and verify the business-owned custom domain. Add `SITE_CANONICAL_URL` to Vercel Production only after that exact HTTPS origin is approved.
- [ ] Then verify prerendered pages no longer contain `noindex`, `robots.txt` allows approved public routes while disallowing `/studio` and `/api/`, and `/sitemap.xml`, `/sitemap-static.xml` and product sitemap pages return valid XML. Until a canonical domain is approved, the current crawl block and sitemap 503 responses are intentional.
- [ ] Approve real product photography, descriptions, sizes, prices (if displayed), usage rights, contact details, official social URL, business address and legal Privacy/Terms/Returns text. Never invent these.

### Supabase and CMS acceptance
- [ ] Run authenticated owner/admin/editor tests for Studio login, session expiry, role removal and role revocation. Public live smoke intentionally does not sign in or mutate data.
- [ ] Run a supervised media lifecycle test using a non-production asset: upload, approve, attach, reject revocation while referenced, detach, revoke, archive, restore and delete. Verify rejection for stale/non-owner roles and referenced assets.
- [ ] Verify actual public and authenticated RLS/Storage behavior using owner, editor, anonymous and authenticated test sessions; static policy inspection alone is not sufficient.
- [ ] Confirm database backup cadence and perform a restore to a separate project; independently restore Storage objects. Supabase's automatic database backup service is not included in Free.
- [ ] Run the 5-product workflow: create SKU, upload, approve, attach, draft, publish, edit, archive, restore and publish homepage.
- [ ] Test CSV import/retry and saved product drafts with a small approved test dataset.
- [ ] Confirm no demo content is presented as a real product. The sample Plain Sherwani stays clearly marked `DEMO / NOT FOR SALE`.

### Performance, security and resilience
- [ ] Test 10,000 synthetic products and 100,000 synthetic media metadata rows in staging. Record actual query timings, API response times, upload throughput and cost.
- [ ] Run k6 on staging through gradual 50/100/250/500/1,000 virtual-user stages, followed by stress and soak testing. Record p50/p95/p99, error rate, database load and recovery.
- [ ] Run Lighthouse CI on storefront, category, product, contact and Studio login routes. Record Core Web Vitals and accessibility findings.
- [ ] Run authenticated/unauthenticated OWASP ZAP testing and dependency/secret scanning on staging.
- [ ] Configure uptime/error alerts and rehearse application rollback plus database and media recovery.
- [ ] Reassess IAD1/Virginia hosting and US East database placement against measured India/Hyderabad traffic latency.
- [ ] Review Supabase's 23 unused-index INFO findings after representative traffic/load tests. Do not drop indexes merely because the new low-volume project has not used them yet.

### Ownership and release sign-off
- [ ] Confirm the business owner administers GitHub, Supabase, Vercel and the domain registrar.
- [ ] Complete MFA, account-access review and name an incident-response owner.
- [ ] Record exact release SHA, successful GitHub Actions links, correct Supabase Preview check, migration-history evidence, backup/restore evidence, load-test report, Lighthouse/security reports, custom domain, rollback target and owner sign-off.
- [ ] Only after required gates are evidenced, authorize the commercial launch and search indexing.

## Release evidence ledger

| Item | Evidence / current state |
|---|---|
| Current source SHA | `4bcfa4b628f1299def1bdf8dfbdb81c9a3a7dfe4` |
| GitHub quality workflow | https://github.com/nomaanbrothersthedesignersharw-max/Numan-Brothers-website/actions/runs/42978318623 — success |
| GitHub CodeQL | https://github.com/nomaanbrothersthedesignersharw-max/Numan-Brothers-website/actions/runs/42978318720 — success |
| Supabase Preview | FAIL — still linked to old project `xiidzpsyuvfhyjudrrfq` |
| Protected `main` verification | PENDING — main currently unprotected |
| Supabase schema and migration ledger | 21 versions listed; schema inventory passed; 16 history-only records |
| Edge Function | ACTIVE v3, JWT verified; real owner/admin lifecycle tests pending |
| RLS and Storage role tests | Inventory and privilege inspection passed; full live session matrix pending |
| Database + Storage restore drill | PENDING |
| Staging scale/load test | PENDING |
| Lighthouse/accessibility report | PENDING |
| Security review | CodeQL passed; leaked-password protection still disabled; authenticated OWASP test pending |
| Published inventory | PENDING — live count is 0 published products / 0 drafts; demo-only sample is not inventory |
| Owner-approved domain + canonical | PENDING |
| Business content/legal approval | PENDING |
| Production deployment | READY on SHA `4bcfa4b...`; 15/15 live public browser checks and live CMS endpoint checks passed. Commercial/legal/domain go-live gates remain NO-GO. |
| Business owner sign-off | PENDING |

**Never label the site fully production-ready solely because Vercel says READY or source compilation succeeds.**
