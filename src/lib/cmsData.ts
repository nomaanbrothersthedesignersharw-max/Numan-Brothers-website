import type { Product } from '../types';
import type { CatalogProduct } from '../storefront/catalog';
import { getCmsClient } from './supabaseClient';
import { readPublicJson } from './publicApi';
import {cleanSiteText,normalizeOrder,HOME_SECTIONS,FEATURED_CARDS} from './siteContent';

export interface CmsProductRow {
  id: string;
  sku: string;
  slug: string;
  title: string;
  department: 'men' | 'kids';
  category_paths: string[];
  description: string;
  fabric: string;
  sizes: string[];
  image_urls: string[];
  video_url: string | null;
  video_urls?: string[];
  price: number | null;
  offer_price: number | null;
  customizable: boolean;
  status: 'draft' | 'published' | 'archived';
  sort_rank: number;
  created_at: string;
  updated_at: string;
}

export interface CmsMediaRow {
  id: string;
  storage_path: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  alt_text: string;
  department:'men'|'kids'|null;
  category_path:string|null;
  archived_at:string|null;
  approved: boolean;
  uploaded_by: string;
  created_at: string;
}
export interface CmsCategoryRow {
  path: string;
  department: 'men' | 'kids';
  label: string;
  description: string;
  image_url: string | null;
  active: boolean;
  sort_order: number;
}

export const SOCIAL_KEYS = ['instagram','facebook','youtube','pinterest','threads','x','tiktok','snapchat','linkedin'] as const;
export type SocialKey = typeof SOCIAL_KEYS[number];
/** Exact provider hosts, plus their legitimate subdomains. Prevents linking a
 * platform-labeled social icon to an unrelated phishing website. */
const SOCIAL_DOMAINS:Record<SocialKey,readonly string[]>={
  instagram:['instagram.com','instagr.am'],
  facebook:['facebook.com','fb.me','fb.com'],
  youtube:['youtube.com','youtu.be'],
  pinterest:['pinterest.com','pin.it'],
  threads:['threads.com','threads.net'],
  x:['x.com','twitter.com'],
  tiktok:['tiktok.com'],
  snapchat:['snapchat.com'],
  linkedin:['linkedin.com','lnkd.in'],
};
export function isValidSocialProfile(key:SocialKey,value:string):boolean{
  const url=value.trim();
  if(!url || url.length>500 || !isSafeHttps(url))return false;
  try{
    const parsed=new URL(url);
    if(parsed.port || parsed.pathname==='/' && !parsed.searchParams.has('id'))return false;
    const host=parsed.hostname.toLowerCase();
    return SOCIAL_DOMAINS[key].some(domain=>host===domain||host.endsWith('.'+domain));
  }catch{return false;}
}
export const POLICY_KEYS = ['privacy','terms','returns'] as const;
export type PolicyKey = typeof POLICY_KEYS[number];
export type FeaturedImageKey = 'one'|'two'|'three';
export interface CmsHome {
  heroTitle: string;
  heroEyebrow: string;
  heroSubtitle: string;
  heroImage: string;
  menImage: string;
  kidsImage: string;
  storyTitle: string;
  storyDescription: string;
  storyImage: string;
  contactWhatsapp: string;
  contactPhone:string;
  customizationImage:string;
  socialLinks:Record<SocialKey,string>;
  featuredImages:Record<FeaturedImageKey,string>;
  legalPolicies:Record<PolicyKey,string>;
  sectionVideos:Record<string,string>;
  siteText: Record<string,string>;
  sectionOrder: string[];
  hiddenSections: string[];
  featuredOrder: string[];
}
export const HOME_TEMPLATE: CmsHome = {
  heroTitle: 'For the moments you remember.',
  heroEyebrow: 'The Designer Sherwani House',
  heroSubtitle: 'Modern heritage menswear and kidswear, discovered in the heart of Mandi Bazar, Warangal.',
  heroImage: '',
  menImage: '',
  kidsImage: '',
  storyTitle: 'A sense of occasion.',
  storyDescription: 'From wedding ensembles to traditional everyday styles, discover the silhouettes that feel right for your celebration.',
  storyImage: '',
  contactWhatsapp: '',
  contactPhone:'',
  customizationImage:'',
  socialLinks:{instagram:'',facebook:'',youtube:'',pinterest:'',threads:'',x:'',tiktok:'',snapchat:'',linkedin:''},
  featuredImages:{one:'',two:'',three:''},
  legalPolicies:{privacy:'',terms:'',returns:''},
  sectionVideos:{},
  siteText: {},
  sectionOrder:HOME_SECTIONS.map(s=>s.id),
  hiddenSections:[],
  featuredOrder:FEATURED_CARDS.map(s=>s.id),
};
export const homeKeys = ['heroTitle','heroEyebrow','heroSubtitle','heroImage','menImage',
  'kidsImage','storyTitle','storyDescription','storyImage','contactWhatsapp','contactPhone','customizationImage'] as const;
