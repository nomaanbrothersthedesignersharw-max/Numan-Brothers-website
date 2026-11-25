import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');

describe('Core Web Vitals & Performance Architecture', () => {
  it('eliminates motion/react from initial storefront critical path', () => {
    for (const file of [
      join(ROOT, 'src', 'components', 'V2Reveal.tsx'),
      join(ROOT, 'src', 'components', 'V2Header.tsx'),
      join(ROOT, 'src', 'components', 'V2Home.tsx'),
    ]) {
      const content = readFileSync(file, 'utf8');
      expect(content).not.toContain('motion/react');
      expect(content).not.toContain('framer-motion');
    }
  });

  it('self-hosts Inter and Playfair Display fonts with metric-matched fallbacks and no Google Fonts stylesheet', () => {
    const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
    expect(html).not.toContain('fonts.googleapis.com');
    expect(html).not.toContain('fonts.gstatic.com');
    expect(html).toContain('fetchpriority="high"');

    const main = readFileSync(join(ROOT, 'src', 'main.tsx'), 'utf8');
    expect(main).toContain('@fontsource-variable/inter');
    expect(main).toContain('@fontsource-variable/playfair-display');

    const css = readFileSync(join(ROOT, 'src', 'index.css'), 'utf8');
    expect(css).toContain('font-family: "Inter Fallback"');
    expect(css).toContain('font-family: "Playfair Fallback"');
    expect(css).toContain('size-adjust:');
    expect(css).toContain('ascent-override:');
  });

  it('keeps V2Product and V2Collection lazy-loaded in App.tsx', () => {
    const app = readFileSync(join(ROOT, 'src', 'App.tsx'), 'utf8');
    expect(app).toContain("React.lazy(() => import('./components/V2Collection'))");
    expect(app).toContain("React.lazy(() => import('./components/V2Product'))");
  });
});
