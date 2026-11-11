# Nomaan Brothers — Operations, Security and Recovery

This runbook describes the currently connected Nomaan Brothers website architecture. It is intentionally specific to the deployed project; do not apply instructions from an unrelated Supabase or Vercel project.

## Audited service map

Audit date: 2026-11-11. This is a read-only verification snapshot, not a commercial launch sign-off.

- **Source:** `nomaanbrothersthedesignersharw-max/Numan-Brothers-website`, default branch `main`; current verified release SHA `4bcfa4b628f1299def1bdf8dfbdb81c9a3a7dfe4`. The repository is standalone and has one permanent branch.
- **Hosting:** one Vercel Vite project, `numan-brothers-website`; latest Production deployment is READY on the SHA above. Public host: `https://numan-brothers-website-nine.vercel.app`; Studio is same-origin at `/studio`. Vercel Node.js 22.x; IAD1 deployment region. Production is public; Preview is SSO-protected. No business-owned custom domain is attached and `SITE_CANONICAL_URL` is not configured. As a deliberate safety guard, public HTML is `noindex`, `robots.txt` disallows all crawling and sitemap endpoints return 503 until the owner approves the canonical business domain.
- **Database:** Supabase project `uinhybkdzevpxnugtvzf`, `us-east-1`, PostgreSQL 17.11, status ACTIVE_HEALTHY. Vercel Production's public Supabase URL/key target this project; no private Supabase key was observed in the browser bundle.
- **Schema:** 15 public application tables, all with RLS enabled; 40 public policies; 3 Storage buckets (private `nb-media`, public approved delivery `nb-media-public`, private staging `nb-media-staging`). The `nb_studio_product_index` view is `security_invoker=true`. The SKU counter has no direct anonymous table privileges; authenticated operations are constrained by its staff-only RLS policy and role-checked reservation function.
- **Migration history:** all 21 repository migration versions are listed in the selected project's migration history. The schema inventory was checked before history reconciliation. No fresh-project installer or historical migration SQL was replayed against production during the latest audit. Continue to treat the history and live schema as separate evidence; never replay the fresh installer against this database.
- **Edge Function:** `nb-media-approval` is ACTIVE v3 with `verify_jwt=true`. Its privileged approve/revoke/archive/restore/delete lifecycle still requires a supervised end-to-end test with real owner/admin accounts and a non-production asset.
- **Live commissioning endpoint:** `/api/cms-status` returned 200 with Auth health, public catalogue access and anonymous denial of drafts/media/revisions all healthy. This read-only check does not authenticate staff or exercise Storage uploads and approval.
- **Plans and launch constraints:** Vercel organization is on Hobby; the site is a commercial showroom, so Hobby is not an eligible commercial plan under current Vercel terms. Supabase organization is on Free. Supabase Security Advisor reports leaked-password protection disabled; its docs place this feature on Pro and above. Supabase Free has no managed database backups and can pause low-activity projects. Obtain explicit owner approval for any paid plan, or implement encrypted off-site database and Storage backups with a tested restore. Measure India user latency before changing US East/IAD1 regions.
- **Production HTTP verification:** latest main push passed TypeScript/build, CodeQL, 101 local browser checks and 15 live production browser checks. A separate post-deploy HTTP/CMS commissioning smoke is being added to the main-push workflow so future production releases fail closed if these health checks regress.

The earlier Supabase project ref `xiidzpsyuvfhyjudrrfq` is still the target shown by the Supabase GitHub Preview integration. It is not the selected Production project. Reconnect that integration inside the selected `uinhybkdzevpxnugtvzf` project before relying on Supabase Preview checks; do not attempt changes in the old project without confirming ownership and backups.

## People and roles

- The business owner controls domain, billing and owner credentials. Give collaborators the minimum access they need; require MFA where available.
- Staff roles are assigned only through Supabase Auth `app_metadata.nb_role`: `owner`, `admin` or `editor`. User-editable metadata does not grant publishing privileges.
- Editors prepare drafts. Owner/admin roles approve media and publish content. Do not share staff accounts.
- For offboarding, revoke sessions, remove the privileged role, review recent revisions/imports and test that a previously issued session no longer grants access.

## Database safety and migration discipline

