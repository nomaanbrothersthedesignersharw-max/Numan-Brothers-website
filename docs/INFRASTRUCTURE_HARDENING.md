# Nomaan Brothers — Infrastructure Hardening Guide (Phase 3)

This guide documents the GitHub, Vercel, and observability configuration paired with the Phase 3 codebase hardening (`api/_supabase.ts`, `.github/dependabot.yml`, `src/lib/errorMonitoring.ts`).

---

## 1. Main Branch Protection (#15)

In **GitHub → Settings → Rules → Rulesets → New branch ruleset**:

- **Ruleset name:** `Protect main`
- **Target branch:** `main`
- **Enforcement status:** `Active`
- **Rules to enable:**
  - Restrict deletions
  - Block force pushes
  - Require a pull request before merging (at least 1 approval for multi-maintainer teams)
  - Require status checks to pass before merging:
    - `typecheck-and-build`
    - `browser-ui-smoke`
    - `postgres-rls-checks` (when enabled)

---

## 2. Dependency Management (#16)

`.github/dependabot.yml` schedules weekly Monday (06:00 IST) grouped pull requests for:
- Production minor/patch npm packages
- Development minor/patch npm packages
- GitHub Actions workflow pins

Major version upgrades of `react`, `react-dom`, and `vite` are intentionally ignored by Dependabot so they are tested manually in a dedicated branch before upgrading.

---

## 3. Strict Environment Variables (#17)

All Vercel API routes now resolve Supabase configuration exclusively through `api/_supabase.ts` (`getSupabaseConfig()`) with **zero hardcoded project URLs or keys**.

Ensure these variables are set in **Vercel Project → Settings → Environment Variables** for both **Production** and **Preview**:

| Variable | Scope | Value |
| :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | Production & Preview | `https://<project-ref>.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Production & Preview | `sb_publishable_...` |
| `SITE_CANONICAL_URL` | Production | `https://<your-custom-domain>` (no trailing slash) |
| `VITE_ERROR_REPORT_URL` | Optional | HTTPS ingest URL for Axiom / Better Stack / Sentry relay |

If `VITE_SUPABASE_URL` or `VITE_SUPABASE_PUBLISHABLE_KEY` is missing or malformed, API routes fail loudly with HTTP `503` and emit a structured `*_unconfigured` JSON log event.

---

## 4. Deployment & CI URL Alignment (#18)

In **GitHub → Settings → Secrets and variables → Actions → Variables**, set:
- `PROD_BASE_URL` = `https://<your-live-vercel-or-custom-domain>`
- `STUDIO_BASE_URL` = `https://<your-live-vercel-or-custom-domain>` (same origin unless split)

`quality.yml` reads these variables for post-deploy live smoke tests instead of hardcoded legacy hostnames.

---

## 5. Error Monitoring & Log Retention (#19)

Vercel Hobby retains runtime logs for only 1 hour. To retain historical API and client errors:
1. **Serverless API logs:** Every API route logs single-line JSON via `logApiEvent()` (`ts`, `level`, `service`, `env`, `event`, metadata). Connect **Axiom** or **Better Stack** from the Vercel Marketplace (free tier) to drain logs automatically.
2. **Client runtime errors:** `src/lib/errorMonitoring.ts` captures uncaught `error` and `unhandledrejection` events. Set `VITE_ERROR_REPORT_URL` in Vercel to forward browser error beacons to your ingest endpoint.

---

## 6. Branded Production Domain (#20)

1. Open **Vercel → Project → Settings → Domains** and add your custom domain (e.g., `nomaanbrothers.com` and `www.nomaanbrothers.com`).
2. Configure the apex `A` record (`76.76.21.21`) and `www` `CNAME` (`cname.vercel-dns.com`) at your DNS registrar, redirecting `www` → apex (or vice versa).
3. Wait for automatic Let's Encrypt SSL provisioning.
4. Set `SITE_CANONICAL_URL=https://nomaanbrothers.com` in Vercel Production env vars and redeploy so `/sitemap.xml`, `/sitemap-static.xml`, `/sitemap-products/*.xml`, and `<link rel="canonical">` tags all use the branded domain.
5. Update `PROD_BASE_URL` in GitHub Actions Variables to match.
