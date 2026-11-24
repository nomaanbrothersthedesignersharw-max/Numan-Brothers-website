/**
 * Resilient client-side draft auto-save & RFC-4180 catalogue CSV export utilities
 * for Admin Studio (Phase 4 #21 & #23).
 */

const PREFIX = 'nb_studio_draft_v1:';
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface LocalDraftSnapshot<T> {
  savedAt: number;
  data: T;
}

function getStorage(custom?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null {
  if (custom) return custom;
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function saveLocalDraft<T>(
  key: string,
  data: T,
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
): boolean {
  const store = getStorage(storage);
  if (!store || !key) return false;
  try {
    const payload: LocalDraftSnapshot<T> = { savedAt: Date.now(), data };
    store.setItem(PREFIX + key, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function loadLocalDraft<T>(
  key: string,
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
): LocalDraftSnapshot<T> | null {
  const store = getStorage(storage);
  if (!store || !key) return null;
  try {
    const raw = store.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LocalDraftSnapshot<T>>;
    if (!parsed || typeof parsed.savedAt !== 'number' || !('data' in parsed)) return null;
    if (Date.now() - parsed.savedAt > TTL_MS) {
      store.removeItem(PREFIX + key);
      return null;
    }
    return { savedAt: parsed.savedAt, data: parsed.data as T };
  } catch {
    return null;
  }
}

export function clearLocalDraft(
  key: string,
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
): void {
  const store = getStorage(storage);
  if (!store || !key) return;
  try {
    store.removeItem(PREFIX + key);
  } catch {
    // ignore storage errors
  }
}

function csvCell(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export interface CsvExportProduct {
  sku: string;
  title: string;
  department: string;
  category_paths?: string[];
  fabric?: string | null;
  sizes?: string[];
  price?: number | null;
  offer_price?: number | null;
  customizable?: boolean;
  status?: string;
  slug?: string;
}

export function buildCatalogueCsv(rows: CsvExportProduct[]): string {
  const header = [
    'SKU',
    'Title',
    'Department',
    'Categories',
    'Fabric',
    'Sizes',
    'Price',
    'Offer Price',
    'Customizable',
    'Status',
    'Slug',
  ];
  const lines = [header.map(csvCell).join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.sku,
        r.title,
        r.department,
        (r.category_paths || []).join(' | '),
        r.fabric || '',
        (r.sizes || []).join(', '),
        r.price ?? '',
        r.offer_price ?? '',
        r.customizable ? 'Yes' : 'No',
        r.status || '',
        r.slug || '',
      ]
        .map(csvCell)
        .join(','),
    );
  }
  return lines.join('\r\n') + '\r\n';
}
