# Nomaan Brothers — final client-owned handoff

## Source of truth and ownership

The client owns exactly **one designated production instance**:
1. Their independent GitHub repository, with `main` as its only permanent branch.
2. Their existing Vercel project, connected to **that client's GitHub `main`**.
3. **One designated Supabase production project**. It contains **one database**, with indexed department and collection columns separating Men's/Kids' inventory; do **not** make a separate database for every category.
4. **One verified client owner account** with server-controlled `app_metadata.nb_role = "owner"`. The owner uses their own private email and password. There is no hardcoded admin PIN or public role-creation API.

The agency demo Supabase/Vercel deployments are separate, and **must not be pointed at the client production project**. Two Supabase organizations do not conflict merely by existing; using the URL/key of one project while tables/Auth are installed on another is the actual configuration risk.

## 0. Freeze a working independent GitHub copy

- Wait until agency `main` passes GitHub Actions and matches the release commit; then **Sync fork** in the client account and confirm identical `main` commit. Capture a backup locally.
- Verify the client Vercel project is connected to their fork and Production Branch is `main`.
- Only then, in the client's repository: **Settings → General → Danger Zone → Leave fork network** (if GitHub offers it). Detaching is permanent and may remove fork GitHub metadata (issues, PRs, wiki, stars, watchers, comments and child forks). Preserve what the client needs first. See https://docs.github.com/en/pull-requests/how-tos/work-with-forks/detaching-a-fork
- Reconfirm the standalone repository URL, its `main` SHA and Vercel Git connection **after** detach. Do not delete the client's working repository to detach.
- For future changes, the client repo—not agency upstream—is the source of truth. Require CI, disable force pushes and protect `main` where available.

## 1. Resolve the duplicate Supabase projects **without deleting data**

- In **client Vercel → Project → Settings → Environment Variables**, note which production `VITE_SUPABASE_URL` is configured. The segment before `.supabase.co` identifies its exact project ref.
- In **client Supabase Dashboard**, locate that project ref and its **own** Project Settings → API Keys → **publishable** key (`sb_publishable_...`).
- Decide whether to **keep that project** or to select another empty project as the single production target. If changing target, update BOTH Vercel variables, redeploy, and test Auth/database before retiring the unused project.
- A Supabase organization is not the same as a project. Do not delete an organization until all projects, backups, Auth users, storage media, billing and client-owned access have been inventoried and explicitly approved for removal.
- Only run a fresh installer in a project with **no** Noman `nb_*` tables, `nb_*` functions or Noman media buckets. An organization or project cannot be reset by merely switching Vercel variables.

## 2. Install Supabase schema: choose exactly one method

**A. Empty project (recommended for a truly clean client installation)**

Open `supabase/sql-editor/NOMAN_BROTHERS_INSTALL_FRESH_PROJECT.sql` in the final client GitHub `main`, click **Raw**, copy the entire SQL text starting with `--` or `BEGIN;` and ending with `COMMIT;`, paste into **that exact project's SQL Editor**, run once. It contains **16 ordered migrations** inside one transaction: 15 `nb_*` application tables, RLS, role functions, category taxonomy, SKU counters, revisions, private staging/public approved media buckets, media lifecycle protection and scalability indexes. It seeds **categories only**, no fake products or client records.

**B. Existing project with all 15 `nb_*` tables**

Use `supabase/sql-editor/NOMAN_BROTHERS_COMPLETE_EXISTING_TABLES.sql` instead **after taking a backup** and inspecting actual schema/data. This reconciles the existing installation; it is not the blank-project installer. Do not use on a half-initialized unrelated schema without checking the exact error and missing objects first.

**Never paste both installers in sequence.** Never re-run destructive/reset scripts to silence a failed migration. SQL Editor installations do **not** automatically mark individual CLI migrations as applied, so reconcile migration history before using `supabase db push` on that same project. The one-paste path and CLI migration path are alternatives, not cumulative setup steps.

Then run the read-only script `supabase/sql-editor/NOMAN_BROTHERS_VERIFY_READ_ONLY.sql`, inspect Table Editor, RLS policies, functions, Storage bucket privacy and Database Advisors. SQL installs schema; it does **not** create authentication passwords or deploy Deno Edge Functions.

## 3. Create **one** owner login

1. In the **same project**, go to Supabase **Authentication → Users → Add user**. Create the real client/agency-authorized CMS editor email with a strong unique password. Confirm the email using the owner's approved channel. Do not put the password in SQL, GitHub or Vercel. Disable public signups for this staff-only CMS, configure Auth email/rate limits and enable MFA/leaked-password protection where the account plan allows.
2. Open `supabase/sql-editor/NOMAN_BROTHERS_ASSIGN_OWNER_AFTER_AUTH.sql`, edit its **single owner_email placeholder** to the real verified Gmail, then run it in the SQL Editor of the **same** project. It refuses a missing/unconfirmed user and existing conflicting staff roles. It only sets `auth.users.raw_app_meta_data.nb_role = "owner"` and preserves other Auth metadata.
3. Sign out and back in at `https://YOUR-VERCEL-SITE/studio` to refresh JWT claims. An owner can create drafts, approve/revoke media, publish/edit/archive products, change categories and edit/publish website content.
4. The CMS supports `editor` and `admin` internally, but you need only **one** `owner` account. Do not create extra staff users unless required; `user_metadata` is not an authorization source. Never assign `nb_role` from frontend JavaScript or a public RPC.

