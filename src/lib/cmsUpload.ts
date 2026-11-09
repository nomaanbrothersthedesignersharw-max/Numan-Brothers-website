import type { SupabaseClient } from '@supabase/supabase-js';
import type { CmsMediaRow } from './cmsData';
import { cmsProjectUrl } from './supabaseClient';
import { prepareMediaFile, runWithConcurrency, type BatchResult, type MediaPreparation } from './mediaOptimization';
export { runWithConcurrency } from './mediaOptimization';

const allowed = new Map<string, string>([
  ['image/jpeg','jpg'], ['image/png','png'], ['image/webp','webp'],
  ['image/avif','avif'], ['image/gif','gif'], ['video/mp4','mp4'], ['video/webm','webm'],
]);
export const MAX_MEDIA_SIZE = 50 * 1024 * 1024;
export const TUS_CHUNK_SIZE = 6 * 1024 * 1024;
const IMMUTABLE_CACHE_SECONDS = '31536000';

export function checkMediaFile(file: Pick<File,'type'|'size'>): string | null {
  if (!allowed.has(file.type)) return 'Use JPG, PNG, WebP, AVIF, GIF, MP4 or WebM. Executable and SVG files are not accepted.';
  if (file.size < 1 || file.size > MAX_MEDIA_SIZE) return 'Files must be smaller than 50 MB. Large photos are compressed in your browser before upload.';
  return null;
}
function base64Text(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** Direct-host TUS upload. Retries recover the server offset before retrying. */
async function resumableUpload(
  client: SupabaseClient, path: string, file: File, progress: (pct: number) => void,
): Promise<void> {
  const { data: { session }, error } = await client.auth.getSession();
  if (error || !session?.access_token) throw new Error('Please sign in again before uploading.');
  const project = new URL(cmsProjectUrl).hostname.split('.')[0];
  const endpoint = 'https://' + project + '.storage.supabase.co/storage/v1/upload/resumable';
  const apiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!apiKey) throw new Error('Supabase upload key is missing from this deployment.');
  const authHeaders = { authorization: 'Bearer ' + session.access_token, apikey: apiKey };
  const metadata = [
    ['bucketName','nb-media-staging'], ['objectName',path],
    ['contentType',file.type], ['cacheControl',IMMUTABLE_CACHE_SECONDS],
  ].map(([key,value]) => key + ' ' + base64Text(value)).join(',');
  const start = await fetch(endpoint, {
    method:'POST',
    headers:{...authHeaders,'Tus-Resumable':'1.0.0','Upload-Length':String(file.size),'Upload-Metadata':metadata},
  });
  if (!start.ok) throw new Error('Cannot start resumable upload (HTTP ' + start.status + ').');
  const location = start.headers.get('Location');
  if (!location) throw new Error('Upload service did not return a resumable location.');
  const uploadUrl = new URL(location, endpoint).toString();
  if (!uploadUrl.startsWith('https://' + project + '.storage.supabase.co/')) {
    throw new Error('Unexpected upload server destination.');
  }

  let offset=0;
  let failures=0;
  while(offset<file.size){
    try{
      const end=Math.min(offset+TUS_CHUNK_SIZE,file.size);
      const response=await fetch(uploadUrl,{
        method:'PATCH',
        headers:{...authHeaders,'Tus-Resumable':'1.0.0','Upload-Offset':String(offset),
          'Content-Type':'application/offset+octet-stream'},
        body:file.slice(offset,end),
      });
      if(!response.ok)throw new Error('Upload chunk failed (HTTP '+response.status+').');
      const next=Number(response.headers.get('Upload-Offset'));
      if(!Number.isFinite(next)||next<=offset||next>file.size)throw new Error('Invalid upload offset returned from the storage server.');
      offset=next;failures=0;progress(Math.round(100*offset/file.size));
    }catch(cause){
      if(++failures>=4)throw cause;
      const check=await fetch(uploadUrl,{method:'HEAD',headers:{...authHeaders,'Tus-Resumable':'1.0.0'}});
      if(!check.ok)throw new Error('Cannot resume interrupted upload.');
      const recovered=Number(check.headers.get('Upload-Offset'));
      if(!Number.isInteger(recovered)||recovered<offset||recovered>file.size)throw new Error('Invalid resumed upload offset.');
      offset=recovered;progress(Math.round(100*offset/file.size));
    }
  }
}