1. Keep the existing project as the source of truth until a reviewed backup and migration plan explicitly replaces it.
2. Before any DDL, export schema and data to client-controlled encrypted storage and confirm a separate recovery point. Never store backups or credentials in Git.
3. Apply forward-only migrations in staging first. Test with anonymous, editor, admin, owner and revoked identities. Verify RLS, grants, triggers, publishing RPCs and storage policies.
4. Do not remove unused indexes on an empty/low-traffic project based only on the advisor. Reassess after real query volume and representative EXPLAIN plans.
5. All 21 source migration versions now appear in the selected project's migration history. Recheck actual schema objects and migration history before any further CLI migration; history metadata is not a substitute for live schema validation.
6. A live privilege inspection confirms `anon` has no direct table privileges on `nb_sku_counters`; authenticated direct table privileges are limited to SELECT/INSERT/UPDATE, with DELETE denied and a staff-only RLS policy. The public review table uses narrow column-level anonymous INSERT grants (display name, rating and comment only); anonymous clients cannot set moderation status or update rows. Security Advisor currently reports only leaked-password protection disabled. Performance Advisor reports 23 unused-index INFO notices; do not drop these on a low-traffic dataset before representative load tests.

## Media lifecycle and reconciliation

- User uploads should remain in private `nb-media-staging`; only approved files should be copied to public `nb-media-public`.
- The deployed `nb-media-approval` Edge Function (ACTIVE v3, JWT required) verifies a fresh Auth identity and owner/admin role before privileged storage work. Real owner/admin lifecycle testing remains outstanding.
- Deploy only after reviewing the function, matching migration/storage policies and testing it with a non-production asset and real owner/admin credentials.
- Storage object copies and database updates are not one atomic transaction. Reconcile uploads without metadata, public copies without approved metadata, approved metadata without public copies, and failed revocations.
- Do not revoke/archive/delete an asset still referenced by a published product, collection, homepage or saved draft. Replace, save and publish references first.

## CSV and import lifecycle

- CSV imports are limited to 8 MB and 10,000 rows. Generated SKUs are permanent identities; do not reuse a SKU after a failed or abandoned draft.
- Treat imports as resumable but not atomic across browser, database and storage. Inspect the import job and row audit after interruption before retrying.
- Error-report CSV fields must be formula-neutralized before opening in spreadsheet software.
- Confirm duplicate detection, malformed quoting, category/department matching, generated SKU mapping and image matching using staged data before a large import.

## Deployment and change control

1. Develop on a short-lived branch and open a pull request. Never commit directly to `main` for production changes.
2. Required CI includes TypeScript, unit/regression tests, PostgreSQL security tests, build, responsive Chromium tests and live public URL smoke checks. Verify the exact commit has a green run before merge.
3. Protect `main` in GitHub: require the quality workflow, disallow force pushes and restrict bypass. Current GitHub connector access cannot read or configure branch protection; a repository administrator must verify it in GitHub Settings.
4. Keep `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` as the only browser-facing Supabase credentials. Never place service-role, secret or database credentials in a `VITE_*` variable.
5. Preview should use a separate staging backend. Do not copy production publishable configuration into a preview if the preview could create or update production content.
6. Before promoting, verify the domain, build output, sitemap, robots, response status, Studio access, RLS, storage upload/approval/publish flow and rollback target.
7. A Vercel rollback reverts code, not database migrations. Maintain a migration rollback/forward-fix plan separately.

## Backup strategy and restore drill

1. Document database backup cadence/retention for the actual Supabase plan.
2. Back up Storage objects independently; a database backup does not include the actual Storage file bytes.
3. Restore a backup to a separate project and verify row counts, RLS, auth identities, product/media associations and bucket objects.
4. Record restore time, backup timestamp, API health, migration version and reconciliation errors. A restore drill is not complete until media bytes are also verified.

## Incident handling

- **Wrong backend:** stop a release and verify the project ref in Vercel Production and the Supabase dashboard. Do not copy customer data without explicit owner approval.
- **Unauthorized access:** revoke identity/session, inspect Auth/audit logs, review data/media revisions and rotate server credentials if compromise is suspected.
- **Missing media:** inspect Storage objects, media metadata, approval status, published references and Edge Function logs before attempting a retry.
- **Missing products:** verify published status, active category paths, RLS and API errors. Never substitute demo products as live inventory.
- **Slow catalogue:** inspect query plans, PostgREST request timings, index usage, image sizes, CDN cache and client-side duplicate requests before scaling database compute.
- **SEO failure:** test actual HTTP HTML/status for category and product routes, canonical URLs, robots, sitemap and JSON-LD.

## Handover checklist

Give the owner their repository, Vercel/Supabase ownership, domain registrar access, staff provisioning instructions, public environment-variable names, migration/runbook, backup responsibility, exact release SHA, rollback plan and support contact. Never hand over an agency-wide secret or put credentials in chat.
