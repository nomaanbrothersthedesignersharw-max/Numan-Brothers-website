# Noman Brothers — current copy/paste SQL installation

**Choose one Supabase project before doing anything.** The client-owned Vercel environment variable `VITE_SUPABASE_URL` identifies the project that receives Auth, tables, and media. If another organization/project exists, it does not conflict automatically; the wrong paired URL/key or migrations in a different project are what break CMS access. Do not delete accounts or production data to troubleshoot.

## Path A — truly fresh project (one paste)

1. Sign into the client's chosen Supabase project and confirm there are **no existing Noman `nb_*` tables or `nb-media*` buckets**. A new organization is not required, only the correct project.
2. Open the repository's `supabase/sql-editor/NOMAN_BROTHERS_INSTALL_FRESH_PROJECT.sql` on the final `main` commit. Click **Raw**, copy the **entire** file, including `BEGIN;` and final `COMMIT;`. Never paste the Markdown explanatory text or a single `-` comment prefix.
3. In the **same** Supabase project's **SQL Editor**, paste and run the single script. It installs **18 reviewed migrations**, in order and in one transaction: 15 `nb_*` tables, 3 media buckets, category taxonomy, Auth role-gates, RLS, audit history, product CRUD publishing, SKU counters, media reference safety and performance indexes.
4. It deliberately **does not create any Auth users or passwords**, fake inventory, images or videos. It also cannot deploy Edge Function TypeScript or configure Vercel.
5. The script refuses a pre-existing Noman installation. An error rolls back its transaction; do **not** skip failing statements or use `DROP TABLE` on a client project to force success.
6. Run `supabase/sql-editor/NOMAN_BROTHERS_VERIFY_READ_ONLY.sql` and confirm 15 tables, RLS, expected published-only functions and 3 buckets.

## Path B — you already created all 15 tables

If the client project already contains **all 15 Noman `nb_*` tables**, back it up, inspect schema and existing rows, then use `supabase/sql-editor/NOMAN_BROTHERS_COMPLETE_EXISTING_TABLES.sql` to reconcile its remaining migrations. This SQL path is designed for a Noman installation in the intended schema, **not** for a half-written unrelated schema. Review exact errors; never apply both installers to one project.

## Owner Auth role — the second, separate SQL paste

1. In **Authentication → Users**, create the real owner account with their confirmed Gmail and strong password. Supabase Auth handles password hashing and email confirmation. Do **not** use SQL `INSERT INTO auth.users` or plaintext passwords.
2. Open `supabase/sql-editor/NOMAN_BROTHERS_ASSIGN_OWNER_AFTER_AUTH.sql`. Replace its `owner_email` placeholder with the exact confirmed email and paste it into the **same** project's SQL Editor.
3. The script checks that the Auth user exists, has a confirmed email and that no other user currently holds a privileged CMS role. It assigns `raw_app_meta_data.nb_role='owner'` without overwriting other metadata. It refuses ambiguous or missing users. You can safely repeat it for the same verified account.
4. Sign out of Studio, then sign back in. The role must appear in the renewed Supabase JWT and cannot be changed by the public site.

**Important:** Owner email/password are **not** credentials for the Supabase organization Dashboard. They are Supabase **Auth user credentials** for `/studio`; the Dashboard owner separately controls billing and infrastructure. Protect both.

## Edge Function — separate required deployment

The CMS uses `supabase/functions/nb-media-approval/index.ts` for authorized media approval, revocation, archive and hard delete. Deploy that function to the **same** client project (JWT required):

```bash
supabase login
supabase link --project-ref YOUR_CLIENT_PROJECT_REF
supabase functions deploy nb-media-approval --project-ref YOUR_CLIENT_PROJECT_REF
```

A successful SQL script without this function does **not** make media approval work.

## Vercel — match both environment variables

Under the client's Vercel project Settings → Environment Variables (Production), configure:

```dotenv
VITE_SUPABASE_URL=https://YOUR_CLIENT_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_EXACT_KEY_FROM_THAT_PROJECT
```

Never put a `service_role` key, `sb_secret_*` key or password in `VITE_*`. Rebuild/redeploy Production after changing these variables—Vite embeds them into browser JavaScript when it builds. For previews use a separate test database or avoid exposing production data.

## Operational integrity checks

Use `docs/CLIENT_ONBOARDING.md` for the complete handoff and product-creation steps, including SKU batch import, photo matching, independently detached client GitHub repository, and the final acceptance checklist. Existing SKU examples are `NB-SH-00001`, `NB-SU-00001`. Sherwani has **Plain Sherwani** and **Handwork Sherwani**; Suits has **Plain Suits** and **Handwork Suits**.

**Migration history warning:** Running a copy/paste SQL bundle does not insert corresponding version entries in `supabase_migrations.schema_migrations`. Do not subsequently `supabase db push` onto that project until history is reconciled. Prefer versioned CLI migrations from day one if you plan ongoing engineering work. The fresh installer and the individual CLI migrations are *alternative installation paths*, not steps to stack on top of each other.

**No SQL installer, simulated permissions test, or health probe can guarantee complete production readiness.** Verify real Auth role, Storage, media upload, product publish/update, bulk photo matching, SEO, backup/restore, performance and business-owned content with the client before account cleanup.
