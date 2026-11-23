import { loadCataloguePage, loadProductById } from './catalogQueries';

const prefetchedUrls = new Set<string>();

/**
 * Speculative route and data preloader.
 * Fires on link hover or touch so the JS chunk and data are already in memory
 * when the user clicks (~150-300ms before click).
 */
export function prefetchRoute(href: string) {
  if (typeof window === 'undefined') return;
  if (!href || !href.startsWith('/') || href.startsWith('//') || prefetchedUrls.has(href)) return;
  prefetchedUrls.add(href);

  const cleanPath = href.split('?')[0] || '';
  if (cleanPath.startsWith('/products/')) {
    const handle = cleanPath.slice('/products/'.length);
    void import('../components/V2Product');
    void loadProductById(handle);
  } else if (cleanPath === '/' || cleanPath === '/contact') {
    void import('../components/V2Home');
  } else if (cleanPath !== '/search' && !cleanPath.startsWith('/studio')) {
    void import('../components/V2Collection');
    void loadCataloguePage({ route: cleanPath });
  }
}
