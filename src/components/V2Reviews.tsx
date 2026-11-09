import React,{useEffect,useState} from 'react';
import {ArrowUpRight,Star} from 'lucide-react';
import {getCmsClient} from '../lib/supabaseClient';
type Review={id:string;display_name:string;rating:number;comment:string;created_at:string};
const reviewSource='https://www.justdial.com/Warangal/Nomans-Bros-Opp-Madrasi-Masjid-Mandi-Bazaar/9999PX870-X870-131215171002-P7L6_BZDET';
export default function V2Reviews(){
 const client=getCmsClient();
 const [rows,setRows]=useState<Review[]>([]);
 const [name,setName]=useState(''),[comment,setComment]=useState(''),[rating,setRating]=useState(5);
 const [website,setWebsite]=useState(''),[status,setStatus]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{
   if(!client)return;
   let active=true;
   void client.from('nb_reviews').select('id,display_name,rating,comment,created_at')
     .eq('status','approved').order('approved_at',{ascending:false}).limit(6)
     .then(({data,error})=>{if(active&&!error)setRows((data||[]) as Review[])});
   return()=>{active=false};
 },[client]);
 const submit=async(e:React.FormEvent)=>{
   e.preventDefault();
   if(website){setStatus('Thank you.');return;}
   if(name.trim().length<2||name.trim().length>70||comment.trim().length<20||comment.trim().length>1200){
     setStatus('Enter a display name and a review of at least 20 characters.');return;
   }
   if(!client){setStatus('Online review submissions are currently unavailable.');return;}
   setBusy(true);setStatus('');
   const {error}=await client.from('nb_reviews').insert({
     display_name:name.trim(),rating,comment:comment.trim(),
   });
   setBusy(false);
   if(error)setStatus(error.code==='23505'?'This review has already been submitted.':'Unable to submit. Please try again.');
   else{setName('');setComment('');setRating(5);
     setStatus('Submitted for moderation. Your review is not yet public.');}
 };
 return <section id="customer-reviews" aria-labelledby="nb-reviews-title"
   className="border-t border-[#d6c5ae] bg-[#f0e6d8] px-5 py-20 md:px-12 md:py-28 lg:px-20">
   <div className="mx-auto max-w-[1330px]">
     <p className="text-[10px] font-bold uppercase tracking-[.25em] text-[#95714a]">Community voices</p>
     <h2 id="nb-reviews-title" className="mt-4 font-serif text-[clamp(2.7rem,5.5vw,5.6rem)] leading-tight">What customers are saying.</h2>
     <p className="mt-5 max-w-2xl text-sm leading-7 text-[#6c5b49]">Explore independent feedback or share your experience. Website reviews appear only after moderation; both positive and critical opinions are welcome.</p>
     <a href={reviewSource} target="_blank" rel="noopener noreferrer"
       className="mt-5 inline-flex min-h-12 items-center gap-2 border-b border-[#977147] text-xs font-semibold text-[#65492c]">
       View independent Justdial listing <ArrowUpRight size={17}/>
     </a>
     {rows.length?<div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
       {rows.map(item=><blockquote key={item.id} className="min-w-0 rounded-xl border border-[#e2d2bd] bg-white p-6">
         <div className="flex gap-1" aria-label={item.rating+' out of 5 stars'}>
           {Array.from({length:5},(_,i)=><Star key={i} size={17} aria-hidden="true"
             className={i<item.rating?'fill-[#af8251] text-[#af8251]':'text-stone-300'}/>)}
         </div>
         <p className="mt-5 whitespace-pre-line break-words text-sm leading-7">“{item.comment}”</p>
         <footer className="mt-6 border-t border-stone-200 pt-4 text-xs font-semibold">{item.display_name} · Website submission</footer>
       </blockquote>)}
     </div>:<p className="mt-10 rounded-xl border border-dashed border-[#bca484] bg-[#f8f3eb] p-6 text-sm leading-7">
       No first-party reviews have been published yet. You can read the independent Justdial listing or submit your experience below.
     </p>}
     <div className="mt-12 grid gap-8 border-t border-[#d6c4ad] pt-12 lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)]">
       <div><h3 className="font-serif text-3xl">Share your experience</h3>
         <p className="mt-4 text-sm leading-7 text-[#75634d]">Please write your genuine experience and avoid including private information. Your display name and feedback may be published after approval.</p>
       </div>
       <form onSubmit={e=>void submit(e)} className="grid gap-4 rounded-xl bg-white p-5 sm:grid-cols-2 sm:p-7">
         <label className="text-xs font-semibold">Display name
           <input required maxLength={70} value={name} onChange={e=>setName(e.target.value)}
             className="mt-2 block min-h-12 w-full rounded-md border border-stone-300 px-3 text-base"/>
         </label>
         <label className="text-xs font-semibold">Rating
           <select value={rating} onChange={e=>setRating(Number(e.target.value))}
             className="mt-2 block min-h-12 w-full rounded-md border border-stone-300 bg-white px-3 text-base">
             {[5,4,3,2,1].map(n=><option key={n} value={n}>{n} out of 5</option>)}
           </select>
         </label>
         <label className="text-xs font-semibold sm:col-span-2">Your review
           <textarea required minLength={20} maxLength={1200} rows={5}
             value={comment} onChange={e=>setComment(e.target.value)}
             placeholder="Describe your visit and experience…" className="mt-2 block w-full rounded-md border border-stone-300 p-3 text-base"/>
         </label>
         <label className="absolute -left-[10000px]" aria-hidden="true">Website
           <input tabIndex={-1} autoComplete="off" value={website} onChange={e=>setWebsite(e.target.value)}/>
         </label>
         <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
           <button type="submit" disabled={busy||!client}
             className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[#2c241c] px-6 text-sm font-semibold text-white disabled:opacity-60">
             {busy?'Submitting…':'Submit review'} <ArrowUpRight size={17}/>
           </button>
           <p role="status" aria-live="polite" className="text-xs leading-6 text-[#715b44]">{status}</p>
         </div>
       </form>
     </div>
   </div>
 </section>;
}
