# Nomaan Brothers — Operations, Security and Recovery

This runbook describes the currently connected Nomaan Brothers website architecture. It is intentionally specific to the deployed project; do not apply instructions from an unrelated Supabase or Vercel project.

## Audited service map

Audit date: 2026-11-09.

- **Source:** `nomaanbrothersthedesignersharw-max/Numan-Brothers-website`, default branch `main`. The repository is now standalone (not a GitHub fork).
- **Hosting:** one Vercel project, `numan-brothers-website`, using Vite. Its verified Vercel domain is `https://numan-brothers-website-nine.vercel.app`; Studio lives at `/studio` on the same origin. There is no separate CMS Vercel project and no custom domain attached.
- **Runtime:** Vercel Node.js 22.x. Preview deployments are SSO-protected; Production is not SSO-protected so customers can browse it.
- **Database:** Supabase project `uinhybkdzevpxnugtvzf`, region `us-east-1`, PostgreSQL 17.11. The Production Vite variables target this same project, and the Vercel publishable key was checked against the active Supabase publishable key without disclosing the key.
- **Database contents at audit:** 15 application tables with RLS enabled, 23 categories, two confirmed Auth users, one published homepage row and one homepage draft row. There are no product rows/drafts, media metadata/storage objects or reviews. The published homepage has contact details configured; this runbook deliberately does not copy those values.
- **Migrations:** the source tree contains 18 ordered migrations, but Supabase's migration-history API currently reports no applied migration rows. The schema exists, so it must be treated as an SQL Editor-installed database until a schema diff and migration-ledger reconciliation are completed. Do not rerun the fresh-project installer against this database.
- **Functions:** no Supabase Edge Functions are currently deployed. The source includes `nb-media-approval`; media review/approval/revocation workflows must not be treated as operational until that function is deployed and exercised with real owner/admin accounts.
- **Plan and regional note:** the connected Vercel team is on Hobby. Confirm an eligible commercial hosting plan before using Vercel for this commercial showroom. Supabase is in US East and Vercel functions currently use IAD1; measure India user latency before changing either region.

The earlier Supabase project ref `xiidzpsyuvfhyjudrrfq` is not accessible to the current connected Supabase account. Do not assume it was deleted or move data from it without confirming its owner, backups and contents.

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
5. Reconcile the currently empty Supabase migration ledger only after comparing the live schema with the source installer. Do not mark migrations applied merely because the table names exist.
6. The live Supabase database also has excessive direct grants on `public.nb_sku_counters`: `anon` and `authenticated` had broad table privileges including DELETE/TRUNCATE. The source adds migration `20261109210000_sku_counter_least_privilege.sql`, which removes all anonymous rights and limits staff to SELECT/INSERT/UPDATE while preserving the staff-only RLS policy and the role-checked reservation function. This migration is in the audit PR and has **not** yet been applied to the live database; apply only after the schema/migration-ledger reconciliation and a recovery point. Migration `20261109213000_consolidate_cms_rls_policies.sql` also combines the existing media UPDATE and reviews SELECT policy pairs while preserving their original OR conditions, removing the two multiple-permissive-policy advisories when applied. This is likewise staged in the PR and not yet applied live. The advisor also reports leaked-password protection disabled, `pg_trgm` installed in `public`, and two pairs of overlapping permissive policies. Review these against the running schema before changing Auth settings, moving the extension or consolidating policy predicates.

## Media lifecycle and reconciliation

- User uploads should remain in private `nb-media-staging`; only approved files should be copied to public `nb-media-public`.
- The source `nb-media-approval` Edge Function verifies a fresh Auth identity and owner/admin role before privileged storage work. It is **not deployed** in the audited project yet.
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
