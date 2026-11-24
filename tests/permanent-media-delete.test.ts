import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';
import { extractMediaStoragePath } from '../src/components/studio/StudioShared';

describe('Permanent image and video deletion in Studio', () => {
  test('extracts storage path cleanly from public Supabase media URLs', () => {
    const sample =
      'https://uinhybkdzevpxnugtvzf.supabase.co/storage/v1/object/public/nb-media-public/1bbd7445-4636-41f9-8fab-d5ed86b224a5/0bf01935-2554-4e6b-b8f2-6c75342ecd1e.mp4?t=1';
    expect(extractMediaStoragePath(sample)).toBe(
      '1bbd7445-4636-41f9-8fab-d5ed86b224a5/0bf01935-2554-4e6b-b8f2-6c75342ecd1e.mp4',
    );
  });

  test('wires permanentlyDeleteMedia across Media library, AssetEditor, and Product delete (images + videos)', () => {
    const shared = readFileSync('src/components/studio/StudioShared.tsx', 'utf8');
    const media = readFileSync('src/components/studio/CmsMedia.tsx', 'utf8');
    const editor = readFileSync('src/components/studio/AssetEditor.tsx', 'utf8');
    const products = readFileSync('src/components/studio/CmsProducts.tsx', 'utf8');

    expect(shared).toContain('nb_delete_media_permanently');
    expect(shared).toContain("from('nb-media-public').remove");
    expect(shared).toContain("from('nb-media-staging').remove");
    expect(media).toContain('permanentlyDeleteMedia');
    expect(editor).toContain('permanentlyDeleteMedia');
    expect(products).toContain('permanentlyDeleteMedia');
    expect(products).toContain('...form.videoUrls');
  });
});