export const cleanHome = (value: unknown): CmsHome => {
  const record = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const base=homeKeys.reduce((next, key) => {
    const raw = record[key];
    const value = typeof raw === 'string' ? raw.slice(0, key.includes('Description') || key.includes('Subtitle') ? 900 : 300) : HOME_TEMPLATE[key];
    next[key] = key === 'contactWhatsapp' || key === 'contactPhone'
      ? (/^[1-9][0-9]{9,14}$/.test(value) ? value : '')
      : key.toLowerCase().includes('image') ? (value && isSafeHttps(value) ? value : '') : value;
    return next;
  }, { ...HOME_TEMPLATE });
  const socials=record.socialLinks&&typeof record.socialLinks==='object'&&!Array.isArray(record.socialLinks)
    ?record.socialLinks as Record<string,unknown>:{};
  const videos=record.sectionVideos&&typeof record.sectionVideos==='object'&&!Array.isArray(record.sectionVideos)
    ?record.sectionVideos as Record<string,unknown>:{};
  const featured=record.featuredImages&&typeof record.featuredImages==='object'&&!Array.isArray(record.featuredImages)
    ?record.featuredImages as Record<string,unknown>:{};
  const policies=record.legalPolicies&&typeof record.legalPolicies==='object'&&!Array.isArray(record.legalPolicies)
    ?record.legalPolicies as Record<string,unknown>:{};
  return {...base,
    socialLinks:Object.fromEntries(SOCIAL_KEYS.map(key=>{
      const url=socials[key];
      return [key,typeof url==='string'&&isValidSocialProfile(key,url)?url.trim().slice(0,500):''];
    })) as CmsHome['socialLinks'],
    featuredImages:Object.fromEntries((['one','two','three'] as const).map(key=>[
      key,typeof featured[key]==='string'&&isSafeHttps(featured[key] as string)?String(featured[key]).slice(0,900):'',
    ])) as CmsHome['featuredImages'],
    legalPolicies:Object.fromEntries(POLICY_KEYS.map(key=>[
      key,typeof policies[key]==='string'?(policies[key] as string).slice(0,6000):'',
    ])) as CmsHome['legalPolicies'],
    sectionVideos:Object.fromEntries(Object.entries(videos)
      .filter(([key,url])=>HOME_SECTIONS.some(s=>s.id===key)&&typeof url==='string'&&isSafeHttps(url))
      .map(([key,url])=>[key,(url as string).slice(0,900)])),
    siteText:cleanSiteText(record.siteText),
    sectionOrder:normalizeOrder(record.sectionOrder,HOME_SECTIONS.map(s=>s.id)),
    featuredOrder:normalizeOrder(record.featuredOrder,FEATURED_CARDS.map(s=>s.id)),
    hiddenSections:Array.isArray(record.hiddenSections)
      ? record.hiddenSections.filter((id):id is string=>typeof id==='string'&&id!=='hero'&&HOME_SECTIONS.some(s=>s.id===id))
      : [],
  };
};
export const isSafeHttps = (url: string): boolean => {
  try { const parsed = new URL(url); return parsed.protocol === 'https:' && !parsed.username && !parsed.password; }
  catch { return false; }
};
export const mediaPublicUrl = (path: string): string => {
  const client = getCmsClient();
  return client?.storage.from('nb-media-public').getPublicUrl(path).data.publicUrl || '';
};

export function rowToProduct(row: CmsProductRow): CatalogProduct {
  const images = Array.isArray(row.image_urls) ? row.image_urls.filter(isSafeHttps) : [];
  const p: Product = {
    id: row.id, title: row.title, price: row.offer_price ?? row.price ?? 0, mrp: row.price ?? 0,
    images, category: row.department, fabric: row.fabric || '', length: '',
    sizes: Array.isArray(row.sizes) ? row.sizes : [], description: row.description || '',
    specs: [], badges: [], colors: [], rating: 0, reviewsCount: 0, type: 'Set',
    hasBottom: false, sizeChart: { top: [] }, reviews: [],
  };
  return { ...p, slug:row.slug,sku:row.sku,collectionPaths: row.category_paths || [], department: row.department,
    videoUrl: row.video_url && isSafeHttps(row.video_url) ? row.video_url : undefined,
    videoUrls: Array.isArray(row.video_urls) ? row.video_urls.filter(isSafeHttps) : [],
    published: row.status === 'published',
    offerPrice:row.offer_price??undefined,
    originalPrice:row.price??undefined,
    customizable:Boolean(row.customizable) };
}

export interface PublishedData {
  products: CatalogProduct[];
  homepage: CmsHome;
  categories: CmsCategoryRow[];
  error: string | null;
}
export async function loadPublishedData(): Promise<PublishedData> {
  try {
    const response = await readPublicJson<{
      products?: CmsProductRow[];
      homepage?: unknown;
      categories?: CmsCategoryRow[];
    }>('/api/storefront', 30_000);

    return {
      products: (Array.isArray(response.products) ? response.products : []).map(rowToProduct),
      homepage: cleanHome(response.homepage),
      categories: Array.isArray(response.categories) ? response.categories : [],
      error: null,
    };
  } catch (error) {
    return {
      products: [],
      homepage: HOME_TEMPLATE,
      categories: [],
      error: error instanceof Error ? error.message : 'Unable to read the published catalogue.',
    };
  }
}

/** The CMS Auth client provides additional row-level permission enforcement in SQL. */
export function allowedCmsRole(role: unknown): role is 'owner' | 'admin' | 'editor' {
  return role === 'owner' || role === 'admin' || role === 'editor';
}
export function canPublishRole(role: unknown): boolean { return role === 'owner' || role === 'admin'; }
