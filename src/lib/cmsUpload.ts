import type { SupabaseClient } from '@supabase/supabase-js';
import type { CmsMediaRow } from './cmsData';
import { cmsProjectUrl } from './supabaseClient';

const allowed = new Map<string, string>([
  ['image/jpeg','jpg'], ['image/png','png'], ['image/webp','webp'],
  ['image/avif','avif'], ['image/gif','gif'], ['video/mp4','mp4'], ['video/webm','webm'],
]);
export const MAX_MEDIA_SIZE = 50 * 1024 * 1024;
const CHUNK_SIZE = 6 * 1024 * 1024;

export function checkMediaFile(file: Pick<File,'type'|'size'>): string | null {
  if (!allowed.has(file.type)) return 'Use JPG, PNG, WebP, AVIF, GIF, MP4 or WebM. Executable and SVG files are not accepted.';
  if (file.size < 1 || file.size > MAX_MEDIA_SIZE) return 'Files must be smaller than 50 MB.';
  return null;
}
function base64Text(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** Chunked TUS upload. Retries HEAD/PATCH interruptions; never grants public upload rights. */
async function resumableUpload(
  client: SupabaseClient, path: string, file: File, progress: (pct: number) => void,
): Promise<void> {
  const { data: { session }, error } = await client.auth.getSession();
  if (error || !session?.access_token) throw new Error('Please sign in again before uploading.');
  const project = new URL(cmsProjectUrl).hostname.split('.')[0];
  const endpoint = 'https://' + project + '.storage.supabase.co/storage/v1/upload/resumable';
  const authHeaders = { authorization: 'Bearer ' + session.access_token,
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY };
  const metadata = [
    ['bucketName','nb-media-staging'], ['objectName',path], ['contentType',file.type], ['cacheControl','3600'],
  ].map(([key,value]) => key + ' ' + base64Text(value)).join(',');
  const start = await fetch(endpoint, {
    method: 'POST',
    headers: { ...authHeaders, 'Tus-Resumable':'1.0.0', 'Upload-Length': String(file.size), 'Upload-Metadata': metadata },
  });
  if (!start.ok) throw new Error('Cannot start resumable upload (HTTP ' + start.status + ').');
  const location = start.headers.get('Location');
  if (!location) throw new Error('Upload service did not return a resumable location.');
  const uploadUrl = new URL(location, endpoint).toString();
  if (!uploadUrl.startsWith('https://' + project + '.storage.supabase.co/')) {
    throw new Error('Unexpected upload server destination.');
  }

  let offset = 0;
  let failures = 0;
  while (offset < file.size) {
    try {
      const end = Math.min(offset + CHUNK_SIZE, file.size);
      const response = await fetch(uploadUrl, {
        method:'PATCH',
        headers:{ ...authHeaders, 'Tus-Resumable':'1.0.0',
          'Upload-Offset':String(offset), 'Content-Type':'application/offset+octet-stream' },
        body:file.slice(offset,end),
      });
      if (!response.ok) throw new Error('Upload chunk failed (HTTP ' + response.status + ').');
      const next = Number(response.headers.get('Upload-Offset'));
      if (!Number.isFinite(next) || next <= offset || next > file.size) {
        throw new Error('Invalid upload offset returned from the storage server.');
      }
      offset = next;
      failures = 0;
      progress(Math.round(100 * offset / file.size));
    } catch (cause) {
      if (++failures >= 4) throw cause;
      const check = await fetch(uploadUrl, {
        method:'HEAD', headers:{ ...authHeaders, 'Tus-Resumable':'1.0.0' },
      });
      if (!check.ok) throw new Error('Cannot resume interrupted upload.');
      const recoveredOffset = Number(check.headers.get('Upload-Offset'));
      if (!Number.isInteger(recoveredOffset) || recoveredOffset < offset || recoveredOffset > file.size) {
        throw new Error('Invalid resumed upload offset.');
      }
      offset = recoveredOffset;
      progress(Math.round(100 * offset / file.size));
    }
  }
}

const mediaSelectColumns = 'id,storage_path,original_name,mime_type,size_bytes,alt_text,department,category_path,archived_at,approved,uploaded_by,created_at';

/**
 * For batch import retries, stableObjectId is derived from the owner's job
 * ID and row index. It prevents duplicate Storage objects if the upload
 * succeeded before the audit row was saved.
 */
const MAX_DIMENSION = 1440;
const COMPRESS_THRESHOLD_BYTES = 200 * 1024;

/** Downscale and WebP-compress large interactive camera photos before upload. */
async function optimizeImageForWeb(file: File): Promise<File> {
  if (
    typeof document === 'undefined' ||
    typeof createImageBitmap !== 'function' ||
    file.size <= COMPRESS_THRESHOLD_BYTES ||
    !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
  ) {
    return file;
  }
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) { bitmap.close(); return file; }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.80));
    if (!blob || blob.size >= file.size) return file;
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'garment';
    return new File([blob], baseName + '.webp', { type: 'image/webp', lastModified: file.lastModified });
  } catch {
    return file;
  }
}