const mediaSelectColumns='id,storage_path,original_name,mime_type,size_bytes,alt_text,department,category_path,archived_at,approved,uploaded_by,created_at';
type UploadOptions = {
  stableObjectId?:string;
  department?:'men'|'kids'|null;
  categoryPath?:string|null;
  onPreparing?:()=>void;
  onPrepared?:(result:MediaPreparation)=>void;
};
function isMatchingExisting(existing:CmsMediaRow,file:File):boolean {
  return existing.size_bytes===file.size && existing.mime_type===file.type &&
    existing.original_name===file.name.slice(0,220);
}
async function findExisting(client:SupabaseClient,path:string,file:File):Promise<CmsMediaRow|null>{
  const {data,error}=await client.from('nb_media').select(mediaSelectColumns)
    .eq('storage_path',path).maybeSingle();
  if(error)throw new Error('Cannot reconcile existing media metadata: '+error.message);
  if(!data)return null;
  if(!isMatchingExisting(data as CmsMediaRow,file))throw new Error('Upload identity conflicts with existing media metadata');
  return data as CmsMediaRow;
}

/**
 * Every browser upload uses the same preparation path: still images are
 * resized/WebP-compressed before transfer; GIF animation and video bytes are
 * preserved. Stable import IDs reconcile both pre-optimization objects and
 * newly compressed objects after a retry.
 */
export async function uploadCmsFile(
  client:SupabaseClient,file:File,userId:string,onProgress:(value:number)=>void,
  options?:UploadOptions,
):Promise<CmsMediaRow>{
  const originalValidation=checkMediaFile(file);
  if(originalValidation)throw new Error(originalValidation);
  const originalExtension=allowed.get(file.type)!;
  const objectId=options?.stableObjectId??crypto.randomUUID();
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(objectId))
    throw new Error('Invalid private upload identity');

  const originalPath=userId+'/'+objectId+'.'+originalExtension;
  let uploadFile=file;
  let path=originalPath;
  let alreadyStored=false;
  let prepared:MediaPreparation={file,originalBytes:file.size,preparedBytes:file.size,compressed:false,format:'original'};

  if(options?.stableObjectId){
    const existing=await findExisting(client,originalPath,file);
    if(existing){options.onPrepared?.(prepared);onProgress(100);return existing;}
    // Older interrupted jobs may have written an original, uncompressed object.
    const {data:oldObject,error:oldInfoError}=await client.storage.from('nb-media-staging').info(originalPath);
    // A not-found response is the normal first-upload case. If Storage is
    // temporarily unreachable, the later upload request will fail safely.
    if(oldObject){
      if(Number(oldObject.size)!==file.size)throw new Error('Previously uploaded object has a different file size');
      alreadyStored=true;
      options.onPrepared?.(prepared);
    }
  }

  if(!alreadyStored){
    options?.onPreparing?.();
    prepared=await prepareMediaFile(file);
    uploadFile=prepared.file;
    const validation=checkMediaFile(uploadFile);
    if(validation)throw new Error(validation);
    path=userId+'/'+objectId+'.'+allowed.get(uploadFile.type)!;
    options.onPrepared?.(prepared);
    if(options?.stableObjectId){
      const existing=await findExisting(client,path,uploadFile);
      if(existing){onProgress(100);return existing;}
      const {data:orphan,error:orphanError}=await client.storage.from('nb-media-staging').info(path);
      // A missing object is expected; an upload conflict will still be surfaced
      // by Storage rather than silently overwriting a different asset.
      if(orphan){
        if(Number(orphan.size)!==uploadFile.size)throw new Error('Previously compressed object has a different file size');
        alreadyStored=true;
      }
    }
  }

  if(!alreadyStored){
    if(uploadFile.size<=TUS_CHUNK_SIZE){
      const {error}=await client.storage.from('nb-media-staging').upload(path,uploadFile,{
        upsert:false,cacheControl:IMMUTABLE_CACHE_SECONDS,contentType:uploadFile.type,
      });
      if(error)throw error;
      onProgress(100);
    }else{
      await resumableUpload(client,path,uploadFile,onProgress);
    }
  }else{
    onProgress(100);
  }

  const {data,error}=await client.from('nb_media').insert({
    storage_path:path,original_name:uploadFile.name.slice(0,220),mime_type:uploadFile.type,
    size_bytes:uploadFile.size,alt_text:'',approved:false,uploaded_by:userId,
    department:options?.department||null,category_path:options?.categoryPath||null,
  }).select(mediaSelectColumns).single();
  if(error||!data){
    throw new Error('File uploaded, but saving metadata failed. Retry the same import to reconcile: '+
      (error?.message||'unknown database error'));
  }
  return data as CmsMediaRow;
}
