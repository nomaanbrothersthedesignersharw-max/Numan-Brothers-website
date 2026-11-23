import { useEffect, useState } from 'react';
import { productImage, productPath, type CatalogProduct } from './catalog';

export interface ShortlistItem {
  id: string;
  sku?: string;
  slug?: string;
  title: string;
  image?: string;
  price?: number;
}

const STORAGE_KEY = 'nb_showroom_shortlist_v1';
const EVENT_NAME = 'nb-shortlist-changed';
const MAX_ITEMS = 12;

export function readShortlist(): ShortlistItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x): x is ShortlistItem => Boolean(x && typeof x === 'object' && typeof (x as ShortlistItem).id === 'string' && typeof (x as ShortlistItem).title === 'string'))
      .slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
}

function writeShortlist(items: ShortlistItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  } catch {
    // Ignore storage quota errors in private browsing
  }
}

export function toggleShortlistItem(product: CatalogProduct): boolean {
  const current = readShortlist();
  const exists = current.some((item) => item.id === product.id);
  if (exists) {
    writeShortlist(current.filter((item) => item.id !== product.id));
    return false;
  }
  const next: ShortlistItem = {
    id: product.id,
    sku: product.sku,
    slug: product.slug,
    title: product.title,
    image: productImage(product) || undefined,
    price: product.offerPrice ?? product.originalPrice,
  };
  writeShortlist([next, ...current].slice(0, MAX_ITEMS));
  return true;
}

export function removeShortlistItem(id: string): void {
  writeShortlist(readShortlist().filter((item) => item.id !== id));
}

export function clearShortlist(): void {
  writeShortlist([]);
}

export function useShortlist(): ShortlistItem[] {
  const [items, setItems] = useState<ShortlistItem[]>(readShortlist);
  useEffect(() => {
    const sync = () => setItems(readShortlist());
    window.addEventListener(EVENT_NAME, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT_NAME, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  return items;
}

export function shortlistWhatsAppMessage(items: ShortlistItem[], origin: string): string {
  const lines = items.map((item, idx) => {
    const url = origin + productPath(item);
    return `${idx + 1}. ${item.title}${item.sku ? ` (SKU ${item.sku})` : ''} — ${url}`;
  });
  return `Hello Nomaan Brothers, I have shortlisted these styles and would like to enquire about availability:\n\n${lines.join('\n')}`;
}
