import React, {useEffect,useRef,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {ArrowDown,ArrowUp,CloudUpload,ImagePlus,Pencil,Trash2,Video,GripVertical} from 'lucide-react';
import type {CmsMediaRow} from '../../lib/cmsData';
import {mediaPublicUrl} from '../../lib/cmsData';
import {runWithConcurrency,uploadCmsFile,checkMediaFile} from '../../lib/cmsUpload';
import {COLLECTION_ROUTES} from '../../storefront/navigation';
import {ErrorText,inputClass,labelClass,outlineClass,primaryClass} from './StudioShared';

const MEDIA_COLS='id,storage_path,original_name,mime_type,size_bytes,alt_text,department,category_path,archived_at,approved,uploaded_by,created_at';
type Dept='men'|'kids'|'';
interface Props {
  client:SupabaseClient;label:string;
  selected:string[];onChange:(urls:string[])=>void;multiple?:boolean;allowVideo?:boolean;
  userId?:string;canPublish?:boolean;department?:Dept;categoryPath?:string;
  onUploaded?:()=>void;
}
/** Edit or unlink a selected asset without ever deleting shared Storage objects.
 * New local files are uploaded into private staging and approved server-side
 * only for current owners/admins; everyone else must use the review queue.
 */
export default function AssetEditor({client,label,selected,onChange,multiple=false,allowVideo=false,
  userId,canPublish=false,department='',categoryPath='',onUploaded}:Props){
  const [term,setTerm]=useState('');
  const [dept,setDept]=useState<Dept>(department);
  const [category,setCategory]=useState(categoryPath);
  const [page,setPage]=useState(0);
  const [rows,setRows]=useState<CmsMediaRow[]>([]);
  const [total,setTotal]=useState(0);
  const [loading,setLoading]=useState(false);
  const [uploading,setUploading]=useState(false);
  const [progress,setProgress]=useState(0);
  const [error,setError]=useState<string|null>(null);
  const [notice,setNotice]=useState<string|null>(null);
  const [dragging,setDragging]=useState(false);
  const [reload,setReload]=useState(0);
  const [deletingUrl,setDeletingUrl]=useState<string|null>(null);
  const [showLibrary,setShowLibrary]=useState(false);
  const input=useRef<HTMLInputElement>(null);
  useEffect(()=>{setDept(department);setCategory(categoryPath);setPage(0)},[department,categoryPath]);
  useEffect(()=>{
    if(!showLibrary){setLoading(false);return;}
    let alive=true;setLoading(true);
    const timer=setTimeout(async()=>{
      const search=term.replace(/[^a-zA-Z0-9 _.-]/g,' ').trim().slice(0,60);
      let query=client.from('nb_media').select(MEDIA_COLS,{count:'exact'})
        .eq('approved',true).is('archived_at',null)
        .like('mime_type',allowVideo?'video/%':'image/%');
      if(dept)query=query.eq('department',dept);
      if(category)query=query.eq('category_path',category);
      if(search)query=query.ilike('original_name','%'+search+'%');
      const {data,count,error}=await query.order('created_at',{ascending:false}).range(page*24,page*24+23);
      if(!alive)return;
      setRows((data||[]) as CmsMediaRow[]);setTotal(count||0);
      setLoading(false);setError(error?.message||null);
    },220);
    return()=>{alive=false;clearTimeout(timer)};
  },[client,term,dept,category,page,allowVideo,reload,showLibrary]);
  const choose=(url:string)=>{
    if(multiple)onChange(selected.includes(url)?selected.filter(x=>x!==url):[...selected,url]);
    else onChange(selected.includes(url)?[]:[url]);
  };
  const filesFromComputer=async(files:File[])=>{
    if(!userId||!files.length||uploading)return;
    setError(null);setNotice(null);setUploading(true);
    const progressByFile=files.map(()=>0);
    const weights=files.map(file=>Math.max(1,file.size));
    const totalBytes=weights.reduce((sum,n)=>sum+n,0);
    try{
      const results=await runWithConcurrency(files,multiple?3:1,async(file,index)=>{
        if(allowVideo!==file.type.startsWith('video/'))
          throw new Error(allowVideo?'Choose MP4 or WebM video files.':'Choose JPG/PNG/WebP/AVIF/GIF photographs.');
        const validation=checkMediaFile(file);if(validation)throw new Error(validation);
        const asset=await uploadCmsFile(client,file,userId,percent=>{
          progressByFile[index]=percent;
          const transferred=progressByFile.reduce((sum,p,i)=>sum+weights[i]*p/100,0);
          setProgress(Math.min(100,Math.round(100*transferred/totalBytes)));
        },{
          department:dept||null,categoryPath:category||null,
        });
        let approved=false;
        if(canPublish){
          const {data,error}=await client.functions.invoke('nb-media-approval',{
            body:{id:asset.id,action:'approve'},
          });
          approved=!error&&Boolean(data?.ok);
        }
        return {asset,approved};
      });
      const uploaded=results.filter((x):x is {ok:true;value:{asset:CmsMediaRow;approved:boolean}}=>x.ok)
        .map(x=>x.value);
      const failed=results.filter((x):x is {ok:false;error:unknown}=>x.ok===false);
      const approvedUrls=uploaded.filter(x=>x.approved).map(x=>mediaPublicUrl(x.asset.storage_path));
      let next=[...selected];
      if(multiple)next=[...new Set([...next,...approvedUrls])];
      else if(approvedUrls.length)next=[approvedUrls.at(-1)!];
      if(approvedUrls.length)onChange(next);
      const pending=uploaded.filter(x=>!x.approved).length;
      if(failed.length){
        const first=failed[0];
        const reason=first
          ?(first.error instanceof Error?first.error.message:'Upload failed.'):'Upload failed.';
        setError(uploaded.length+' file(s) uploaded; '+failed.length+' failed. Retry the failed file(s). '+reason);
      }
      if(pending)setNotice(pending+' file(s) uploaded privately to Media → Pending. An owner/admin must approve before selecting.');
      else if(approvedUrls.length)setNotice(approvedUrls.length+' photo(s) compressed where possible, uploaded, approved and selected. Save your draft to keep this change.');
      else if(!failed.length)setNotice('Upload complete.');
      setPage(0);setReload(n=>n+1);onUploaded?.();
    }catch(e){setError(e instanceof Error?e.message:'Upload failed.');}
    finally{setUploading(false);setProgress(0);setDragging(false);}
  };
  const deleteFromDatabase=async(url:string)=>{
    if(!canPublish)return;
    if(!window.confirm('Permanently DELETE this file from both Supabase Storage and the database?\n\nIf it is used by a published page or saved draft, deletion will be refused. This cannot be undone.'))return;
    setDeletingUrl(url);setError(null);setNotice(null);
    try{
      const prefix=mediaPublicUrl('');
      if(!prefix || !url.startsWith(prefix))throw new Error('Only files from this store\'s Media library can be permanently deleted.');
      const storagePath=decodeURIComponent(url.slice(prefix.length));
      if(!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp|avif|gif|mp4|webm)$/i.test(storagePath))
        throw new Error('This media file needs manual review before deletion.');
      const {data:asset,error:findError}=await client.from('nb_media')
        .select('id').eq('storage_path',storagePath).maybeSingle();
      if(findError)throw findError;
      if(!asset)throw new Error('Media record not found. Refresh the library.');
      const {data,error}=await client.functions.invoke('nb-media-approval',{body:{id:asset.id,action:'delete'}});
      if(error || !data?.ok)throw new Error(data?.error||error?.message||'Deletion blocked by Supabase.');
      onChange(selected.filter(x=>x!==url));
      setNotice('File permanently removed from Supabase Storage and its media database record.');
      setReload(n=>n+1);onUploaded?.();
    }catch(cause){
      setError((cause instanceof Error?cause.message:'Deletion failed.')+
        ' If this image is live, first remove it from the page, Save draft and Publish website changes. Then delete it here or in Media.');
    }finally{setDeletingUrl(null);}
  };
  const move=(index:number,target:number)=>{
    if(target<0||target>=selected.length)return;
    const copy=[...selected];const [item]=copy.splice(index,1);copy.splice(target,0,item);onChange(copy);
  };
  const categories=COLLECTION_ROUTES.filter(route=>!route.isDepartment&&!route.isGroup&&(!dept||route.department===dept));
  return <section aria-label={label} className="min-w-0 space-y-3 rounded-lg border border-stone-200 bg-[#fffefb] p-3 min-[360px]:p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className={labelClass}>{label}</p><p className="text-xs text-stone-500">Trash removes the image from this page; Delete from Supabase permanently erases the file only after all published and saved-draft references are cleared.</p></div>
      <button type="button" className={outlineClass} onClick={()=>setShowLibrary(x=>!x)}>
        <Pencil size={15}/>{showLibrary?'Close library':'Choose / replace'}
      </button>
    </div>
    <div className="nb-responsive-grid grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {selected.map((url,index)=><div key={url} draggable={multiple}
        onDragStart={e=>e.dataTransfer.setData('text/x-nb-selected-index',String(index))}
        onDragOver={e=>e.preventDefault()}
        onDrop={e=>{e.preventDefault();const raw=e.dataTransfer.getData('text/x-nb-selected-index');
          if(raw!=='' && /^\d+$/.test(raw))move(Number(raw),index)}}
        className="relative overflow-hidden rounded-md border border-amber-300 bg-stone-100">
        {allowVideo?<div className="flex aspect-[4/3] items-center justify-center bg-stone-900 text-white"><Video size={30}/></div>:
          <img className="aspect-[4/3] w-full object-cover" alt={'Selected '+label} src={url} loading="lazy"/>}
        <div className="flex flex-wrap items-center justify-between gap-1 bg-white p-2">
          <span className="inline-flex min-w-0 items-center text-[11px] text-stone-600">{multiple&&<GripVertical size={13}/>} {index===0?'Cover':'Image '+(index+1)}</span>
          {multiple&&<button type="button" aria-label="Move selected photo up" disabled={index===0} className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md disabled:opacity-40" onClick={()=>move(index,index-1)}><ArrowUp size={16}/></button>}
          {multiple&&<button type="button" aria-label="Move selected photo down" disabled={index===selected.length-1} className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md disabled:opacity-40" onClick={()=>move(index,index+1)}><ArrowDown size={16}/></button>}
          <button type="button" aria-label={'Remove '+label+' '+(index+1)+' from this draft'} title="Remove from this section only (keep the original in Media)" className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md text-red-700 hover:bg-red-50"
            onClick={()=>onChange(selected.filter((_,i)=>i!==index))}><Trash2 size={17}/></button>
          {canPublish&&<button type="button" disabled={deletingUrl!==null}
            title="Erase the file from Storage AND its database record once unused"
            onClick={()=>void deleteFromDatabase(url)}
            className="min-h-10 rounded-md border border-red-200 px-2 text-[10px] font-semibold text-red-800 disabled:opacity-50">
            {deletingUrl===url?'Deleting…':'Delete from Supabase'}
          </button>}
        </div>
      </div>)}
      {!selected.length&&<div className="flex min-h-28 items-center justify-center rounded-md border border-dashed border-stone-300 text-xs text-stone-500">No {allowVideo?'video':'photograph'} selected</div>}
    </div>
    {userId&&<div role="button" tabIndex={0} aria-label={'Drop or choose '+label}
      onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();input.current?.click()}}}
      onClick={()=>input.current?.click()}
      onDragOver={e=>{e.preventDefault();setDragging(true)}}
      onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setDragging(false)}}
      onDrop={e=>{e.preventDefault();e.stopPropagation();setDragging(false);void filesFromComputer(Array.from(e.dataTransfer.files))}}
      className={'flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-5 text-center '+(dragging?'border-amber-800 bg-amber-50':'border-stone-300 bg-stone-50')}>
      <CloudUpload size={27}/><p className="text-sm font-semibold">{uploading?'Uploading '+progress+'%':'Drag & drop '+(allowVideo?'a video':'photos')+' here'}</p>
      <p className="text-xs text-stone-500">Or click to browse your computer · up to 50 MB each · uploads are private until approved</p>
      <input ref={input} type="file" className="sr-only" multiple={multiple}
        accept={allowVideo?'video/mp4,video/webm':'image/jpeg,image/png,image/webp,image/avif,image/gif'}
        onChange={e=>{void filesFromComputer(Array.from(e.currentTarget.files||[]));e.currentTarget.value='';}}/>
    </div>}
    {showLibrary&&<div className="space-y-3 border-t border-stone-200 pt-4">
      <div className="nb-responsive-grid grid gap-2 md:grid-cols-3">
        <div><label className={labelClass}>Department</label><select className={inputClass} value={dept} onChange={e=>{setDept(e.target.value as Dept);setCategory('');setPage(0)}}>
          <option value="">All assets</option><option value="men">Men’s Wear</option><option value="kids">Kids Wear</option></select></div>
        <div><label className={labelClass}>Collection</label><select className={inputClass} value={category} onChange={e=>{setCategory(e.target.value);setPage(0)}}>
          <option value="">All categories</option>{categories.map(x=><option key={x.path} value={x.path}>{x.title}</option>)}</select></div>
        <div><label className={labelClass}>Search name</label><input type="search" className={inputClass} value={term}
          onChange={e=>{setTerm(e.target.value);setPage(0)}} placeholder="Sherwani 1, SKU…"/></div>
      </div>
      {loading?<p role="status" className="p-3 text-xs">Searching approved media…</p>:rows.length===0?<p className="p-3 text-xs text-stone-500">No approved items in this category yet. Drop a file above or use Media.</p>:
        <div className="nb-responsive-grid grid max-h-80 grid-cols-2 gap-2 overflow-auto sm:grid-cols-3 xl:grid-cols-4">{rows.map(asset=>{
          const url=mediaPublicUrl(asset.storage_path);const isSelected=selected.includes(url);
          return <button type="button" key={asset.id} title={asset.original_name} onClick={()=>choose(url)}
            className={'overflow-hidden rounded-md border-2 text-left '+(isSelected?'border-amber-700 bg-amber-50':'border-stone-200 bg-white')}>
            {allowVideo?<div className="flex aspect-[4/3] items-center justify-center bg-stone-800 text-white"><Video/></div>:
              <img src={url} alt={asset.alt_text||asset.original_name} loading="lazy" className="aspect-[4/3] w-full object-cover"/>}
            <div className="flex items-center justify-between gap-1 p-2 text-[11px]">
              <span className="truncate">{asset.original_name}</span>{isSelected&&<span className="font-semibold text-amber-800">✓</span>}
            </div>
          </button>;
        })}</div>}
      {total>24&&<div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <button type="button" className={outlineClass} disabled={page===0} onClick={()=>setPage(x=>x-1)}>Previous</button>
        <span>{page+1} / {Math.ceil(total/24)} · {total} assets</span>
        <button type="button" className={outlineClass} disabled={(page+1)*24>=total} onClick={()=>setPage(x=>x+1)}>Next</button></div>}
    </div>}
    <ErrorText message={error}/>
    {notice&&<p role="status" className="text-xs leading-6 text-amber-800">{notice}</p>}
  </section>;
}
