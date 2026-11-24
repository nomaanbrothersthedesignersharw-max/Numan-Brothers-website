import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildCatalogueCsv, clearLocalDraft, loadLocalDraft, saveLocalDraft } from '../src/lib/draftRecovery';
import { computeFileSha256, deduplicateUploadBatch } from '../src/lib/cmsUpload';

const ROOT = join(import.meta.dir, '..');

function makeMemoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, v); },
    removeItem: (k: string) => { map.delete(k); },
  };
}

describe('Phase 4: Admin Studio & CMS Modernization', () => {
  it('saves, loads, and clears resilient local product drafts', () => {
    const store = makeMemoryStorage();
    expect(loadLocalDraft('product:abc', store)).toBeNull();

    const saved = saveLocalDraft('product:abc', { title: 'Royal Sherwani', sku: 'NB-SH-00010' }, store);
    expect(saved).toBe(true);

    const loaded = loadLocalDraft<{ title: string; sku: string }>('product:abc', store);
    expect(loaded?.data.title).toBe('Royal Sherwani');
    expect(loaded?.data.sku).toBe('NB-SH-00010');

    clearLocalDraft('product:abc', store);
    expect(loadLocalDraft('product:abc', store)).toBeNull();
  });

  it('exports RFC-4180 compliant catalogue CSV with proper quoting', () => {
    const csv = buildCatalogueCsv([
      {
        sku: 'NB-SU-00003',
        title: 'Obsidian "Crystal", Gold Suit',
        department: 'men',
        category_paths: ['/men/suits/handwork'],
        fabric: 'Worsted Wool',
        sizes: ['38', '40'],
        price: 8499,
        offer_price: 7499,
        customizable: true,
        status: 'published',
        slug: 'obsidian-suit',
      },
    ]);
    expect(csv).toContain('SKU,Title,Department,Categories');
    expect(csv).toContain('"Obsidian ""Crystal"", Gold Suit"');
    expect(csv).toContain('"38, 40"');
    expect(csv).toContain(',Yes,published,obsidian-suit');
  });

  it('deduplicates identical files in an upload batch by SHA-256 content hash', async () => {
    const f1 = new File([new Uint8Array([1, 2, 3, 4])], 'front.webp', { type: 'image/webp' });
    const f2 = new File([new Uint8Array([1, 2, 3, 4])], 'front-copy.webp', { type: 'image/webp' });
    const f3 = new File([new Uint8Array([5, 6, 7, 8])], 'back.webp', { type: 'image/webp' });

    const h1 = await computeFileSha256(f1);
    const h2 = await computeFileSha256(f2);
    const h3 = await computeFileSha256(f3);
    expect(h1).toBe(h2);
    expect(h1).not.toBe(h3);

    const { unique, duplicateNames } = await deduplicateUploadBatch([f1, f2, f3]);
    expect(unique.map((f) => f.name)).toEqual(['front.webp', 'back.webp']);
    expect(duplicateNames).toEqual(['front-copy.webp']);
  });

  it('expands nb_audit_events migration for archive, delete, and review moderation', () => {
    const sql = readFileSync(
      join(ROOT, 'supabase', 'migrations', '20261125030000_phase4_audit_and_atomic_publish.sql'),
      'utf8',
    );
    expect(sql).toContain('product_archived');
    expect(sql).toContain('product_deleted');
    expect(sql).toContain('media_deleted');
    expect(sql).toContain('review_moderated');
    expect(sql).toContain('review_deleted');
    expect(sql).toContain('nb_record_lifecycle_event');
  });

  it('includes scheduled backup and schema verification workflow', () => {
    const wf = readFileSync(join(ROOT, '.github', 'workflows', 'backup-verify.yml'), 'utf8');
    expect(wf).toContain('pg_dump');
    expect(wf).toContain('postgres:17');
    expect(wf).toContain('workflow_dispatch');
  });
});
