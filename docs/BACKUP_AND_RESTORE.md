# Nomaan Brothers — Automated Backup & Restore Drill Runbook (Phase 4 #28)

## Automated Weekly Backups

`.github/workflows/backup-verify.yml` runs every Monday at 06:30 IST (and on-demand via **Actions → Backup & Schema Verification → Run workflow**).

To enable live database snapshot uploads:
1. In **Supabase Dashboard → Project Settings → Database**, copy the **Session pooler** connection string (read-only backup role recommended).
2. In **GitHub → Settings → Secrets and variables → Actions → Secrets**, add `SUPABASE_DB_URL`.
3. Each run exports the `public` schema + data via `pg_dump --schema=public --no-owner --no-privileges`, compresses it with `gzip`, and retains it as a private GitHub Actions artifact for 30 days.

---

## Quarterly Restore Drill (Staging Project)

1. Download the latest `nomaan-brothers-db-backup-*.sql.gz` artifact from GitHub Actions.
2. Decompress:
   ```bash
   gunzip nomaan-brothers-public-YYYYMMDD.sql.gz
   ```
3. Restore into your **staging** Supabase project (never production):
   ```bash
   psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f nomaan-brothers-public-YYYYMMDD.sql
   ```
4. Verify row counts and RLS integrity:
   ```sql
   select count(*) as products from public.nb_products;
   select count(*) as media from public.nb_media;
   select count(*) as reviews from public.nb_reviews;
   select count(*) as audit_events from public.nb_audit_events;
   ```
5. Record the drill date, row counts, and pass/fail status in your release ledger.
