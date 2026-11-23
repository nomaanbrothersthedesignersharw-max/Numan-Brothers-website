import React, { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CmsMediaRow } from '../../lib/cmsData';
import { mediaPublicUrl } from '../../lib/cmsData';

export const inputClass = 'w-full min-w-0 max-w-full min-h-11 rounded-md border border-stone-300 bg-white px-3 py-2.5 text-base text-stone-900 sm:text-sm outline-offset-2 focus-visible:outline-2 focus-visible:outline-amber-700';
export const labelClass = 'mb-1.5 block text-xs font-semibold text-stone-700';
export const primaryClass = 'inline-flex min-w-0 max-w-full min-h-11 items-center justify-center gap-2 rounded-md break-words whitespace-normal text-center bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50';
export const outlineClass = 'inline-flex min-w-0 max-w-full min-h-11 items-center justify-center gap-2 rounded-md break-words whitespace-normal text-center border border-stone-300 px-4 py-2.5 text-sm font-semibold text-stone-800 hover:bg-stone-100 disabled:opacity-50';
export function Field({label,children}: {label:string;children:React.ReactNode}) {
  return <label className="block min-w-0"><span className={labelClass+' break-words'}>{label}</span>{children}</label>;
}
export function ErrorText({message}:{message:string|null}) {
  return message ? <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">{message}</p> : null;
}

/** Extracts the real JSON error message from Supabase Edge Function HTTP errors. */
export async function invokeMediaAction(
  client: SupabaseClient,
  id: string,
  action: 'approve' | 'revoke' | 'archive' | 'restore' | 'delete',
): Promise<void> {
  const { data, error } = await client.functions.invoke('nb-media-approval', {
    body: { id, action },
  });
  if (!error && data?.ok) return;
  let detail = '';
  const ctx = error && typeof error === 'object' ? (error as { context?: Response }).context : undefined;
  if (ctx && typeof ctx.json === 'function') {
    try {
      const parsed = (await ctx.json()) as { error?: string };
      if (parsed?.error) detail = parsed.error;
    } catch { /* ignore non-JSON body */ }
  }
  throw new Error(detail || data?.error || error?.message || `Media ${action} failed.`);
}
/** Search/page directly on the server instead of loading the full media library. */
export function AssetPicker({
  label, media, selected, onChange, allowVideo = false, multiple = false, client,
}: {
  label: string; media:CmsMediaRow[]; selected:string[]; onChange:(urls:string[])=>void;
  allowVideo?:boolean; multiple?:boolean; client?:SupabaseClient;
}) {
  const [query,setQuery]=useState('');
  const [page,setPage]=useState(0);
  const [rows,setRows]=useState<CmsMediaRow[]>([]);
  const [count,setCount]=useState(0);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);
  useEffect(()=>{
    if(!client){
      const choices=media.filter(m=>m.approved &&
        (allowVideo?m.mime_type.startsWith('video/'):m.mime_type.startsWith('image/')));
      setRows(choices);setCount(choices.length);return;
    }
    let active=true;setBusy(true);
    const timer=setTimeout(async()=>{
      const term=query.replace(/[^a-zA-Z0-9 _.-]/g,' ').trim().slice(0,60);
      let request=client.from('nb_media')
        .select('id,storage_path,original_name,mime_type,size_bytes,alt_text,approved,uploaded_by,created_at',{count:'exact'})
        .eq('approved',true).is('archived_at',null).like('mime_type',allowVideo?'video/%':'image/%');
      if(term)request=request.ilike('original_name','%'+term+'%');
      const result=await request.order('created_at',{ascending:false}).range(page*24,page*24+23);
      if(!active)return;
      setRows((result.data||[]) as CmsMediaRow[]);setCount(result.count||0);
      setError(result.error?.message||null);setBusy(false);
    },200);
    return()=>{active=false;clearTimeout(timer)};
  },[client,media,allowVideo,page,query]);
  return <section aria-label={label} className="space-y-3">
    <p className={labelClass}>{label} <span className="font-normal text-stone-500">(approved assets only)</span></p>
    <div className="flex flex-wrap items-center gap-2">
      <input className={inputClass+' min-w-0 flex-1'} type="search" aria-label={'Search '+label}
        placeholder="Find by filename or SKU…" value={query}
        onChange={e=>{setQuery(e.target.value);setPage(0);}}/>
      <span className="text-xs text-stone-500">{count} assets</span>
    </div>
    {error&&<ErrorText message={error}/>}
    {busy ? <p role="status" className="p-4 text-xs">Searching images…</p> :
      rows.length === 0 ? <p className="rounded-md bg-stone-100 p-4 text-xs text-stone-500">
        No approved assets match. Upload them in the media library first.
      </p> :
      <div className="grid max-h-72 grid-cols-2 gap-3 overflow-y-auto p-1 sm:grid-cols-3 lg:grid-cols-4">
        {rows.map(asset=>{
          const url=mediaPublicUrl(asset.storage_path);
          const checked=selected.includes(url);
          return <label key={asset.id} className={'cursor-pointer overflow-hidden rounded-md border-2 bg-white '+(checked?'border-amber-700':'border-stone-200')}>
            <span className="flex items-center gap-2 p-2 text-xs">
              <input type={multiple?'checkbox':'radio'} checked={checked}
                onChange={event=>onChange(event.target.checked?
                  (multiple?[...selected.filter(value=>value!==url),url]:[url]):
                  selected.filter(value=>value!==url))}/>
              <span className="truncate" title={asset.original_name}>{asset.original_name}</span>
            </span>
            {allowVideo ? <div className="flex aspect-[4/3] items-center justify-center bg-stone-900 text-white text-xs">Video asset</div> :
              <img src={url} alt={asset.alt_text||asset.original_name} loading="lazy" className="aspect-[4/3] w-full object-cover"/>}
          </label>;
        })}
      </div>}
    {count>24&&<div className="flex flex-wrap items-center justify-between gap-2 text-xs">
      <button type="button" className={outlineClass} disabled={page===0} onClick={()=>setPage(p=>Math.max(0,p-1))}>Previous assets</button>
      <span>Page {page+1} / {Math.ceil(count/24)}</span>
      <button type="button" className={outlineClass} disabled={(page+1)*24>=count} onClick={()=>setPage(p=>p+1)}>Next assets</button>
    </div>}
  </section>;
}