export async function uploadCmsFile(
  client: SupabaseClient, rawFile: File, userId: string, onProgress: (value: number) => void,
  options?: {stableObjectId?:string;department?:'men'|'kids'|null;categoryPath?:string|null},
): Promise<CmsMediaRow> {
  const validation = checkMediaFile(rawFile);
  if (validation) throw new Error(validation);
  const file = options?.stableObjectId ? rawFile : await optimizeImageForWeb(rawFile);
  const extension = allowed.get(file.type)!;
  const objectId = options?.stableObjectId ?? crypto.randomUUID();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(objectId))
    throw new Error('Invalid private upload identity');
  const path = userId + '/' + objectId + '.' + extension;
  let alreadyStored = false;

  if (options?.stableObjectId) {
    const {data: existing, error: lookupError} = await client.from('nb_media')
      .select(mediaSelectColumns).eq('storage_path',path).maybeSingle();
    if (lookupError) throw new Error('Cannot reconcile existing media metadata: ' + lookupError.message);
    if (existing) {
      if (existing.size_bytes !== file.size || existing.mime_type !== file.type ||
          existing.original_name !== file.name.slice(0,220)) {
        throw new Error('Upload identity conflicts with existing media metadata');
      }
      onProgress(100);
      return existing as CmsMediaRow;
    }
    // Recover an orphan private object from a previous failed metadata insert.
    // A deterministic ID is used only for the same hashed image job and row.
    const {data: object} = await client.storage.from('nb-media-staging').info(path);
    if (object) {
      if (Number(object.size) !== file.size)
        throw new Error('Previously uploaded object has a different file size');
      alreadyStored = true;
      onProgress(100);
    }
  }

  if (!alreadyStored && file.size <= CHUNK_SIZE) {
    const { error } = await client.storage.from('nb-media-staging').upload(path, file, {
      upsert:false, cacheControl:'31536000', contentType:file.type,
    });
    if (error) throw error;
    onProgress(100);
  } else if (!alreadyStored) {
    await resumableUpload(client, path, file, onProgress);
  }
  const { data, error } = await client.from('nb_media').insert({
    storage_path:path, original_name:file.name.slice(0,220), mime_type:file.type,
    size_bytes:file.size, alt_text:'', approved:false, uploaded_by:userId,
    department:options?.department||null,category_path:options?.categoryPath||null,
  }).select(mediaSelectColumns).single();
  if (error || !data) {
    // Best-effort cleanup of orphaned private upload when metadata insert fails on non-idempotent uploads
    if (!options?.stableObjectId) {
      await client.storage.from('nb-media-staging').remove([path]).catch(() => undefined);
    }
    throw new Error('File uploaded, but saving metadata failed. Retry the same import to reconcile: ' +
      (error?.message || 'unknown database error'));
  }
  return data as CmsMediaRow;
}

/**
 * Bounded concurrent worker pool preserving input order.
 * Prevents saturating browser connections or Supabase Storage rate limits during bulk uploads.
 */
export async function runBoundedPool<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const limit = Math.max(1, Math.min(6, Math.floor(concurrency || 3)));
  const results = new Array<R>(items.length);
  let cursor = 0;

  const runWorker = async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await worker(items[idx], idx);
    }
  };

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => runWorker()));
  return results;
}

/**
 * Computes a lowercase hex SHA-256 digest for a File/Blob using Web Crypto.
 * Falls back to size+name+lastModified fingerprint in environments without crypto.subtle.
 */
export async function computeFileSha256(file: Pick<File, 'arrayBuffer' | 'size' | 'name' | 'lastModified'>): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof file.arrayBuffer === 'function') {
    const buf = await file.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return `fallback:${file.size}:${file.name}:${file.lastModified}`;
}

/**
 * Deduplicates an upload batch by SHA-256 content hash so identical photographs
 * are never uploaded twice to Supabase Storage.
 */
export async function deduplicateUploadBatch<T extends Pick<File, 'arrayBuffer' | 'size' | 'name' | 'lastModified'>>(
  files: readonly T[],
): Promise<{ unique: T[]; duplicateNames: string[] }> {
  const seen = new Set<string>();
  const unique: T[] = [];
  const duplicateNames: string[] = [];
  for (const file of files) {
    const hash = await computeFileSha256(file);
    if (seen.has(hash)) {
      duplicateNames.push(file.name);
    } else {
      seen.add(hash);
      unique.push(file);
    }
  }
  return { unique, duplicateNames };
}

/**
 * Uploads multiple media files concurrently (default concurrency = 3) with transient retry
 * and aggregated overall progress (0-100%).
 */
export async function uploadCmsFilesParallel(
  client: SupabaseClient,
  files: readonly File[],
  userId: string,
  onOverallProgress: (percent: number) => void,
  options?: {
    department?: 'men' | 'kids' | null;
    categoryPath?: string | null;
    concurrency?: number;
    maxRetries?: number;
  },
): Promise<CmsMediaRow[]> {
  if (!files.length) return [];
  const perFile = new Array<number>(files.length).fill(0);
  const emitOverall = () => {
    const sum = perFile.reduce((a, b) => a + b, 0);
    onOverallProgress(Math.round(sum / files.length));
  };
  const maxRetries = Math.max(0, Math.min(3, options?.maxRetries ?? 2));

  return runBoundedPool(files, options?.concurrency ?? 3, async (file, idx) => {
    let attempt = 0;
    while (true) {
      try {
        const row = await uploadCmsFile(
          client,
          file,
          userId,
          (pct) => {
            perFile[idx] = pct;
            emitOverall();
          },
          { department: options?.department ?? null, categoryPath: options?.categoryPath ?? null },
        );
        perFile[idx] = 100;
        emitOverall();
        return row;
      } catch (err) {
        attempt += 1;
        if (attempt > maxRetries) throw err;
        await new Promise((r) => setTimeout(r, 400 * attempt));
      }
    }
  });
}