## 4. Deploy the **required** privileged media Edge Function

The database installer cannot deploy code. Run from the **client repository**, after checking the linked project ref:

```bash
supabase --version
supabase login
supabase link --project-ref YOUR_CLIENT_PROJECT_REF
supabase functions deploy nb-media-approval --project-ref YOUR_CLIENT_PROJECT_REF
```

File: `supabase/functions/nb-media-approval/index.ts`. Keep `verify_jwt = true`. This function rechecks current owner/admin `app_metadata` before copying private uploads into the approved public bucket, and denies delete/archive/revoke when products or pages still use a file. Check that the function shows **ACTIVE** in that client's dashboard. This operation must be repeated for every *different Supabase project*.

## 5. Correct Vercel connection and deploy

In **client Vercel project → Settings → Environment Variables → Production**, enter:

```dotenv
VITE_SUPABASE_URL=https://YOUR_CLIENT_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_CLIENT_PUBLIC_KEY
```

Use only the matching key for the same URL. Do **not** expose `sb_secret_*`, `service_role`, client Gmail credentials, access tokens or PostgreSQL passwords under any `VITE_*` variable. Rebuild/redeploy **Production** after saving environment variables; Vite embeds values at build time. Do not reuse the agency project's credentials or point public PR previews to the live customer database.

When the owner approves a real domain and brand/legal content, configure `SITE_CANONICAL_URL`, Supabase Auth site/redirect URLs and Vercel domains; until then keep guarded non-indexable review behavior. Confirm direct refresh for `/studio`, `/men`, `/kids` and `/products/... `.

## 6. Everyday owner workflow — **one product**

1. Studio → **Products → New product**.
2. Choose **Men's/Kids' Wear**, then required garment category: e.g., Sherwani → Plain Sherwani, Sherwani → Handwork Sherwani, or Suits → Handwork/Plain Suits.
3. Supabase atomically reserves the permanent SKU, e.g. **NB-SH-00001** or **NB-SU-00001**. Do not change it, even when editing; each garment retains a UUID database primary key too. A cancelled draft may leave a serial gap—this is safe and preferable to reusing an issued identifier.
4. Fill title, fabric, sizes, price, description. Drag genuine photos directly into this product. The approved owner upload is copied to public storage through the protected function and attached to the private draft.
5. **Save private draft → Publish product**. The SKU can be searched in Studio and its direct public link is `/products/NB-SH-00001`.
6. To edit a published garment, search by title/SKU, select **Edit published product**, change details/photos and select **Update published product**. The published revision is immutable history, while the new version replaces the visible catalogue record. Use **Archive** to hide a product. Discarding a draft does not delete its last published version.

## 7. Bulk products and photos without confusing filenames

**Products CSV:** required fields `title,department,category`, optional `sku,sizes,fabric,description,price`. Leave SKU blank and the server reserves one automatically for each row, persisting the reservation so retries reuse the same SKU. Download the generated **product SKU mapping CSV** immediately after import. Products remain private drafts pending review.

**One product's camera photos:** In Studio → Bulk imports, choose **Men's/Kids' and garment category**, copy the product SKU (e.g. NB-SH-00001), paste it into **Assign all photos to one SKU**, and select phone/camera photos. The client renames them `NB-SH-00001_01.jpg`, `NB-SH-00001_02.jpg`, etc. This is **filename labeling**; no image-recognition guessing. Uploads are private until an owner approves them.

**Many products in one photo batch:** Rename each file in advance as `SKU_01.jpg`, `SKU_02.jpg`, then upload batches grouped by department and category. Use **Media Library → Approve** and **Bulk imports → Match approved photos to drafts**. The matcher only fills empty galleries and preserves any manually arranged photos. Review the images before publishing.

Supported product/media scale depends on Supabase plan, image sizes and observed query latency. The app has pagination/indexes and import replay but there is no guaranteed 10,000+ benchmark until tested with representative content.

## 8. Acceptance / only then remove unused accounts

Test owner sign-in and sign-out, refresh, public visitor cannot read private drafts, create/publish/edit/archive/republish, correct SKU/photo mapping, approve/revoke/delete unused files, media protection on in-use files, import retries, mobile screens, SEO and WhatsApp enquiry. Run the repository CI and use:

```bash
EXPECTED_SUPABASE_PROJECT_REF=YOUR_CLIENT_PROJECT_REF node scripts/check-client-cms.mjs
node scripts/smoke-deployment.mjs https://YOUR_CLIENT_VERCEL_DOMAIN
```

Keep the old Supabase project and Vercel deployment until the new setup is backed up, verified and owner-approved; only then consider deleting the unused Supabase project/organization. Do not delete the agency account, which hosts other clients. Complete owner sign-off includes security advisors, password policies, backups/recovery, legitimate images, legal policies and the verified Instagram profile.
