import React, { useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import {ImagePlus,CheckCircle2,Upload,Archive,Trash2,RotateCcw} from 'lucide-react';
import {COLLECTION_ROUTES} from '../../storefront/navigation';
import { type CmsMediaRow, mediaPublicUrl } from '../../lib/cmsData';
import { runWithConcurrency, uploadCmsFile } from '../../lib/cmsUpload';
import { ErrorText, inputClass, outlineClass, primaryClass } from './StudioShared';

interface Props { client: SupabaseClient; userId:string; canPublish:boolean; onMediaChange:()=>void; }
export default function CmsMedia({client,userId,canPublish,onMediaChange}:Props) {
  const [rows,setRows] = useState<CmsMediaRow[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState<string|null>(null);
  const [uploading,setUploading] = useState(false);
  const [progress,setProgress] = useState(0);
  const [selection,setSelection] = useState<File[]>([]);
  const [fileStatuses,setFileStatuses] = useState<{name:string;status:'queued'|'preparing'|'uploading'|'done'|'failed';progress:number;error?:string}[]>([]);
  const [compressionSaved,setCompressionSaved] = useState(0);
  const [busyId,setBusyId] = useState<string|null>(null);
  const [altDrafts,setAltDrafts] = useState<Record<string,string>>({});
  const [nameDrafts,setNameDrafts] = useState<Record<string,string>>({});
  const [tags,setTags] = useState<Record<string,{department:'men'|'kids'|null;category_path:string|null}>>({});
  const [uploadDept,setUploadDept] = useState<'men'|'kids'|''>('');
  const [uploadCategory,setUploadCategory] = useState('');
  const [filterDept,setFilterDept] = useState<'men'|'kids'|''>('');
  const [filterCategory,setFilterCategory] = useState('');
  const [archivedFilter,setArchivedFilter] = useState<'active'|'archived'>('active');
  const [privatePreviews,setPrivatePreviews] = useState<Record<string,string>>({});
  const [search,setSearch] = useState('');
  const [approvalFilter,setApprovalFilter] = useState('all');
  const [typeFilter,setTypeFilter] = useState<'all'|'image'|'video'>('all');
  const requestSequence=useRef(0);
  const [page,setPage] = useState(0);
  const [total,setTotal] = useState(0);
  const refresh = async () => {
    const seq=++requestSequence.current;
    setLoading(true);
    let request=client.from('nb_media')
      .select('id,storage_path,original_name,mime_type,size_bytes,alt_text,department,category_path,archived_at,approved,uploaded_by,created_at',{count:'exact'});
    const term=search.replace(/[^a-zA-Z0-9 _.-]/g,' ').trim().slice(0,60);
    if(term)request=request.ilike('original_name','%'+term+'%');
    if(typeFilter!=='all')request=request.like('mime_type',typeFilter+'/%');
    if(approvalFilter==='approved')request=request.eq('approved',true);
    if(approvalFilter==='pending')request=request.eq('approved',false);
    if(filterDept)request=request.eq('department',filterDept);
    if(filterCategory)request=request.eq('category_path',filterCategory);
    if(archivedFilter==='archived')request=request.not('archived_at','is',null);
    else request=request.is('archived_at',null);
    const {data,count,error} = await request.order('created_at',{ascending:false})
      .range(page*30,page*30+29);
    if(seq!==requestSequence.current)return;
    setTotal(count||0);
    const assets=(data||[]) as CmsMediaRow[];
    setRows(assets);
    setPrivatePreviews({});
    setAltDrafts(Object.fromEntries(assets.map(a=>[a.id,a.alt_text])));
    setNameDrafts(Object.fromEntries(assets.map(a=>[a.id,a.original_name])));
    setTags(Object.fromEntries(assets.map(a=>[a.id,{department:a.department,category_path:a.category_path}])));
    setError(error?.message || null);
    setLoading(false);
  };
  useEffect(()=>{const timer=setTimeout(()=>void refresh(),220);return()=>clearTimeout(timer)},[client,page,search,typeFilter,approvalFilter,filterDept,filterCategory,archivedFilter]);

  const upload = async () => {
    if (!selection.length || uploading) return;
    if(selection.length>100){setError('Choose up to 100 files here, or use Bulk imports for larger batches.');return;}
    const files=[...selection];
    const progressByFile=files.map(()=>0);
    const weights=files.map(file=>Math.max(1,file.size));
    const totalBytes=weights.reduce((sum,n)=>sum+n,0);
    let preparedSaved=0;
    setUploading(true);setError(null);setCompressionSaved(0);
    setFileStatuses(files.map(file=>({name:file.name,status:'queued',progress:0})));
    setProgress(0);
    const setFileProgress=(index:number,value:number)=>{
      progressByFile[index]=value;
      const uploaded=progressByFile.reduce((sum,p,i)=>sum+weights[i]*p/100,0);
      setProgress(Math.min(100,Math.round(100*uploaded/totalBytes)));
      setFileStatuses(current=>current.map((item,i)=>i===index
        ?{...item,status:'uploading',progress:value}:item));
    };
    try{
      const results=await runWithConcurrency(files,2,async(file,index)=>{
        const asset=await uploadCmsFile(client,file,userId,
          value=>setFileProgress(index,value),{
            department:uploadDept||null,
            categoryPath:uploadCategory||null,
            onPreparing:()=>setFileStatuses(current=>current.map((item,i)=>i===index
              ?{...item,status:'preparing',progress:0}:item)),
            onPrepared:info=>{
              preparedSaved+=Math.max(0,info.originalBytes-info.preparedBytes);
              setCompressionSaved(preparedSaved);
            },
          });
        setFileStatuses(current=>current.map((item,i)=>i===index
          ?{...item,status:'done',progress:100}:item));
        return asset;
      });
      const failed:File[]=[];
      let succeeded=0;
      results.forEach((result,index)=>{
        if(result.ok===true)succeeded++;
        else{
          failed.push(files[index]);
          const message=result.error instanceof Error?result.error.message:'Upload failed.';
          setFileStatuses(current=>current.map((item,i)=>i===index
            ?{...item,status:'failed',error:message}:item));
        }
      });
      setSelection(failed);
      if(succeeded>0){await refresh();onMediaChange();}
      if(failed.length){
        setError(succeeded+' file(s) uploaded. '+failed.length+' failed and remain selected; click Retry to send only those files.');
        setProgress(Math.round(100*succeeded/files.length));
      }else{
        setProgress(100);
        setError(null);
        setFileStatuses([]);
      }
    }catch(cause){
      setError(cause instanceof Error?cause.message:'Upload batch failed.');
    }finally{setUploading(false);}
  };
  const approve = async (asset:CmsMediaRow) => {
    if (!canPublish) return;
    setBusyId(asset.id);setError(null);
    const {data,error} = await client.functions.invoke('nb-media-approval',{
      body:{id:asset.id,action:asset.approved?'revoke':'approve'},
    });
    if (error || !data?.ok) setError(error?.message||data?.error||'Unable to change approval status.'); 
    else { await refresh();onMediaChange(); }
    setBusyId(null);
  };
  const previewPrivate = async (asset:CmsMediaRow) => {
    setBusyId(asset.id);setError(null);
    const {data,error}=await client.storage.from('nb-media-staging')
      .createSignedUrl(asset.storage_path,120);
    if(error || !data?.signedUrl) setError(error?.message||'Private preview unavailable.');
    else setPrivatePreviews(current=>({...current,[asset.id]:data.signedUrl}));
    setBusyId(null);
  };
  const saveDescription = async (asset:CmsMediaRow) => {
    const permitted = canPublish || (!asset.approved && asset.uploaded_by===userId);
    if(!permitted)return;
    setBusyId(asset.id);setError(null);
    const value=(altDrafts[asset.id]||'').trim().slice(0,400);
    const filename=(nameDrafts[asset.id]||'').trim().slice(0,220);
    if(!filename){setError('Enter a media display name.');setBusyId(null);return;}
    const tag=tags[asset.id]||{department:asset.department,category_path:asset.category_path};
    const {data,error}=await client.from('nb_media')
      .update({alt_text:value,original_name:filename,department:tag.department,category_path:tag.category_path})
      .eq('id',asset.id).select('id').maybeSingle();
    if(error||!data)setError(error?.message||'Asset description could not be saved.');
    else {await refresh();onMediaChange();}
    setBusyId(null);
  };
  const deleteMedia=async(asset:CmsMediaRow)=>{
    if(!canPublish)return;
    if(!window.confirm('Permanently erase this image/video from Supabase Storage AND its database record? This cannot be undone. Referenced live assets cannot be erased.'))return;
    setBusyId(asset.id);setError(null);
    try{
      const {data,error}=await client.functions.invoke('nb-media-approval',{
        body:{id:asset.id,action:'delete'},
      });
      if(error||!data?.ok)throw new Error(error?.message||data?.error||'Unable to delete asset.');
      await refresh();onMediaChange();
    }catch(cause){setError(cause instanceof Error?cause.message:'File deletion failed.');}
    finally{setBusyId(null);}
  };
  const toggleArchive=async(asset:CmsMediaRow)=>{
    if(!canPublish)return;
    const verb=asset.archived_at?'restore':'archive';
    if(!window.confirm(verb==='archive'?'Archive this asset? It stays stored and can be restored.':'Restore this media asset to the library?'))return;
    setBusyId(asset.id);setError(null);
    const {data,error}=await client.functions.invoke('nb-media-approval',{body:{id:asset.id,action:verb}});
    if(error||!data?.ok)setError(error?.message||data?.error||'Archive operation failed.');
    else{await refresh();onMediaChange();}
    setBusyId(null);
  };
  const collectionsFor=(department:'men'|'kids'|'')=>
    COLLECTION_ROUTES.filter(c=>!c.isDepartment&&!c.isGroup&&(!department||c.department===department));
  return <section className="space-y-7">
    <div>
      <h2 className="font-serif text-3xl">Media library</h2>
      <p className="mt-2 max-w-2xl text-sm text-stone-600">Search and manage photographs and videos in pages of 30. Upload assets here, or use Bulk imports for larger photo batches and CSV. Only approved media appears on the website.</p>
    </div>
    <div className="min-w-0 space-y-4 rounded-lg border border-stone-200 bg-stone-50 p-3 min-[360px]:p-5">
      <div className="flex items-center gap-2"><ImagePlus size={20}/><h3 className="font-semibold">Upload assets</h3></div>
      <div className="nb-responsive-grid grid gap-3 md:grid-cols-2">
        <label className="block text-xs font-semibold">1. Department
          <select className={inputClass+' mt-1'} value={uploadDept} onChange={e=>{setUploadDept(e.target.value as 'men'|'kids'|'');setUploadCategory('')}}>
            <option value="">General website assets</option><option value="men">Men’s Wear</option><option value="kids">Kids Wear</option>
          </select></label>
        <label className="block text-xs font-semibold">2. Garment category
          <select className={inputClass+' mt-1'} value={uploadCategory} onChange={e=>setUploadCategory(e.target.value)}>
            <option value="">All / general</option>{collectionsFor(uploadDept).map(c=><option key={c.path} value={c.path}>{c.title}</option>)}
          </select></label>
      </div>
      <input aria-label="Choose photos or videos" type="file" multiple
        accept="image/jpeg,image/png,image/webp,image/avif,image/gif,video/mp4,video/webm"
        className={inputClass} onChange={(e)=>{setSelection(Array.from(e.currentTarget.files||[]));setFileStatuses([]);setCompressionSaved(0);}}/>
      <p className="text-xs text-stone-500">Choose up to 100 files, 50 MB maximum each. Large files use resumable uploads; total capacity depends on the Supabase plan.</p>
      {selection.length?<p role="status" className="text-xs font-semibold text-stone-700">{selection.length} file(s) selected</p>:null}
      {compressionSaved>0&&<p className="text-xs text-emerald-800">Browser compression saved {(compressionSaved/1024/1024).toFixed(2)} MB before upload.</p>}
      {fileStatuses.length>0&&<ul aria-label="Upload queue" className="max-h-64 space-y-2 overflow-y-auto rounded-md border border-stone-200 bg-white p-3">
        {fileStatuses.map((file,index)=><li key={file.name+'-'+index} className="space-y-1">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="min-w-0 truncate">{file.name}</span>
            <span className={file.status==='failed'?'text-red-700':file.status==='done'?'text-emerald-700':'text-stone-500'}>
              {file.status==='done'?'Uploaded':file.status==='failed'?'Failed':file.status==='queued'?'Queued':file.status==='preparing'?'Preparing media…':file.progress+'%'}
            </span>
          </div>
          <progress aria-label={'Progress '+file.name} max={100} value={file.progress} className="block w-full"/>
          {file.error&&<p className="text-[11px] text-red-700">{file.error}</p>}
        </li>)}
      </ul>}
      <button type="button" className={primaryClass} onClick={()=>void upload()} disabled={!selection.length || uploading}>
        <Upload size={16}/>{uploading ? (fileStatuses.some(x=>x.status==='preparing')?'Preparing media…':'Uploading batch ' + progress + '%') : fileStatuses.some(x=>x.status==='failed') ? 'Retry ' + selection.length + ' failed file(s)' : 'Upload selected files'}
      </button>
      {uploading && <progress aria-label="Overall upload progress" max={100} value={progress} className="block w-full"/>}
    </div>
    <div className="nb-responsive-grid grid gap-3 rounded-md border border-stone-200 bg-white p-3 min-[360px]:p-4 sm:grid-cols-2 xl:grid-cols-3">
      <input className={inputClass} type="search" aria-label="Search media filename or SKU"
        placeholder="Search photos by name or SKU…" value={search}
        onChange={e=>{setSearch(e.target.value);setPage(0);}}/>
      <select className={inputClass} aria-label="Media type" value={typeFilter}
        onChange={e=>{setTypeFilter(e.target.value as 'all'|'image'|'video');setPage(0);}}>
        <option value="all">All media</option><option value="image">Images</option><option value="video">Videos</option>
      </select>
      <select className={inputClass} aria-label="Media approval status" value={approvalFilter}
        onChange={e=>{setApprovalFilter(e.target.value);setPage(0);}}>
        <option value="all">All assets</option><option value="pending">Pending approval</option>
        <option value="approved">Approved</option>
      </select>
      <select className={inputClass} aria-label="Filter media department" value={filterDept}
        onChange={e=>{setFilterDept(e.target.value as 'men'|'kids'|'');setFilterCategory('');setPage(0)}}>
        <option value="">All departments</option><option value="men">Men’s Wear</option><option value="kids">Kids Wear</option></select>
      <select className={inputClass} aria-label="Filter media collection" value={filterCategory} onChange={e=>{setFilterCategory(e.target.value);setPage(0)}}>
        <option value="">All garment types</option>{collectionsFor(filterDept).map(c=><option key={c.path} value={c.path}>{c.title}</option>)}</select>
      <select className={inputClass} aria-label="Media archive status" value={archivedFilter} onChange={e=>{setArchivedFilter(e.target.value as 'active'|'archived');setPage(0)}}>
        <option value="active">Active media</option><option value="archived">Archived media</option></select>
      <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2 xl:col-span-3">
        <p role="status" className="text-xs text-stone-500">{total.toLocaleString('en-IN')} matching assets · 30 per page</p>
        <button type="button" className="min-h-11 text-xs font-semibold text-amber-900 underline underline-offset-4"
          onClick={()=>{setSearch('');setTypeFilter('all');setApprovalFilter('all');setFilterDept('');setFilterCategory('');setArchivedFilter('active');setPage(0);}}>Clear filters</button>
      </div>
    </div>
    <ErrorText message={error}/>
    {loading ? <p className="text-sm text-stone-500">Loading media…</p> :
      rows.length===0 ? <p className="rounded-lg bg-stone-100 p-8 text-sm">There are no assets yet. Add the owner's approved product photographs first.</p> :
      <div className="nb-responsive-grid grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((asset)=>{
          const url=asset.approved ? mediaPublicUrl(asset.storage_path) : (privatePreviews[asset.id] || '');
          return <article key={asset.id} className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
            {url ? (asset.mime_type.startsWith('image/') ? <img loading="lazy" decoding="async" src={url} alt={asset.alt_text || asset.original_name} className="aspect-[4/3] w-full bg-stone-100 object-cover"/> :
              <video preload="none" controls src={url} className="aspect-[4/3] w-full bg-stone-950" aria-label={asset.original_name}/>) :
              <div className="flex aspect-[4/3] flex-col items-center justify-center gap-3 bg-stone-100 p-4 text-center">
                <p className="text-xs text-stone-600">Private pending asset</p>
                <button type="button" className={outlineClass} disabled={busyId===asset.id} onClick={()=>void previewPrivate(asset)}>Preview privately (2 minutes)</button>
              </div>}
            <div className="space-y-2 p-4">
              <p className="truncate text-sm font-semibold" title={asset.original_name}>{asset.original_name}</p>
              <p className="break-words text-xs text-stone-500">{(asset.size_bytes/1024/1024).toFixed(2)} MB · {asset.mime_type} · {asset.department||'General'} / {asset.category_path||'Unsorted'}</p>
              {asset.archived_at&&<p className="text-xs font-bold text-amber-800">Archived (not available in asset pickers)</p>}
              <p className={'text-xs font-semibold ' + (asset.approved?'text-emerald-700':'text-amber-700')}>
                {asset.approved?'Approved for publication':'Awaiting approval'}
              </p>
              <label className="block text-xs font-semibold text-stone-700">
                Media display name
                <input type="text" className={inputClass+' mt-2'} maxLength={220}
                  value={nameDrafts[asset.id]??asset.original_name}
                  disabled={!canPublish && (asset.approved || asset.uploaded_by!==userId)}
                  onChange={e=>setNameDrafts(current=>({...current,[asset.id]:e.target.value}))}/>
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-xs font-semibold">Department
                  <select className={inputClass+' mt-1'} value={tags[asset.id]?.department||''}
                    disabled={!canPublish && (asset.approved || asset.uploaded_by!==userId)}
                    onChange={e=>setTags(current=>({...current,[asset.id]:{...current[asset.id],department:(e.target.value||null) as 'men'|'kids'|null,category_path:null}}))}>
                    <option value="">General</option><option value="men">Men’s Wear</option><option value="kids">Kids Wear</option></select></label>
                <label className="text-xs font-semibold">Garment type
                  <select className={inputClass+' mt-1'} value={tags[asset.id]?.category_path||''}
                    disabled={!canPublish && (asset.approved || asset.uploaded_by!==userId)}
                    onChange={e=>setTags(current=>({...current,[asset.id]:{...current[asset.id],category_path:e.target.value||null}}))}>
                    <option value="">Unsorted</option>{collectionsFor(tags[asset.id]?.department||'').map(c=><option key={c.path} value={c.path}>{c.title}</option>)}
                  </select></label>
              </div>
              <label className="block text-xs font-semibold text-stone-700">
                {asset.mime_type.startsWith('video/')?'Video description':'Image alternative text'}
                <input type="text" maxLength={400} className={inputClass+' mt-2'} value={altDrafts[asset.id]??asset.alt_text}
                  disabled={!canPublish && (asset.approved || asset.uploaded_by!==userId)}
                  onChange={e=>setAltDrafts((current)=>({...current,[asset.id]:e.target.value}))}/>
              </label>
              <div className="flex flex-wrap gap-2">
                {(canPublish || (!asset.approved && asset.uploaded_by===userId)) && <button type="button"
                  disabled={busyId===asset.id || ((altDrafts[asset.id]??asset.alt_text)===asset.alt_text && (nameDrafts[asset.id]??asset.original_name)===asset.original_name
                    && (tags[asset.id]?.department??null)===asset.department && (tags[asset.id]?.category_path??null)===asset.category_path)}
                  onClick={()=>void saveDescription(asset)} className={outlineClass}>Save edits</button>}
                {canPublish && <button type="button" disabled={busyId===asset.id} onClick={()=>void approve(asset)} className={outlineClass}>
                  <CheckCircle2 size={15}/>{asset.approved?'Revoke approval':'Approve'}
                </button>}
                {canPublish&&<button type="button" disabled={busyId===asset.id} onClick={()=>void toggleArchive(asset)} className={outlineClass}>
                  {asset.archived_at?<RotateCcw size={15}/>:<Archive size={15}/>} {asset.archived_at?'Restore':'Archive'}
                </button>}
                {canPublish&&<button type="button" disabled={busyId===asset.id}
                  onClick={()=>void deleteMedia(asset)} className={outlineClass+' border-red-300 text-red-800'}>
                  <Trash2 size={15}/> Delete permanently
                </button>}
                {asset.approved && <button type="button" className={outlineClass} onClick={()=>void navigator.clipboard.writeText(url)}>Copy public URL</button>}
              </div>
            </div>
          </article>;
        })}
      </div>}
    {total>30&&<nav aria-label="Media pages" className="flex flex-wrap items-center justify-center gap-3">
      <button type="button" className={outlineClass} disabled={page===0}
        onClick={()=>setPage(current=>Math.max(0,current-1))}>Previous</button>
      <span className="text-sm">Page {page+1} / {Math.ceil(total/30)}</span>
      <button type="button" className={outlineClass} disabled={(page+1)*30>=total}
        onClick={()=>setPage(current=>current+1)}>Next</button>
    </nav>}
  </section>;
}
