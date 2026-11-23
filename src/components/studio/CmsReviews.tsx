import React,{useEffect,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {Check,X} from 'lucide-react';
import {outlineClass,ErrorText} from './StudioShared';
type Review={id:string;display_name:string;rating:number;comment:string;source:string;
 status:'pending'|'approved'|'rejected';created_at:string;product_id?:string|null;photo_urls?:string[]};
export default function CmsReviews({client,canPublish}:{client:SupabaseClient;canPublish:boolean}){
 const [rows,setRows]=useState<Review[]>([]);
 const [busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null);
 const [message,setMessage]=useState('');
 const load=async()=>{
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
 const ordered=[...rows].sort((a,b)=>(a.status==='pending'?0:1)-(b.status==='pending'?0:1));
 return <section className="space-y-6">
   <h2 className="font-serif text-3xl">Customer reviews</h2>
   <p className="max-w-3xl text-sm leading-7 text-stone-600">
     Visitors can submit reviews online, but nothing appears publicly until an owner or admin approves it.
     Withdraw or reject unsuitable submissions without changing customers' words.
   </p>
   <p className="text-sm font-semibold">{rows.filter(x=>x.status==='pending').length} pending · {rows.filter(x=>x.status==='approved').length} approved (latest 100)</p>
   <ErrorText message={error}/>
   {message&&<p role="status" className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
   {ordered.length===0?<p className="rounded-lg border border-dashed border-stone-300 p-7 text-sm text-stone-500">No reviews submitted yet.</p>:
     <div className="grid gap-4 xl:grid-cols-2">
       {ordered.map(item=><article key={item.id} className="min-w-0 space-y-3 rounded-xl border bg-white p-5">
         <div className="flex flex-wrap items-center justify-between gap-2">
           <p className="font-semibold">{item.display_name} · {item.rating}/5</p>
           <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold">{item.status}</span>
         </div>
         <p className="whitespace-pre-line break-words text-sm leading-7">{item.comment}</p>
         {item.photo_urls && item.photo_urls.length > 0 && (
           <div className="flex flex-wrap gap-2 pt-1">
             {item.photo_urls.map((photo, i) => (
               <a key={i} href={photo} target="_blank" rel="noopener noreferrer" className="relative h-14 w-14 overflow-hidden rounded-md border border-stone-200 hover:opacity-90">
                 <img src={photo} alt="Customer attachment" className="h-full w-full object-cover" />
               </a>
             ))}
           </div>
         )}
         <p className="text-xs text-stone-500">{new Date(item.created_at).toLocaleDateString('en-IN')} · {item.source} · {item.product_id ? 'Product review' : 'Storefront review'}</p>
         {canPublish&&<div className="flex flex-wrap gap-2 border-t pt-3">
           {item.status!=='approved'&&<button type="button" disabled={busy} className={outlineClass}
             onClick={()=>void moderate(item.id,'approved')}><Check size={16}/> Approve</button>}
           {item.status!=='rejected'&&<button type="button" disabled={busy} className={outlineClass}
             onClick={()=>void moderate(item.id,'rejected')}><X size={16}/> {item.status==='approved'?'Withdraw':'Reject'}</button>}
         </div>}
       </article>)}
     </div>}
 </section>;
}
