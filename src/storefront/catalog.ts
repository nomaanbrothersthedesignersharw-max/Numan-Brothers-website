import { Product } from '../types';
import { isCollectionPath, normalizePath } from './navigation';

/**
 * Legacy products are mapped conservatively. Unrecognized garments aren't
 * misrepresented as other categories; owners can later assign collectionPaths
 * on approved product records from their CMS/ERP.
 */
export type CatalogProduct = Product & {
  collectionPaths?: string[];
  collectionPath?: string;
  department?: 'men' | 'kids';
  published?: boolean;
  isPublished?: boolean;
  videoUrl?: string;
  videoUrls?: string[];
  slug?:string;
  sku?:string;
  originalPrice?:number;
  offerPrice?:number;
  customizable?:boolean;
};

const words = (p: Product): string =>
  [p.title || '', p.category || '', p.type || ''].join(' ').toLowerCase();

export const productPaths = (p: CatalogProduct): string[] => {
  if (p.published === false || p.isPublished === false) return [];
  const assigned = [
    ...(Array.isArray(p.collectionPaths) ? p.collectionPaths : []),
    ...(typeof p.collectionPath === 'string' ? [p.collectionPath] : []),
  ].map(normalizePath).filter(isCollectionPath);
  if (assigned.length) return Array.from(new Set(assigned));

  const name = words(p);
  const kids = p.department === 'kids' || /\bkids?\b|\bchildren\b|\bboys?\b/.test(name);
  const prefix = kids ? '/kids' : '/men';
  const paths: string[] = [];
  if (/\bsherwani\b|\bsherwanis\b/.test(name)) {
    paths.push(prefix + '/sherwani');
    if (!kids) {
      if (/hand|zardozi|embroider|zari|mirror.work|velvet/i.test(name)) {
        paths.push('/men/sherwani/handwork');
      } else if (/\bplain\b/i.test(name)) {
        paths.push('/men/sherwani/plain');
      }
    }
  } else if (/\bjodhpuri\b|\bbandhgala\b/.test(name)) {
    paths.push(prefix + '/jodhpuri');
  } else if (/\bpathani\b/.test(name)) {
    paths.push(prefix + '/pathani');
  } else if (/\bkurta\b|\bkurtas\b|\bpyjama\b|\bpajama\b/.test(name)) {
    paths.push(prefix + '/kurta-pyjama');
  } else if (/\btobh\b|\btob\b|\btope\b|\btopi\b|\bcap\b/.test(name)) {
    paths.push(prefix + '/tope');
  } else if (/\bsadri\b|\bsadiri\b|\bsadi\b/.test(name)) {
    paths.push(kids ? '/kids/sadi' : '/men/marriage/sadi');
  } else if (/\bsuit\b|\bsuits\b/.test(name)) {
    paths.push(prefix + '/suits');
    if (!kids) {
      if (/\bhandwork\b|\bembroider\b|\bzardozi\b/.test(name)) paths.push('/men/suits/handwork');
      if (/\bplain\b/.test(name)) paths.push('/men/suits/plain');
    }
  } else if (!kids && /\bjooti\b|\bjhooti\b|\bjutti\b|\bmojaris?\b/.test(name)) {
    paths.push('/men/marriage/jutti');
  } else if (!kids && /\bpagdi\b|\bsafa\b|\bturban\b/.test(name)) {
    paths.push('/men/marriage/pagdi');
  }
  return Array.from(new Set(paths.filter(isCollectionPath)));
};

export const inCollection = (product: CatalogProduct, path: string): boolean => {
  const base = normalizePath(path);
  return productPaths(product).some((p) => p === base || p.startsWith(base + '/'));
};
export const productsForCollection = (products: CatalogProduct[], path: string): CatalogProduct[] =>
  products.filter((product) => inCollection(product, path));
export const publicProducts = (products: CatalogProduct[]): CatalogProduct[] =>
  products.filter((product) => productPaths(product).length > 0);
/** Public catalogue uses the unique product slug; existing UUID links still work. */
export const isProductSlug=(slug:unknown):slug is string =>
  typeof slug==='string' && slug.length<=120 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
export const productPath=(product:Pick<Product,'id'> & {slug?:string}):string =>
  '/products/'+encodeURIComponent(isProductSlug(product.slug)?product.slug:product.id);
export const productImage = (product: Product): string => {
  const images = Array.isArray(product.images) ? product.images.filter((image) => /^https:\/\//.test(image)) : [];
  return images.find((image) => !image.includes('img.youtube.com')) || images[0] || '';
};
