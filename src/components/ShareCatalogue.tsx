import React,{useState} from 'react';
import {Copy,MessageCircle} from 'lucide-react';
import {absoluteStoreUrl,whatsappShareUrl} from '../lib/catalogShare';

export default function ShareCatalogue({title,path,photos=[],compact=false,dark=false}:{
  title:string;path:string;photos?:string[];compact?:boolean;dark?:boolean;
}){
  const [notice,setNotice]=useState('');
  const origin=typeof window==='undefined'?'https://example.com':window.location.origin;
  let url='';let whatsapp='';
  try{
    url=absoluteStoreUrl(path,origin);
    whatsapp=whatsappShareUrl(title,path,origin,photos);
  }catch{return null;}
  const copy=async()=>{
    try{await navigator.clipboard.writeText(url);setNotice('Catalogue link copied.');}
    catch{setNotice('Copy the catalogue URL from your browser address bar.');}
  };
  return <div className={'flex min-w-0 flex-wrap items-center gap-3 '+(compact?'':'mt-7')} aria-label={'Share '+title}>
    <a href={whatsapp} target="_blank" rel="noopener noreferrer"
      aria-label={'Share '+title+' catalogue on WhatsApp'}
      className={'inline-flex min-h-12 max-w-full items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition-colors '+
        (dark?'border-[#e5c69d]/45 bg-[#e5c69d]/15 text-[#fbf0dd] hover:bg-[#e5c69d]/25':'border-[#b59c77] bg-[#f5e9d6] text-[#3d3022] hover:bg-[#ead9bc]')}>
      <MessageCircle size={17}/> Share on WhatsApp
    </a>
    <button type="button" onClick={()=>void copy()}
      className={'inline-flex min-h-12 items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition-colors '+
        (dark?'border-white/30 text-[#f5e7d0] hover:bg-white/10':'border-[#b69f84] text-[#5d4630] hover:bg-[#eee2d1]')}>
      <Copy size={16}/> Copy link
    </button>
    <span className="sr-only" role="status" aria-live="polite">{notice}</span>
  </div>;
}
