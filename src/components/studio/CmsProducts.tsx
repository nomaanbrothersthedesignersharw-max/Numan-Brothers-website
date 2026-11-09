import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ArrowLeft, ArrowRight, Plus, Save, Send, Archive, Trash2 } from 'lucide-react';
import { type CmsProductRow, isSafeHttps } from '../../lib/cmsData';
import { COLLECTION_ROUTES } from '../../storefront/navigation';
import { productPath } from '../../storefront/catalog';
import AssetEditor from './AssetEditor';
import {ErrorText,Field,inputClass,outlineClass,primaryClass} from './StudioShared';

interface Props {client:SupabaseClient;userId:string;canPublish:boolean;}
interface Draft {
  sku:string;slug:string;title:string;department:'men'|'kids';categoryPaths:string[];
  description:string;fabric:string;sizes:string[];imageUrls:string[];videoUrls:string[];videoUrl:string;
  price:string;offerPrice:string;customizable:boolean;sortRank:number;
}
type ProductRevision={id:number;version:number;published_at:string;content:unknown};
type Entry={id:string;label:string;sku:string;live:boolean;draft:boolean;form:Draft};
const blank: Draft = {
  sku:'',slug:'',title:'',department:'men',categoryPaths:[],description:'',
  fabric:'',sizes:[],imageUrls:[],videoUrls:[],videoUrl:'',price:'',offerPrice:'',customizable:false,sortRank:0,
};
const fromPublished=(p:CmsProductRow):Draft=>({
  sku:p.sku,slug:p.slug,title:p.title,department:p.department,
  categoryPaths:p.category_paths||[],description:p.description||'',fabric:p.fabric||'',
  sizes:p.sizes||[],imageUrls:p.image_urls||[],videoUrls:p.video_urls||[],
  videoUrl:p.video_url && !(p.video_urls||[]).includes(p.video_url) ? p.video_url : '',
  price:p.price===null?'':String(p.price),
  offerPrice:p.offer_price===null?'':String(p.offer_price),
  customizable:Boolean(p.customizable),sortRank:p.sort_rank||0,
});
const fromUnknown=(value:unknown):Draft=>{
  const d=(value && typeof value==='object' && !Array.isArray(value)?value:{}) as Partial<Draft>;
  return {
    ...blank,...d,
    department:d.department==='kids'?'kids':'men',
    categoryPaths:Array.isArray(d.categoryPaths)?d.categoryPaths.filter((x):x is string=>typeof x==='string'):[],
    imageUrls:Array.isArray(d.imageUrls)?d.imageUrls.filter((x):x is string=>typeof x==='string'):[],
    sizes:Array.isArray(d.sizes)?d.sizes.filter((x):x is string=>typeof x==='string'):[],
    videoUrls:Array.isArray(d.videoUrls)?d.videoUrls.filter((x):x is string=>typeof x==='string').slice(0,200):[],
    price:typeof d.price==='string'?d.price:'',
    offerPrice:typeof d.offerPrice==='string'?d.offerPrice:'',
    customizable:Boolean(d.customizable),
    sortRank:typeof d.sortRank==='number'?d.sortRank:0,
  };
};
function validate(form:Draft):string|null {
  if(form.title.trim().length<2)return 'Enter a product name.';
  if(!form.categoryPaths.length)return 'Select a garment type first.';
  if(form.sku && !/^NB-[A-Z]{2,3}-[0-9]{5}$/.test(form.sku) &&
    !/^[A-Z0-9][A-Z0-9-]{1,79}$/.test(form.sku))
      return 'Use an uppercase SKU such as NB-KP-00001.';
  if(form.sku.trim().length<2)return 'SKU must contain at least two characters.';
  if(!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(form.slug))return 'Slug must use lowercase letters, digits and hyphens.';
  if(!form.categoryPaths.length)return 'Choose at least one collection before publishing.';
  if(!form.imageUrls.length)return 'Choose at least one approved product photograph.';
  if(form.videoUrl && !isSafeHttps(form.videoUrl))return 'The optional video link must use HTTPS.';
  if(form.videoUrls.length>200)return 'A product can have at most 200 video references.';
  if(form.videoUrls.some(url=>!isSafeHttps(url)))return 'Every video URL must use HTTPS.';
  if(form.videoUrl && !form.videoUrls.includes(form.videoUrl) && form.videoUrls.length>=200)return 'A product can have at most 200 video references.';
  if(form.price && (!Number.isFinite(Number(form.price))||Number(form.price)<0))return 'Enter a valid original price.';
  if(form.offerPrice && (!form.price||!Number.isFinite(Number(form.offerPrice))||
    Number(form.offerPrice)<0||Number(form.offerPrice)>=Number(form.price)))
    return 'Offer price must be lower than the original price.';
  return null;
}
export default function CmsProducts({client,userId,canPublish}:Props){
  const [rows,setRows]=useState<Entry[]>([]);
  const [loading,setLoading]=useState(true);
  const [page,setPage]=useState(0);
  const [id,setId]=useState<string|null>(null);
  const [publishedSlug,setPublishedSlug]=useState<string|null>(null);
  const [form,setForm]=useState<Draft>({...blank});
  const [isNew,setIsNew]=useState(false);
  const [skuLoading,setSkuLoading]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [message,setMessage]=useState<string|null>(null);
  const [totalCount,setTotalCount]=useState(0);
  const [search,setSearch]=useState('');
  const [statusFilter,setStatusFilter]=useState('all');
  const [departmentFilter,setDepartmentFilter]=useState('all');
  const [revisions,setRevisions]=useState<ProductRevision[]>([]);
  const [revisionsLoading,setRevisionsLoading]=useState(false);
  const [dirty,setDirty]=useState(false);
  const [saveState,setSaveState]=useState<'idle'|'saving'|'saved'|'failed'>('idle');
  const [lastSavedAt,setLastSavedAt]=useState<string|null>(null);
  const latestFormRef=useRef(form);
  const latestIdRef=useRef(id);
  const savedSnapshotRef=useRef('');
  const draftSaveQueue=useRef<Promise<void>>(Promise.resolve());
  latestFormRef.current=form;
  latestIdRef.current=id;
  const active=rows.find((r)=>r.id===id);
  const categories=COLLECTION_ROUTES.filter((c)=>!c.isDepartment && !c.isGroup && c.department===form.department);
  // Asset pickers query only when opened; published URLs are verified server-side.
  const load=async()=>{
    setLoading(true);setError(null);
    let query=client.from('nb_studio_product_index')
      .select('id,title,sku,department,status,has_draft,updated_at',{count:'exact'});
    const term=search.replace(/[^a-zA-Z0-9 -]/g,' ').trim().slice(0,72);
    if(term)query=query.or('title.ilike.%'+term+'%,sku.ilike.%'+term+'%');
    if(statusFilter!=='all')query=query.eq('status',statusFilter);
    if(departmentFilter!=='all')query=query.eq('department',departmentFilter);
    const {data,count,error}=await query.order('updated_at',{ascending:false})
      .order('id',{ascending:true}).range(page*50,page*50+49);
    if(error)setError(error.message);
    setRows((data||[]).map(item=>({
      id:item.id as string,label:item.title as string,sku:item.sku as string,live:item.status==='published',
      draft:Boolean(item.has_draft),form:{...blank},
    })));
    setTotalCount(count||0);
    setLoading(false);
  };
  useEffect(()=>{
    const timer=setTimeout(()=>{void load()},250);
    return()=>clearTimeout(timer);
  },[page,client,search,statusFilter,departmentFilter]);
  const loadRevisions=async(productId:string)=>{
    setRevisionsLoading(true);
    const {data,error}=await client.from('nb_product_revisions')
      .select('id,version,published_at,content')
      .eq('product_id',productId)
      .order('version',{ascending:false})
      .limit(15);
    if(error)setError(error.message);
    else setRevisions((data||[]) as ProductRevision[]);
    setRevisionsLoading(false);
  };
  const persistDraft=useCallback(async(productId:string,snapshot:Draft,announce=false):Promise<boolean>=>{
    const serialized=JSON.stringify(snapshot);
    const snapshotKey=productId+':'+serialized;
    if(savedSnapshotRef.current===snapshotKey)return true;
    setSaveState('saving');
    const operation=draftSaveQueue.current.then(async()=>{
      const {error}=await client.from('nb_product_drafts').upsert({
        product_id:productId,content:snapshot,updated_by:userId,
      },{onConflict:'product_id'});
      if(error)throw error;
      savedSnapshotRef.current=snapshotKey;
      setRows(current=>{
        const exists=current.some(item=>item.id===productId);
        const nextEntry:Entry={id:productId,label:snapshot.title.trim()||'(Untitled draft)',
          sku:snapshot.sku,live:current.find(item=>item.id===productId)?.live||false,
          draft:true,form:{...blank}};
        return exists?current.map(item=>item.id===productId?{...item,...nextEntry}:item):[nextEntry,...current];
      });
      if(latestIdRef.current===productId&&JSON.stringify(latestFormRef.current)===serialized){
        setDirty(false);
        setSaveState('saved');
        setLastSavedAt(new Date().toISOString());
      }
      if(announce)setMessage('Draft saved privately. This change is not visible to customers.');
    });
    draftSaveQueue.current=operation.then(()=>undefined,()=>undefined);
    try{await operation;return true;}
    catch(cause){
      if(latestIdRef.current===productId){
        setSaveState('failed');
        setError('Auto-save failed: '+(cause instanceof Error?cause.message:'database error')+'. Your edits remain on screen; retry Save private draft.');
      }
      return false;
    }
  },[client,userId]);

  // Persist incomplete product drafts as the user types. The database accepts
  // partial JSON drafts; validation is enforced at publish, not during editing.
  useEffect(()=>{
    if(!id||!dirty)return;
    const productId=id;
    const snapshot={...form};
    const timer=setTimeout(()=>{void persistDraft(productId,snapshot);},650);
    return()=>clearTimeout(timer);
  },[id,form,dirty,persistDraft]);
  const open=async(entry:Entry)=>{
    const currentId=latestIdRef.current;
    if(currentId&&dirty){
      const flushed=await persistDraft(currentId,latestFormRef.current);
      if(!flushed)return;
    }
    setIsNew(false);setId(entry.id);setPublishedSlug(null);setError(null);setMessage(null);setBusy(true);setDirty(false);setSaveState('idle');
    setRevisions([]);void loadRevisions(entry.id);
    const [draft,published]=await Promise.all([
      client.from('nb_product_drafts').select('content').eq('product_id',entry.id).maybeSingle(),
      client.from('nb_products')
        .select('id,sku,slug,title,department,category_paths,description,fabric,sizes,image_urls,video_url,price,offer_price,customizable,status,sort_rank,created_at,updated_at')
        .eq('id',entry.id).maybeSingle(),
    ]);
    if(draft.error||published.error)setError(draft.error?.message||published.error?.message||'Cannot open product');
    else {
      setPublishedSlug(published.data?.status==='published'?String(published.data.slug||''):null);
      setForm(draft.data?fromUnknown(draft.data.content):
      published.data?fromPublished(published.data as CmsProductRow):{...blank});
      setDirty(false);setSaveState(draft.data?'saved':'idle');
    }
    setBusy(false);
  };
  const update=<K extends keyof Draft>(key:K,value:Draft[K])=>{
    setDirty(true);setSaveState('idle');
    setForm(current=>({...current,[key]:value}));
  };
  const create=async()=>{
    const currentId=latestIdRef.current;
    if(currentId){
      setBusy(true);
      const flushed=await persistDraft(currentId,latestFormRef.current);
      setBusy(false);
      if(!flushed)return;
    }
    const productId=crypto.randomUUID();
    const fresh={...blank};
    setId(productId);setPublishedSlug(null);setIsNew(true);setForm(fresh);
    setDirty(false);setSaveState('saving');setLastSavedAt(null);
    setRevisions([]);setError(null);setMessage('New private draft created. Your edits will save automatically.');
    void persistDraft(productId,fresh).then(saved=>{
      if(saved&&latestIdRef.current===productId)setSaveState('saved');
    });
  };
  const backToList=async()=>{
    const currentId=latestIdRef.current;
    if(currentId){
      setBusy(true);
      const flushed=await persistDraft(currentId,latestFormRef.current);
      setBusy(false);
      if(!flushed)return;
    }
    setId(null);setPublishedSlug(null);setIsNew(false);setForm({...blank});
    setDirty(false);setSaveState('idle');setError(null);
  };
  const slugify=(value:string)=>value.normalize('NFKD').toLowerCase()
    .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,110);
  const chooseCategory=async(path:string)=>{
    if(!path)return;
    setDirty(true);setSaveState('idle');
    setForm(current=>({...current,categoryPaths:[path]}));
    // A draft reopened after navigation/reload may still need its first SKU.
    if(form.sku)return;
    setSkuLoading(true);setError(null);
    const {data,error}=await client.rpc('nb_next_sku',{p_category_path:path});
    if(error)setError('Could not generate SKU: '+error.message);
    else if(data&&latestFormRef.current.categoryPaths[0]===path){
      const sku=String(data);
      setForm(current=>{
        const oldAuto=[slugify(current.title),current.sku.toLowerCase()].filter(Boolean).join('-');
        const previousAuto=current.slug===''||current.slug===oldAuto||current.slug===current.sku.toLowerCase();
        return {...current,sku,slug:previousAuto
          ?[slugify(current.title),sku.toLowerCase()].filter(Boolean).join('-')
          :current.slug};
      });
    }
    setSkuLoading(false);
  };
  const save=async():Promise<boolean>=>{
    if(!id)return false;
    setBusy(true);setError(null);setMessage(null);
    try{
      if(form.title.trim().length<2||form.sku.trim().length<2||!form.categoryPaths.length)
        throw new Error('Choose a garment type, enter a title and generate a unique SKU before saving.');
      if(!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(form.slug))throw new Error('Use a lowercase hyphenated slug.');
      const saved=await persistDraft(id,form,true);
      if(!saved)throw new Error('Draft could not be saved. See the auto-save message above.');
      await load();return true;
    }catch(cause){setError(cause instanceof Error?cause.message:'Draft save failed.');return false}
    finally{setBusy(false)}
  };
  const publish=async()=>{
    if(!id||!canPublish)return;
    const err=validate(form);
    if(err){setError(err);return;}
    // Do not validate against the 300 most recent assets: this rejects
    // valid approved garments in a large library. The security-invoker SQL
    // publish RPC verifies *every* asset is actually approved for this project.
    if(!await save())return;
    setBusy(true);setError(null);
    const {data,error}=await client.rpc('nb_publish_product',{p_product_id:id});
    setBusy(false);
    if(error){setError(error.message);return;}
    setPublishedSlug(form.slug);
    setMessage('Product version '+data+' published. Your garment now has its own public page.');
    await Promise.all([load(),loadRevisions(id)]);
  };
  const discardDraft=async()=>{
    if(!id||!window.confirm('Discard this private product draft? Published content stays visible.'))return;
    setBusy(true);setError(null);
    const {error}=await client.from('nb_product_drafts').delete().eq('product_id',id);
    if(error){setError(error.message);setBusy(false);return;}
    const original=active;
    if(original?.live){await open(original);setMessage('Draft discarded; published garment unchanged.');}
    else{setId(null);setPublishedSlug(null);setForm({...blank});setMessage('Private draft discarded.');}
    await load();setBusy(false);
  };
  const archiveProduct=async()=>{
    if(!id||!canPublish||!window.confirm('Archive this garment? Customers will no longer see it. It can be republished later.'))return;
    setBusy(true);setError(null);setMessage(null);
    const {error}=await client.rpc('nb_archive_product',{p_product_id:id});
    if(error)setError(error.message);
    else{setId(null);setPublishedSlug(null);setMessage('Product archived and hidden from the live catalogue.');await load();}
    setBusy(false);
  };
  return <section className="space-y-7">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><h2 className="font-serif text-3xl">Products</h2><p className="mt-2 text-sm text-stone-600">Create and edit private drafts; approved owners publish changes atomically.</p></div>
      <div className="flex flex-wrap gap-2">
