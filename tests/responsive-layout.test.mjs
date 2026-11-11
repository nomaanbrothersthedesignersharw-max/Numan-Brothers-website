import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const src = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('mobile navigation remains reachable throughout tablet breakpoints', () => {
  const header = src('src/components/V2Header.tsx');
  assert.match(header, /className="flex items-center lg:hidden"/);
  assert.match(header, /className="hidden items-center gap-2 lg:flex"/);
  assert.match(header, /className="fixed inset-0 z-\[70\] lg:hidden"/);
  assert.doesNotMatch(header, /className="flex items-center md:hidden"/);
});

test('mobile CMS navigation scrolls instead of filling the viewport', () => {
  const studio = src('src/components/CmsStudio.tsx');
  assert.match(studio, /overscroll-x-contain/);
  assert.match(studio, /shrink-0 items-center gap-2 whitespace-nowrap/);
  assert.match(studio, /lg:grid-cols-\[245px_minmax\(0,1fr\)\]/);
});

test('homepage renders an approved menswear image and scales headings down', () => {
  const home = src('src/components/V2Home.tsx');
  assert.match(home, /home\.menImage \|\| getImage\('\/men'\) \|\| '\/editorial\/sherwani\.svg'/);
  assert.match(home, /break-words text-\[clamp\(2\.8rem,10vw,8\.1rem\)\]/);
});

test('CMS product forms and asset controls work on narrow layouts', () => {
  assert.match(src('src/components/studio/CmsProducts.tsx'), /max-h-60 space-y-2/);
  assert.match(src('src/components/studio/AssetEditor.tsx'), /flex flex-wrap items-center justify-between gap-1 bg-white/);
  assert.match(src('src/components/studio/StudioShared.tsx'), /text-base text-stone-900 sm:text-sm/);
});

test('product CTAs keep room for mobile safe areas', () => {
  const product = src('src/components/V2Product.tsx');
  assert.match(product, /pb-24 lg:pb-0/);
  const dock = src('src/components/FloatingContactDock.tsx');
  assert.match(dock, /env\(safe-area-inset-bottom\)/);
  assert.match(dock, /min-h-13 min-w-13/);
  assert.doesNotMatch(product, /fixed inset-x-0 bottom-0/);
  assert.match(src('src/components/V2Collection.tsx'), /min-\[360px\]:grid-cols-2/);
});

test('phone, tablet and desktop widths use minmax grids and fluid assets',()=>{
  const css=src('src/index.css');
  assert.match(css,/nb-responsive-grid/);
  assert.match(css,/overflow-wrap: anywhere/);
  assert.match(css,/:where\(input, select, textarea, progress\)/);
  const home=src('src/components/V2Home.tsx');
  assert.match(home,/sm:grid-cols-2 xl:grid-cols-3/);
  assert.match(home,/lg:grid-cols-\[minmax\(0,.93fr\)_minmax\(0,1.07fr\)\]/);
  const footer=src('src/components/V2Footer.tsx');
  assert.match(footer,/xl:grid-cols-\[minmax\(0,1.5fr\)_repeat\(3,minmax\(0,1fr\)\)\]/);
});
test('Studio offers sticky mobile section navigation and responsive forms',()=>{
  const s=src('src/components/CmsStudio.tsx');
  assert.match(s,/Switch Studio section/);
  assert.match(s,/sticky top-0 z-30/);
  const fields=src('src/components/studio/StudioShared.tsx');
  assert.match(fields,/min-w-0 max-w-full/);
  assert.match(fields,/whitespace-normal text-center/);
  for(const p of ['CmsProducts','CmsMedia','CmsImports','CmsCategories','AssetEditor','CmsHomepage']){
    assert.match(src('src/components/studio/'+p+'.tsx'),/nb-responsive-grid|overflow-x-auto/);
  }
});


test('desktop department mega-menu uses a two-column tablet layout before expanding on wide screens', () => {
  const header = src('src/components/V2Header.tsx');
  assert.match(header, /grid-cols-2 xl:grid-cols-4/);
  assert.match(header, /nb-responsive-grid grid gap-5 xl:gap-9/);
});

test('Studio data tables and control groups stay inside the viewport on phones', () => {
  const css = src('src/index.css');
  assert.match(css, /\.nb-studio :where\(table\)[\s\S]*?overflow-x: auto/);
  assert.match(css, /\.nb-studio :where\(\.grid, \.flex\) > \*[\s\S]*?min-width: 0/);
  assert.match(css, /\.nb-studio :where\(button, a, \[role="button"\]\)[\s\S]*?min-height: 44px/);
  assert.match(css, /input\[type="checkbox"\], input\[type="radio"\]/);
});


test('Instagram control scales from phone to desktop and wraps within its parent column', () => {
  const social = src('src/components/SocialLinks.tsx');
  assert.match(social, /size-12[^\n]*sm:size-14/);
  assert.match(social, /h-6 w-6[^\n]*sm:h-7 sm:w-7/);
  assert.match(social, /flex w-full min-w-0 max-w-full flex-wrap/);
  assert.match(social, /data-testid="social-instagram-link"/);
  assert.match(social, /data-testid="social-instagram-pending"/);
  const footer = src('src/components/V2Footer.tsx');
  assert.match(footer, /mt-7 w-full min-w-0 border-t/);
  const app = src('src/App.tsx');
  assert.match(app, /mt-10 w-full min-w-0 border-t/);
});

test('responsive browser audit covers every taxonomy route and narrow through ultrawide screens', () => {
  const smoke = src('scripts/qa-browser-smoke.mjs');
  for (const route of [
    '/men','/men/kurta-pyjama','/men/pathani','/men/jodhpuri','/men/tope',
    '/men/sherwani','/men/sherwani/handwork','/men/sherwani/plain',
    '/men/suits','/men/suits/handwork','/men/suits/plain','/men/marriage',
    '/men/marriage/jutti','/men/marriage/pagdi','/men/marriage/sadi',
    '/kids','/kids/kurta-pyjama','/kids/sherwani','/kids/pathani',
    '/kids/sadi','/kids/suits','/kids/jodhpuri','/kids/tope',
    '/contact','/search?q=sherwani','/privacy-policy',
    '/terms-and-conditions','/returns-and-exchanges'
  ]) assert.ok(smoke.includes("'" + route + "'"), 'responsive matrix includes ' + route);
  assert.match(smoke, /\[280,653\][\s\S]*\[2560,1440\]/);
  assert.match(smoke, /const representative=\[\[280,720\][\s\S]*\[1920,1080\]\]/);
  assert.match(smoke, /PASS_SOCIAL_RESPONSIVE/);
  assert.match(smoke, /PASS_SOCIAL_PENDING_RESPONSIVE/);
});
