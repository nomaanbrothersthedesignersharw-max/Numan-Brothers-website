import { describe, expect, it } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getSupabaseConfig } from '../api/_supabase';

const ROOT = join(import.meta.dir, '..');

describe('Phase 3: GitHub & Vercel Infrastructure Hardening', () => {
  it('removes all hardcoded Supabase project URLs and publishable keys from api/*.ts', () => {
    const apiDir = join(ROOT, 'api');
    const files = readdirSync(apiDir).filter((f) => f.endsWith('.ts') || f.endsWith('.mjs'));
    expect(files.length).toBeGreaterThan(5);

    for (const file of files) {
      const content = readFileSync(join(apiDir, file), 'utf8');
      expect(content).not.toContain('uinhybkdzevpxnugtvzf');
      expect(content).not.toContain('sb_publishable_h3Bat2');
    }
  });

  it('getSupabaseConfig fails cleanly when env vars are missing or malformed', () => {
    expect(getSupabaseConfig({})).toBeNull();
    expect(getSupabaseConfig({ VITE_SUPABASE_URL: 'http://insecure.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_valid12345678' })).toBeNull();
    expect(getSupabaseConfig({ VITE_SUPABASE_URL: 'https://demo.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'service_role_secret' })).toBeNull();

    const valid = getSupabaseConfig({
      VITE_SUPABASE_URL: 'https://demo-proj.supabase.co/',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_validkey12345678',
    });
    expect(valid).toEqual({
      url: 'https://demo-proj.supabase.co',
      key: 'sb_publishable_validkey12345678',
    });
  });

  it('configures grouped weekly Dependabot updates for npm and GitHub Actions', () => {
    const dep = readFileSync(join(ROOT, '.github', 'dependabot.yml'), 'utf8');
    expect(dep).toContain('package-ecosystem: "npm"');
    expect(dep).toContain('package-ecosystem: "github-actions"');
    expect(dep).toContain('groups:');
  });

  it('aligns README.md to the active repository and variable-driven deployment URLs', () => {
    const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
    expect(readme).not.toContain('helloalifstudio-coder');
    expect(readme).toContain('nomaanbrothersthedesignersharw-max/Numan-Brothers-website');
    expect(readme).toContain('SITE_CANONICAL_URL');
    expect(readme).toContain('PROD_BASE_URL');
  });

  it('wires global client error monitoring in src/main.tsx', () => {
    const main = readFileSync(join(ROOT, 'src', 'main.tsx'), 'utf8');
    expect(main).toContain('installGlobalErrorMonitoring');
  });
});