<button type="button" className={primaryClass} onClick={()=>void create()} disabled={busy}><Plus size={16}/> New product</button>
       </div>
    </div>
    <div className="nb-responsive-grid grid gap-3 rounded-lg border border-stone-200 bg-white p-3 min-[360px]:p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,auto)_minmax(0,auto)]">
      <input className={inputClass} type="search" aria-label="Search products by name or SKU"
        placeholder="Search by garment name or SKU…" value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}}/>
      <select aria-label="Filter product status" className={inputClass} value={statusFilter}
        onChange={e=>{setStatusFilter(e.target.value);setPage(0);}}>
        <option value="all">All statuses</option><option value="published">Published</option>
        <option value="draft">Draft</option><option value="archived">Archived</option>
      </select>
      <select aria-label="Filter department" className={inputClass} value={departmentFilter}
        onChange={e=>{setDepartmentFilter(e.target.value);setPage(0);}}>
        <option value="all">All departments</option><option value="men">Men's Wear</option><option value="kids">Kids Wear</option>
      </select>
      <p className="text-xs text-stone-500 sm:col-span-3">{totalCount.toLocaleString('en-IN')} records · 50 per page</p>
    </div>
    <div className="nb-responsive-grid grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
      <div className="max-h-60 space-y-2 overflow-y-auto xl:max-h-[800px] rounded-lg border border-stone-200 bg-white p-3">
        {loading?<p className="p-3 text-sm">Loading catalogue…</p>:rows.length===0?<p className="p-3 text-sm text-stone-600">No products yet. Add the first genuine garment.</p>:
          rows.map((item)=><button type="button" key={item.id} onClick={()=>open(item)}
            className={'w-full rounded-md px-3 py-3 text-left '+
              (item.id===id?'bg-stone-900 text-white':'hover:bg-stone-100')}>
            <span className="block text-sm font-semibold">{item.label}</span>
             <span className="mt-1 block font-mono text-xs font-semibold">{item.sku}</span>
             <span className="mt-1 block text-[11px] font-semibold underline">{item.live?'Edit published product':'Continue editing draft'}</span>
            <span className={'mt-1 block text-xs '+(item.id===id?'text-stone-300':'text-stone-500')}>
              {item.live?'Published':'Not published'}{item.draft?' · Draft saved':''}
            </span>
          </button>)}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-200 pt-3 text-xs">
          <button disabled={page===0} onClick={()=>setPage((p)=>Math.max(0,p-1))} className={outlineClass}>Previous</button>
          <span>Page {page+1}</span>
          <button disabled={(page+1)*50>=totalCount} onClick={()=>setPage((p)=>p+1)} className={outlineClass}>Next</button>
        </div>
      </div>
      <div className="min-w-0 rounded-lg border border-stone-200 bg-white p-3 min-[360px]:p-5 md:p-7">
        {!id?<div className="space-y-4 py-14 text-center">
          <p className="font-serif text-3xl">Select a product</p>
          <p className="text-sm text-stone-600">Or click “New product” to start a draft.</p>
        </div>:<div className="space-y-6">
          <button type="button" className="flex items-center gap-2 text-xs text-stone-600" onClick={()=>void backToList()} disabled={busy}><ArrowLeft size={14}/> Back to product list</button>
          <h3 className="font-serif text-2xl">{active?.label||'New product draft'}</h3>
          <p className="text-xs text-stone-600">{publishedSlug?'This product is live. Edit any fields below, then select Update published product. Customers see only the new published version.':'Save a private draft, then publish when the product and photos are ready.'}</p>
           <p className="break-all text-xs text-stone-500">Internal record ID: {id}</p>
          {publishedSlug&&id&&<a href={productPath({id,slug:publishedSlug})} target="_blank" rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-2 border border-[#bd9e72] bg-[#f6ecdd] px-4 text-sm font-semibold text-[#5a3e26] hover:bg-[#ead8bf]">
            View live garment page <ArrowRight size={16}/>
          </a>}
          <section className="space-y-4 rounded-lg border border-amber-300 bg-[#fcf6ea] p-5">
            <p className="text-xs font-bold uppercase tracking-[.16em] text-amber-900">Step 1 · Where will this garment appear?</p>
            <div className="nb-responsive-grid grid gap-3 sm:grid-cols-2">
              {(['men','kids'] as const).map(dept=><button type="button" key={dept} aria-pressed={form.department===dept}
                className={(form.department===dept?primaryClass:outlineClass)+' w-full'}
                onClick={()=>{setDirty(true);setSaveState('idle');setForm({...form,department:dept,categoryPaths:[],sku:isNew?'':form.sku,slug:isNew?'':form.slug})}}>
                {dept==='men'?"Men’s Wear":"Kids Wear"}</button>)}
            </div>
            <label className="block text-sm font-semibold">Garment category (required)
              <select className={inputClass+' mt-2'} value={form.categoryPaths[0]||''}
                disabled={skuLoading} onChange={e=>void chooseCategory(e.target.value)}>
                <option value="">Choose Kurta Pyjama, Sherwani, Pathani, Jodhpuri…</option>
                {categories.map(c=><option key={c.path} value={c.path}>{c.title}</option>)}
              </select>
            </label>
            <p className="text-xs leading-6 text-stone-600">Choose the department and garment type first. The database reserves a permanent unique SKU, such as NB-SH-00001, NB-SH-00002 or NB-SU-00001. SKU never changes, even when you edit a published product.</p>
          </section>
          <div className="nb-responsive-grid grid gap-5 md:grid-cols-2">
            <Field label="Garment title"><input className={inputClass} value={form.title} onChange={e=>{
              const title=e.target.value;setDirty(true);setSaveState('idle');setForm(cur=>{
                const oldAuto=[slugify(cur.title),cur.sku.toLowerCase()].filter(Boolean).join('-');
                const shouldUpdate=!cur.slug||cur.slug===oldAuto||cur.slug===slugify(cur.title);
                return {...cur,title,slug:shouldUpdate
                  ?[slugify(title),cur.sku.toLowerCase()].filter(Boolean).join('-'):cur.slug};
              });
            }} maxLength={180}/></Field>
            <div><Field label="Permanent SKU · auto-generated (read-only)">
              <input className={inputClass+' font-mono font-bold'} value={form.sku} readOnly
                aria-label="Permanent auto-generated SKU" placeholder={skuLoading?'Generating…':'Select category above'} />
            </Field>
              <p className="mt-1 text-xs text-stone-500">Use this exact code on garment labels and photo batches.</p>
              {form.sku&&<button type="button" className="mt-2 rounded border border-amber-300 px-3 py-2 text-xs"
                onClick={()=>void navigator.clipboard.writeText(form.sku)}>Copy SKU</button>}
            </div>
            <Field label="Product URL slug (the readable website address)"><input className={inputClass} value={form.slug}
              onChange={e=>update('slug',slugify(e.target.value))} placeholder="ivory-kurta-pyjama-nb-kp-00001"/></Field>
            <Field label="Fabric"><input className={inputClass} value={form.fabric} onChange={e=>update('fabric',e.target.value)}/></Field>
            <Field label="Original price (₹, optional)"><input type="number" step=".01" min="0" className={inputClass} value={form.price} onChange={e=>update('price',e.target.value)}/></Field>
            <Field label="Offer price (₹, optional; must be lower)"><input type="number" step=".01" min="0" className={inputClass} value={form.offerPrice} onChange={e=>update('offerPrice',e.target.value)}/></Field>
            <label className="flex min-h-12 items-center gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 text-sm font-semibold">
              <input type="checkbox" checked={form.customizable} onChange={e=>update('customizable',e.target.checked)}/>
              Can be customized through tailoring / fabric and measurements
            </label>
            <Field label="Sizes (comma-separated)"><input className={inputClass} value={form.sizes.join(', ')} onChange={e=>update('sizes',e.target.value.split(',').map(x=>x.trim()).filter(Boolean))}/></Field>
            <Field label="Display order"><input type="number" className={inputClass} value={form.sortRank} onChange={e=>update('sortRank',Number(e.target.value)||0)}/></Field>
            <div className="md:col-span-2"><Field label="Garment description"><textarea rows={4} className={inputClass} value={form.description} onChange={e=>update('description',e.target.value)}/></Field></div>
          </div>
          <fieldset className="rounded-lg border border-stone-200 p-4">
            <legend className="px-2 text-xs font-semibold">Additional collections (optional)</legend>
            <div className="nb-responsive-grid grid gap-2 sm:grid-cols-2">
              {categories.map((c)=><label key={c.path} className="flex min-h-10 cursor-pointer items-center gap-2 text-xs">
                <input type="checkbox" checked={form.categoryPaths.includes(c.path)}
                  disabled={form.categoryPaths[0]===c.path}
                  onChange={(e)=>update('categoryPaths',e.target.checked?
                    [...form.categoryPaths,c.path]:form.categoryPaths.filter(x=>x!==c.path))}/>
                {c.title} <span className="text-stone-400">{c.path}</span>
              </label>)}
            </div>
          </fieldset>
          <div className="space-y-3">
            <h4 className="font-serif text-2xl">Step 2 · Garment photos and video</h4>
            <p className="text-xs leading-6 text-stone-600">Drag photos here—an authorized owner upload is approved and attached automatically. For bulk imports, use the exact SKU, e.g. {form.sku||'NB-SH-00001'}_01.jpg. The trash icon only detaches a photo; it does not delete the library copy.</p>
            <AssetEditor client={client} userId={userId} canPublish={canPublish} label="Product photos · first is the cover" multiple department={form.department} categoryPath={form.categoryPaths[0]||''}
              selected={form.imageUrls} onChange={urls=>update('imageUrls',urls)}/>
            <AssetEditor client={client} userId={userId} canPublish={canPublish} label="Product video library · up to 200 clips, loaded on demand"
              multiple allowVideo department={form.department} categoryPath={form.categoryPaths[0]||''}
              selected={form.videoUrls} onChange={urls=>update('videoUrls',urls.slice(0,200))}/>
          </div>
          <p className="text-xs leading-6 text-stone-600">Video references are saved in order. Only the selected clip is loaded on the public product page; 100–200 video players are never loaded at once. Keep clips short and optimized. You may also add one external streaming link below.</p>
          <Field label="Optional external HTTPS video / streaming link"><input type="url" className={inputClass} value={form.videoUrl} onChange={e=>update('videoUrl',e.target.value)} placeholder="https://..."/></Field>
          <section aria-labelledby="product-revisions-title" className="space-y-3 rounded-lg border border-[#ded0bc] bg-[#faf7f0] p-5">
            <h4 id="product-revisions-title" className="font-serif text-xl text-[#31261c]">Published history</h4>
            <p className="text-xs leading-6 text-[#76685b]">Each publish creates a numbered, read-only snapshot. Editing a private draft does not change an earlier published version. Reverting requires an authorized reviewed new publication.</p>
            {revisionsLoading ? <p role="status" className="text-xs text-[#76685b]">Loading versions…</p> :
              revisions.length===0 ? <p className="text-xs text-[#76685b]">No published versions yet.</p> :
              <ol className="space-y-2">{revisions.map(revision=><li key={revision.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e8dccb] py-2 text-xs">
                <span className="font-semibold text-[#5a4533]">Version {revision.version}</span>
                <time dateTime={revision.published_at} className="text-[#756958]">
                  {new Date(revision.published_at).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'})}
                </time>
              </li>)}</ol>}
          </section>
          <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-600" role="status" aria-live="polite">
            {saveState==='saving'?'Saving private draft…':saveState==='failed'?'Auto-save failed — use Save private draft to retry.':saveState==='saved'?'Draft saved automatically · '+(lastSavedAt?new Date(lastSavedAt).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}):'just now'):'Draft changes save automatically while you work.'}
          </div>
          <div className="flex flex-wrap gap-3 border-t border-stone-200 pt-6">
            <button type="button" className={outlineClass} disabled={busy} onClick={()=>void save()}><Save size={15}/> Save private draft</button>
            {canPublish&&<button type="button" className={primaryClass} disabled={busy||skuLoading} onClick={()=>void publish()}><Send size={15}/> {publishedSlug?'Update published product':'Publish product'}</button>}
            <button type="button" className={outlineClass} disabled={busy} onClick={()=>void discardDraft()}><Trash2 size={15}/> Discard private draft</button>
            {canPublish&&active?.live&&<button type="button" className={outlineClass+' border-amber-400 text-amber-900'} disabled={busy} onClick={()=>void archiveProduct()}><Archive size={15}/> Archive garment</button>}
          </div>
          {message&&<p role="status" className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
          <ErrorText message={error}/>
        </div>}
      </div>
    </div>
  </section>;
}
