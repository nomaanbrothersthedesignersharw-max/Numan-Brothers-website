import React,{useEffect,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {Check,Trash2,X,ZoomIn} from 'lucide-react';
import {outlineClass,inputClass,ErrorText} from './StudioShared';

type Review={
  id:string;display_name:string;rating:number;comment:string;source:string;
  status:'pending'|'approved'|'rejected';created_at:string;product_id?:string|null;photo_urls?:string[];
};
type ProductOption={id:string;sku:string;title:string};

export default function CmsReviews({client,canPublish}:{client:SupabaseClient;canPublish:boolean}){
 const [rows,setRows]=useState<Review[]>([]);
 const [products,setProducts]=useState<ProductOption[]>([]);
 const [busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null);
 const [message,setMessage]=useState('');
 const [lightboxPhoto,setLightboxPhoto]=useState<string|null>(null);

 const load=async()=>{
   const prodRes=await client.from('nb_products').select('id,sku,title').order('updated_at',{ascending:false}).limit(200);
   if(!prodRes.error&&Array.isArray(prodRes.data))setProducts(prodRes.data as ProductOption[]);

   let {data,error}=await client.from('nb_reviews')
     .select('id,display_name,rating,comment,source,status,created_at,product_id,photo_urls')
     .order('created_at',{ascending:false}).limit(100);
   if(error){
     const fallback=await client.from('nb_reviews')
       .select('id,display_name,rating,comment,source,status,created_at,product_id')
       .order('created_at',{ascending:false}).limit(100);
     data=fallback.data as typeof data;
     error=fallback.error;
   }
   if(error){
     const legacy=await client.from('nb_reviews')
       .select('id,display_name,rating,comment,source,status,created_at')
       .order('created_at',{ascending:false}).limit(100);
     data=legacy.data as typeof data;
     error=legacy.error;
   }
   if(error)setError(error.message);else{setRows((data||[]) as Review[]);setError(null);}
 };
 useEffect(()=>{void load();},[client]);

 const moderate=async(id:string,status:'approved'|'rejected')=>{
   if(!canPublish)return;
   setBusy(true);setMessage('');
   const {error}=await client.from('nb_reviews').update({status}).eq('id',id);
   if(error)setError(error.message);else{setMessage('Review updated: '+status);await load();}
   setBusy(false);
 };

 const assignProduct=async(id:string,productId:string)=>{
   if(!canPublish)return;
   setBusy(true);setMessage('');
   const {error}=await client.from('nb_reviews').update({product_id:productId||null}).eq('id',id);
   if(error)setError(error.message);else{setMessage('Review linked to selected garment.');await load();}
   setBusy(false);
 };

 const deleteReview=async(id:string)=>{
   if(!canPublish||!window.confirm('Permanently delete this review from Supabase?'))return;
   setBusy(true);setMessage('');
   const {error}=await client.from('nb_reviews').delete().eq('id',id);
   if(error)setError(error.message);else{setMessage('Review deleted.');await load();}
   setBusy(false);
 };

 const ordered=[...rows].sort((a,b)=>(a.status==='pending'?0:1)-(b.status==='pending'?0:1));
 const productMap=new Map(products.map(p=>[p.id,`${p.sku} · ${p.title}`]));

 return <section className="space-y-6">
   <h2 className="font-serif text-3xl">Customer reviews</h2>
   <p className="max-w-3xl text-sm leading-7 text-stone-600">
     Manage customer star reviews and uploaded garment photos. You can approve, reject, link a review to a specific garment, or permanently remove spam entries.
   </p>
   <p className="text-sm font-semibold">{rows.filter(x=>x.status==='pending').length} pending · {rows.filter(x=>x.status==='approved').length} approved (latest 100)</p>
   <ErrorText message={error}/>
   {message&&<p role="status" className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
   {ordered.length===0?<p className="rounded-lg border border-dashed border-stone-300 p-7 text-sm text-stone-500">No reviews submitted yet.</p>:
     <div className="grid gap-4 xl:grid-cols-2">
       {ordered.map(item=><article key={item.id} className="min-w-0 space-y-3 rounded-xl border bg-white p-5">
         <div className="flex flex-wrap items-center justify-between gap-2">
           <p className="font-semibold">{item.display_name} · {item.rating}/5 ★</p>
           <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold">{item.status}</span>
         </div>
         <p className="whitespace-pre-line break-words text-sm leading-7">{item.comment}</p>
         {item.photo_urls && item.photo_urls.length > 0 && (
           <div className="flex flex-wrap gap-2 pt-1">
             {item.photo_urls.map((photo, i) => (
               <button
                 key={i}
                 type="button"
                 onClick={()=>setLightboxPhoto(photo)}
                 className="group relative h-16 w-16 overflow-hidden rounded-md border border-stone-200 bg-stone-100 hover:border-amber-600"
                 title="Enlarge customer photo"
               >
                 <img src={photo} alt="Customer attachment" className="h-full w-full object-cover"/>
                 <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/25">
                   <ZoomIn size={14} className="text-white opacity-0 transition group-hover:opacity-100"/>
                 </span>
               </button>
             ))}
           </div>
         )}
         <p className="text-xs text-stone-500">
           {new Date(item.created_at).toLocaleDateString('en-IN')} · {item.source} ·{' '}
           {item.product_id ? (productMap.get(item.product_id) || 'Product review') : 'Storefront review (unassigned)'}
         </p>
         {canPublish&&products.length>0&&(
           <label className="block text-xs font-semibold text-stone-700">
             Linked garment
             <select
               value={item.product_id||''}
               disabled={busy}
               onChange={e=>void assignProduct(item.id,e.target.value)}
               className={inputClass+' mt-1'}
             >
               <option value="">Storefront-wide (no specific garment)</option>
               {products.map(p=><option key={p.id} value={p.id}>{p.sku} · {p.title}</option>)}
             </select>
           </label>
         )}
         {canPublish&&<div className="flex flex-wrap gap-2 border-t pt-3">
           {item.status!=='approved'&&<button type="button" disabled={busy} className={outlineClass}
             onClick={()=>void moderate(item.id,'approved')}><Check size={16}/> Approve</button>}
           {item.status!=='rejected'&&<button type="button" disabled={busy} className={outlineClass}
             onClick={()=>void moderate(item.id,'rejected')}><X size={16}/> {item.status==='approved'?'Withdraw':'Reject'}</button>}
           <button type="button" disabled={busy} className={outlineClass+' border-red-300 text-red-800 hover:bg-red-50'}
             onClick={()=>void deleteReview(item.id)}><Trash2 size={15}/> Delete</button>
         </div>}
       </article>)}
     </div>}
   {lightboxPhoto&&(
     <div
       role="dialog"
       aria-modal="true"
       aria-label="Customer review photo"
       className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md"
       onClick={()=>setLightboxPhoto(null)}
     >
       <button
         type="button"
         onClick={()=>setLightboxPhoto(null)}
         className="absolute right-4 top-4 z-10 flex h-12 w-12 items-center justify-center rounded-full border border-white/30 bg-black/60 text-white hover:bg-white hover:text-black"
         aria-label="Close customer photo"
       >
         <X size={22}/>
       </button>
       <div className="relative max-h-[90vh] max-w-[90vw] overflow-hidden rounded-xl bg-black" onClick={e=>e.stopPropagation()}>
         <img src={lightboxPhoto} alt="Customer review attachment" className="max-h-[85vh] w-auto max-w-full object-contain"/>
       </div>
     </div>
   )}
 </section>;
}
