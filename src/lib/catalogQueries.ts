import type { CatalogProduct } from '../storefront/catalog';
import { COLLECTION_ROUTES } from '../storefront/navigation';
import { rowToProduct, type CmsProductRow } from './cmsData';
import { readPublicJson } from './publicApi';

export const PUBLIC_PAGE_SIZE = 24;
export interface CataloguePage {
  products: CatalogProduct[];
  page: number;
  pageSize: number;
  hasMore: boolean;
  error: string | null;
}
const empty = (page: number, error: string | null): CataloguePage => ({
  products: [], page, pageSize: PUBLIC_PAGE_SIZE, hasMore: false, error,
});

export function safeCatalogueSearch(value: string): string {
  // Keep PostgREST filter grammar out of the search expression and bound input.
  return value.normalize('NFKC').replace(/[^a-zA-Z0-9 -]/g, ' ').trim().replace(/\s+/g, ' ').slice(0, 72);
}
export function collectionFilterPaths(route: string): string[] {
  return COLLECTION_ROUTES.filter((item) => item.path === route || item.path.startsWith(route + '/'))
    .map((item) => item.path);
}

interface CatalogueResponse {
  products?: CmsProductRow[];
  hasMore?: boolean;
}
interface ProductResponse { product?: CmsProductRow | null }
interface RelatedResponse { products?: CmsProductRow[] }

export async function loadCataloguePage(
  options: { route?: string; query?: string; page?: number },
): Promise<CataloguePage> {
  const page = Math.max(0, Math.min(10_000, Math.floor(options.page || 0)));
  const query = safeCatalogueSearch(options.query || '');
  if (options.query && !query) return empty(page, null);

  const params = new URLSearchParams();
  if (options.route) params.set('route', options.route);
  if (query) params.set('q', query);
  params.set('page', String(page));

  try {
    const result = await readPublicJson<CatalogueResponse>('/api/catalogue?' + params.toString(), 15_000);
    const rows = Array.isArray(result.products) ? result.products : [];
    return {
      products: rows.map(rowToProduct),
      page,
      pageSize: PUBLIC_PAGE_SIZE,
      hasMore: Boolean(result.hasMore),
      error: null,
    };
  } catch (error) {
    return empty(page, error instanceof Error ? error.message : 'Unable to load the published catalogue.');
  }
}

const isUuid = (handle: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(handle);
const isSku = (handle: string) => /^NB-[A-Z]{2,3}-[0-9]{5}$/.test(handle);
export const isValidProductHandle = (handle: string): boolean =>
  handle.length <= 120 && (isUuid(handle) || isSku(handle) || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(handle));

/** Product reads are public-only and cached at the edge; UUID and slug links remain valid. */
export async function loadProductById(handle: string): Promise<CatalogProduct | null> {
  if (!isValidProductHandle(handle)) return null;
  try {
    const result = await readPublicJson<ProductResponse>(
      '/api/catalogue?' + new URLSearchParams({ product: handle }).toString(),
      30_000,
    );
    return result.product ? rowToProduct(result.product) : null;
  } catch {
    return null;
  }
}

/** Bounded published-only recommendations; no direct browser-to-database fan-out. */
export async function loadRelatedProducts(product: CatalogProduct, limit = 4): Promise<CatalogProduct[]> {
  const route = product.collectionPaths?.[0];
  if (!route || !isUuid(product.id)) return [];
  const count = Math.min(6, Math.max(1, Math.floor(limit)));
  try {
    const params = new URLSearchParams({
      related: product.id,
      route,
      limit: String(count),
    });
    const result = await readPublicJson<RelatedResponse>('/api/catalogue?' + params.toString(), 30_000);
    return (Array.isArray(result.products) ? result.products : []).map(rowToProduct);
  } catch {
    return [];
  }
}
