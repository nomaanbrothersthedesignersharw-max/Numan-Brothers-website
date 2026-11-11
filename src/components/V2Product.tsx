import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, MapPin, MessageCircle, Sparkles, Phone, Scissors } from 'lucide-react';
import type { Product } from '../types';
import { productImage, productPath, type CatalogProduct } from '../storefront/catalog';
import {loadRelatedProducts} from '../lib/catalogQueries';
import {callingContact,whatsappContact} from '../lib/contactLinks';
import ShareCatalogue from './ShareCatalogue';
import { getRelatedCollectionLinks } from '../storefront/navigation';
import { productTheme } from '../storefront/productTheme';
import V2Link from './V2Link';
import V2Reveal from './V2Reveal';
import type {CmsHome} from '../lib/cmsData';
import {siteText} from '../lib/siteContent';

interface Props {product:Product;whatsappNumber?:string;contactPhone?:string;home?:CmsHome;onNavigate:(path:string)=>void;}

/**
 * Each approved garment supplies its own blurred photographic environment.
 * The ambient layer is decorative only; important copy is on a solid glass-like
 * panel with a stable contrast level, including on small screens.
 */
export default function V2Product({ product, whatsappNumber, contactPhone, home, onNavigate }: Props) {
  const garment = product as CatalogProduct;
  const theme = productTheme(garment);
  const images = (product.images || []).filter(image => /^https:\/\//i.test(image) || (garment.slug==='sample-plain-sherwani' && /^\/editorial\/(sherwani|kurta|jodhpuri)[.]svg$/.test(image)));
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedVideoIndex,setSelectedVideoIndex]=useState(0);
  const [selectedSize,setSelectedSize]=useState('');
  const [shareStatus,setShareStatus]=useState('');
  const [related,setRelated]=useState<CatalogProduct[]>([]);
  const [relatedLoading,setRelatedLoading]=useState(garment.slug!=='sample-plain-sherwani');
  const [imageReady,setImageReady]=useState(false);
  const [imageFailed,setImageFailed]=useState(false);
  useEffect(()=>{
    let active=true;
    if(garment.slug==='sample-plain-sherwani'){
      setRelated([]);
      setRelatedLoading(false);
      return()=>{active=false};
    }
    setRelatedLoading(true);
    void loadRelatedProducts(garment,4).then(rows=>{
      if(active)setRelated(rows);
    }).finally(()=>{
      if(active)setRelatedLoading(false);
    });
    return()=>{active=false};
  },[garment.id,garment.slug]);
  const visual = images[selectedImage] || productImage(product);
  useEffect(()=>{
    setImageReady(false);
    setImageFailed(false);
  },[visual]);
  const siblings = getRelatedCollectionLinks(theme.collectionPath)
    .filter(link => link.path !== theme.collectionPath).slice(0, 5);
  const productVideos = Array.from(new Set([
    ...(Array.isArray(garment.videoUrls)?garment.videoUrls:[]),
    ...(garment.videoUrl?[garment.videoUrl]:[]),
  ].filter((url):url is string=>typeof url==='string'&&/^https:\/\//i.test(url)))).slice(0,200);
  const videoUrl = productVideos[selectedVideoIndex] || '';
  const playableVideo = typeof videoUrl === 'string' && /^https:\/\//i.test(videoUrl) &&
    (/\.(mp4|webm)(\?|$)/i.test(videoUrl) || videoUrl.includes('/storage/v1/object/public/nb-media-public/'));
  const videoWindowStart=Math.max(0,Math.min(selectedVideoIndex-2,Math.max(0,productVideos.length-5)));
  const visibleVideoIndexes=productVideos.map((_,index)=>index).slice(videoWindowStart,videoWindowStart+5);
  const call=callingContact(contactPhone);
  const original=garment.originalPrice??null;
  const discounted=garment.offerPrice!=null&&original!=null&&garment.offerPrice<original?garment.offerPrice:null;
  const price=(n:number)=>n.toLocaleString('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0});
  const sizeNote=selectedSize?' Requested size: '+selectedSize+'.':'';
  const customizationContact=whatsappContact(whatsappNumber,
    'Hello Nomaan Brothers, I would like to customize '+product.title+' with fabric and measurements.'+sizeNote);
  const contact=whatsappContact(whatsappNumber,
    'Hello Nomaan Brothers, I would like to enquire about '+product.title+
    ' (SKU '+(garment.sku||product.id)+').'+sizeNote);
  const share=async()=>{
    const link=window.location.origin+productPath(garment);
    if(navigator.share){
      try{await navigator.share({title:product.title,url:link});setShareStatus('Shared successfully');return;}
      catch(error){if(error instanceof DOMException&&error.name==='AbortError')return;}
    }
    try{
      if(!navigator.clipboard?.writeText)throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(link);
      setShareStatus('Link copied');
    }catch{
      setShareStatus('Use the browser address bar to copy this product link.');
    }
  };

  return <div className="min-h-[72vh] bg-[#fbf8f2] pb-24 lg:pb-0">
    <section data-nb-contact-hero className="relative isolate overflow-hidden pb-20 pt-7 md:pb-28 md:pt-11" style={{ backgroundColor: theme.backdrop }}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {visual && <img key={visual} src={visual} alt="" loading="eager" decoding="async"
          className="absolute inset-[-12%] h-[124%] w-[124%] object-cover object-center opacity-55 blur-[68px] saturate-[.72] motion-safe:animate-[nb-ambient-arrival_850ms_ease-out_both] md:blur-[95px]"/>}
        <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 15% 8%, ${theme.glow}88 0%, transparent 57%)` }}/>
        <div className="absolute inset-0 bg-gradient-to-br from-[#100e0d]/75 via-[#201b18]/70 to-[#17120f]/90"/>
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#1c1714]/75 to-transparent"/>
        <div className="absolute -right-44 -top-56 h-[520px] w-[520px] rounded-full border border-white/10 md:h-[800px] md:w-[800px]"/>
        <div className="absolute -right-14 -top-24 h-[320px] w-[320px] rounded-full border border-white/10 md:h-[580px] md:w-[580px]"/>
      </div>
      <div className="relative z-10 mx-auto max-w-[1400px] px-5 md:px-12 lg:px-20">
        <nav aria-label="Product breadcrumbs" className="mb-8 flex flex-wrap items-center gap-x-2.5 gap-y-2 text-[11px] tracking-[.06em] text-[#f0dfc8] md:mb-12">
          <V2Link href="/" onNavigate={onNavigate} className="rounded-sm underline-offset-4 hover:underline">Home</V2Link>
          <span aria-hidden="true" className="text-white/40">/</span>
          <V2Link href={theme.departmentPath} onNavigate={onNavigate} className="rounded-sm underline-offset-4 hover:underline">{theme.departmentLabel}</V2Link>
          {theme.collectionPath !== theme.departmentPath && <>
            <span aria-hidden="true" className="text-white/40">/</span>
            <V2Link href={theme.collectionPath} onNavigate={onNavigate} className="rounded-sm underline-offset-4 hover:underline">{theme.collectionLabel}</V2Link>
          </>}
          <span aria-hidden="true" className="text-white/40">/</span>
          <span aria-current="page" className="max-w-[32ch] truncate font-semibold text-white">{product.title}</span>
        </nav>
        <div className="nb-responsive-grid grid items-start gap-9 lg:grid-cols-[minmax(0,1.04fr)_minmax(0,.96fr)] lg:gap-12 xl:gap-20">
          <V2Reveal>
            <div className="relative mx-auto max-w-[700px]">
              <div className="absolute -left-3 -top-3 h-32 w-32 border-l border-t border-white/45 md:-left-5 md:-top-5" aria-hidden="true"/>
              <div className="group relative aspect-[3/4] overflow-hidden border border-white/20 bg-[#dbcbb4]/20 shadow-[0_30px_85px_-26px_rgba(0,0,0,.65)]">
                {visual && !imageFailed ? <>
                  {!imageReady && <div className="nb-skeleton nb-skeleton--dark absolute inset-0" aria-hidden="true"/>}
                  <img src={visual} alt={product.title} onLoad={()=>setImageReady(true)}
                    onError={()=>{setImageFailed(true);setImageReady(false);}}
                    loading="eager" fetchPriority="high" decoding="async"
                    className={'h-full w-full object-cover object-top motion-safe:transition-transform motion-safe:duration-700 motion-safe:group-hover:scale-[1.025] transition-opacity duration-300 ' + (imageReady?'opacity-100':'opacity-0')}/>
                </> : <div className="flex h-full items-center justify-center bg-gradient-to-br from-[#765d4c] via-[#3c302a] to-[#21191a]">
                  <span className="font-serif text-5xl italic text-[#ead5b3]/65 md:text-7xl">Nomaan</span>
                </div>}
                <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/40 to-transparent px-5 py-5 text-[10px] font-semibold uppercase tracking-[.2em] text-white">
                  <span>{siteText(home,'product.brand')}</span>
                  {images.length > 0 && <span>{String(selectedImage + 1).padStart(2,'0')} / {String(images.length).padStart(2,'0')}</span>}
                </div>
                {images.length > 1 && <div className="absolute inset-x-4 bottom-4 flex justify-between gap-3">
                  <button type="button" onClick={() => setSelectedImage(current => (current + images.length - 1) % images.length)}
                    aria-label="Previous garment photograph" className="flex h-11 w-11 items-center justify-center rounded-full border border-white/40 bg-[#241b16]/65 text-white backdrop-blur-md transition-colors hover:bg-[#241b16]/90">
                    <ChevronLeft size={21}/>
                  </button>
                  <button type="button" onClick={() => setSelectedImage(current => (current + 1) % images.length)}
                    aria-label="Next garment photograph" className="flex h-11 w-11 items-center justify-center rounded-full border border-white/40 bg-[#241b16]/65 text-white backdrop-blur-md transition-colors hover:bg-[#241b16]/90">
                    <ChevronRight size={21}/>
                  </button>
                </div>}
              </div>
              {images.length > 1 && <div className="mt-4 flex gap-3 overflow-x-auto pb-3" role="group" aria-label="Choose product image">
                {images.map((image, index) => <button key={image + index} type="button"
                  aria-label={`View photograph ${index + 1} of ${images.length}`} aria-pressed={selectedImage === index}
                  onClick={() => setSelectedImage(index)}
                  className={'relative h-20 w-[68px] shrink-0 overflow-hidden border-2 bg-[#a68e75]/30 transition-colors md:h-24 md:w-20 ' +
                    (selectedImage === index ? 'border-[#efc995]' : 'border-white/25 hover:border-white/65')}>
                  <img src={image} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover object-top"/>
                  {selectedImage === index && <span className="absolute inset-x-1 bottom-1 h-[2px] bg-[#efc995]" aria-hidden="true"/>}
                </button>)}
              </div>}
              {productVideos.length>0 && <div className="mt-5 overflow-hidden border border-white/15 bg-[#1c1714]">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-3 text-[10px] font-semibold uppercase tracking-[.16em] text-[#e5c89e]">
                  <span className="inline-flex items-center gap-2"><Sparkles size={14}/> {siteText(home,'product.videoTitle')}</span>
                  <span>Clip {selectedVideoIndex+1} / {productVideos.length}</span>
                </div>
                {productVideos.length>1&&<div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-3" role="group" aria-label="Choose product video">
                  <button type="button" aria-label="Previous product video" disabled={selectedVideoIndex===0}
                    onClick={()=>setSelectedVideoIndex(i=>Math.max(0,i-1))}
                    className="flex h-10 w-10 items-center justify-center border border-white/25 text-white disabled:opacity-30"><ChevronLeft size={17}/></button>
                  {visibleVideoIndexes.map(index=><button key={index} type="button"
                    aria-label={'Play product video '+(index+1)} aria-pressed={selectedVideoIndex===index}
                    onClick={()=>setSelectedVideoIndex(index)}
                    className={'min-h-10 min-w-10 border px-3 text-xs font-semibold '+(selectedVideoIndex===index?'border-[#efc995] bg-[#efc995] text-[#241b16]':'border-white/25 text-white')}>
                    {index+1}
                  </button>)}
                  <button type="button" aria-label="Next product video" disabled={selectedVideoIndex===productVideos.length-1}
                    onClick={()=>setSelectedVideoIndex(i=>Math.min(productVideos.length-1,i+1))}
                    className="flex h-10 w-10 items-center justify-center border border-white/25 text-white disabled:opacity-30"><ChevronRight size={17}/></button>
                </div>}
                {playableVideo ? <video key={videoUrl} src={videoUrl} controls preload="none" playsInline poster={images[0]}
                  className="aspect-video w-full" aria-label={'Product video '+(selectedVideoIndex+1)+' of '+product.title}/> :
                  <a href={videoUrl} target="_blank" rel="noopener noreferrer"
                    className="flex min-h-20 items-center justify-center gap-3 text-sm font-medium text-white">{siteText(home,'product.videoCta')} <ArrowUpRight size={17}/></a>}
              </div>}
            </div>
          </V2Reveal>
          <V2Reveal delay={0.12} className="lg:sticky lg:top-32 lg:self-start">
            <div className="min-w-0 border border-[#fff9ed]/60 bg-[#fcf8f0]/95 px-4 py-7 shadow-[0_28px_90px_-30px_rgba(0,0,0,.5)] backdrop-blur-xl min-[360px]:px-6 min-[360px]:py-9 sm:px-9 sm:py-12 xl:px-12">
              <p className="mb-6 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[.22em] text-[#85623d]">
                <span className="h-px w-8" style={{ backgroundColor: theme.accent }}/>{theme.name}
              </p>
              <h1 className="font-serif break-words text-[clamp(2.3rem,4.5vw,5.3rem)] leading-[1.04] tracking-[-.055em] text-[#251d18]">{product.title}</h1>
              <p className="mt-4 text-[11px] font-medium uppercase tracking-[.15em] text-[#8b745b]">{theme.collectionLabel} / Nomaan Brothers</p>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                {garment.sku&&<p className="break-all text-xs font-semibold tracking-[.09em] text-[#8a745b]">Style code · {garment.sku}</p>}
                <button type="button" onClick={()=>void share()}
                  className="inline-flex min-h-11 items-center gap-2 border-b border-[#957c5b] text-xs font-semibold text-[#6b5133] hover:text-[#29221b]">
                  Share this design <ArrowUpRight size={15}/>
                </button>
              </div>
              <p role="status" aria-live="polite" className="text-xs text-[#78624b]">{shareStatus}</p>
              <div className="mt-3">
                <ShareCatalogue title={product.title} path={productPath(garment)} photos={images} compact/>
                <p className="mt-2 text-xs leading-5 text-[#816c52]">The WhatsApp link includes the garment gallery and up to four approved photo links. Photos are not automatically attached as files.</p>
              </div>
              <div className="mt-7 h-px w-full bg-[#dfd3c3]"/>
              <p className="mt-7 text-sm leading-8 text-[#5c5147]">
                {product.description?.trim() || 'Discover the details of this occasionwear design, thoughtfully selected for the collection.'}
              </p>
              {original!=null&&original>0&&<div className="mt-5 flex flex-wrap items-baseline gap-3">
                <span className="font-serif text-3xl font-semibold text-[#302319]">{price(discounted??original)}</span>
                {discounted!=null&&<><span className="text-base text-[#9b8b79] line-through">{price(original)}</span>
                  <span className="bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-800">{Math.round((1-discounted/original)*100)}% off</span></>}
              </div>}
              <p className="mt-3 text-xs leading-6 text-[#7c7064]">{siteText(home,'product.pricing')}</p>
              {Array.isArray(product.sizes)&&product.sizes.length>0&&<fieldset className="mt-7">
                <legend className="text-xs font-bold uppercase tracking-[.12em] text-[#624a31]">Choose your size for an enquiry</legend>
                <div className="mt-3 flex flex-wrap gap-2">
                  {product.sizes.map(size=><button key={size} type="button" aria-pressed={selectedSize===size}
                    onClick={()=>setSelectedSize(current=>current===size?'':size)}
                    className={'inline-flex min-h-11 min-w-11 items-center justify-center border px-4 text-sm font-semibold transition-colors '+
                      (selectedSize===size?'border-[#30251b] bg-[#30251b] text-white':'border-[#c7b69e] bg-white text-[#594735] hover:border-[#725839]')}>
                    {size}
                  </button>)}
                </div>
                <p className="mt-2 text-xs leading-6 text-[#81705e]">Size selection is included in your message, not a stock reservation. Confirm availability with the showroom.</p>
              </fieldset>}
              {garment.customizable&&<section className="mt-6 border border-[#d8c5a6] bg-[#f4eada] p-5">
                <p className="flex items-center gap-2 font-serif text-xl"><Scissors size={20}/>{siteText(home,'product.customTitle')}</p>
                <p className="mt-3 text-xs leading-6 text-[#6c5640]">{siteText(home,'product.customText')}</p>
                {customizationContact?<a href={customizationContact} target="_blank" rel="noopener noreferrer"
                  className="mt-4 inline-flex min-h-11 items-center gap-2 border-b border-[#785d39] text-xs font-semibold">
                  <MessageCircle size={17}/>{siteText(home,'product.customCta')} <ArrowUpRight size={14}/></a>:
                  <V2Link href="/contact" onNavigate={onNavigate} className="mt-4 inline-flex items-center gap-2 text-xs font-semibold underline">
                  {siteText(home,'product.customCta')} <ArrowUpRight size={14}/></V2Link>}
              </section>}
              <dl className="mt-8 space-y-4 border-y border-[#dfd3c3] py-6 text-sm">
                {product.fabric && <div className="flex flex-wrap justify-between gap-4"><dt className="text-[#857565]">Fabric</dt><dd className="max-w-[65%] text-right font-medium text-[#362b21]">{product.fabric}</dd></div>}
                {Array.isArray(product.sizes) && product.sizes.length > 0 && <div className="flex flex-wrap justify-between gap-4"><dt className="text-[#857565]">Sizing</dt><dd className="max-w-[65%] text-right font-medium text-[#362b21]">Confirm fit in store</dd></div>}
                <div className="flex flex-wrap justify-between gap-4"><dt className="text-[#857565]">Style reference</dt><dd className="max-w-[65%] break-all text-right font-medium text-[#362b21]">{garment.sku||product.id}</dd></div>
              </dl>
              <div className="mt-8 space-y-3">
                {call&&<a href={call} className="flex min-h-12 items-center gap-3 border border-[#baa381] px-6 text-xs font-bold uppercase">
                  <Phone size={18}/>{siteText(home,'product.callCta')}</a>}
                {contact && <a href={contact} target="_blank" rel="noopener noreferrer"
                  className="flex min-h-14 items-center justify-between gap-4 bg-[#30251b] px-6 text-xs font-semibold uppercase tracking-[.12em] text-[#fbf3e8] transition-colors hover:bg-[#765332]">
                  <span className="inline-flex items-center gap-3"><MessageCircle size={18}/> {siteText(home,'product.enquiry')}</span><ArrowUpRight size={18}/>
                </a>}
                <V2Link href="/contact" onNavigate={onNavigate}
                  className="flex min-h-14 items-center justify-between gap-4 border border-[#b7a080] px-6 text-xs font-semibold uppercase tracking-[.12em] text-[#5b4934] transition-colors hover:bg-[#f1e5d4]">
                  <span className="inline-flex items-center gap-3"><MapPin size={17}/> {siteText(home,'product.visit')}</span><ArrowUpRight size={18}/>
                </V2Link>
              </div>
              <p className="mt-6 text-xs leading-6 text-[#918273]">{siteText(home,'product.disclaimer')}</p>
            </div>
          </V2Reveal>
        </div>
      </div>
    </section>
    <section className="mx-auto max-w-[1400px] px-5 py-16 md:px-12 md:py-24 lg:px-20" aria-labelledby="next-collection-title">
      <div className="flex flex-wrap items-end justify-between gap-5 border-b border-[#ded1be] pb-7">
        <div>
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[.22em] text-[#977249]">{siteText(home,'product.nextEyebrow')}</p>
          <h2 id="next-collection-title" className="font-serif text-[clamp(2rem,4vw,3.8rem)] tracking-[-.05em] text-[#30251d]">{siteText(home,'product.nextTitle')}</h2>
        </div>
        <V2Link href={theme.collectionPath} onNavigate={onNavigate}
          className="inline-flex min-h-11 items-center gap-2 border-b border-[#a88a63] text-[11px] font-semibold uppercase tracking-[.12em] text-[#745536]">
          <ArrowLeft size={15}/> Back to {theme.collectionLabel}
        </V2Link>
      </div>
      <div className="mt-7 flex flex-wrap gap-3">
        <V2Link href={theme.departmentPath} onNavigate={onNavigate}
          className="inline-flex min-h-12 items-center gap-3 border border-[#ccb898] bg-[#f1e7d7] px-5 text-sm font-medium text-[#46372a] transition-colors hover:bg-[#e9dbc7]">
          All {theme.departmentLabel} <ArrowRight size={16}/>
        </V2Link>
        {siblings.map(link => <V2Link key={link.path} href={link.path} onNavigate={onNavigate}
          className="inline-flex min-h-12 items-center gap-3 border border-[#ded0bc] px-5 text-sm font-medium text-[#5b4d3e] transition-colors hover:border-[#a88759] hover:bg-[#f0e6d8]">
          {link.label} <ArrowUpRight size={16}/>
        </V2Link>)}
      </div>
    </section>
    {relatedLoading ? <section className="mx-auto max-w-[1400px] px-5 pb-20 md:px-12 lg:px-20" role="status" aria-busy="true" aria-label="Loading related garments">
      <span className="sr-only">Finding related garments…</span>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-5 border-b border-[#d7c8b4] pb-6">
        <div className="w-full max-w-sm">
          <div className="nb-skeleton h-2.5 w-32"/>
          <div className="nb-skeleton mt-4 h-8 w-4/5"/>
        </div>
        <div className="nb-skeleton h-3 w-32"/>
      </div>
      <div className="nb-responsive-grid grid grid-cols-2 gap-x-3 gap-y-7 sm:gap-x-5 lg:grid-cols-4">
        {Array.from({length:4},(_,index)=><div key={index}>
          <div className="nb-skeleton aspect-[3/4] w-full"/>
          <div className="nb-skeleton mt-4 h-4 w-4/5"/>
          <div className="nb-skeleton mt-2 h-3 w-2/5"/>
        </div>)}
      </div>
    </section> : related.length>0&&<section className=""mx-auto max-w-[1400px] px-5 pb-20 md:px-12 lg:px-20" aria-labelledby="related-garments-title">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-3 border-b border-[#d7c8b4] pb-6">
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[.2em] text-[#9e7850]">Selected for your occasion</p>
          <h2 id="related-garments-title" className="font-serif text-[clamp(2rem,4vw,3rem)] leading-tight text-[#2e251e]">You may also like</h2>
        </div>
        <V2Link href={theme.collectionPath} onNavigate={onNavigate} className="inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-[#75512c] underline underline-offset-4">
          Browse the collection <ArrowRight size={16}/>
        </V2Link>
      </div>
      <div className="nb-responsive-grid grid grid-cols-2 gap-x-3 gap-y-7 sm:gap-x-5 lg:grid-cols-4">
        {related.map(item=><V2Link key={item.id} href={productPath(item)} onNavigate={onNavigate} className="group min-w-0">
          <div className="aspect-[3/4] overflow-hidden bg-[#e7dccb]">
            {productImage(item)?<img src={productImage(item)} alt={item.title} loading="lazy" decoding="async"
              className="h-full w-full object-cover object-top transition-transform duration-500 motion-safe:group-hover:scale-[1.04]"/>:
              <div className="flex h-full items-center justify-center font-serif text-xl text-[#6a5844]">Nomaan</div>}
          </div>
          <p className="mt-3 line-clamp-2 font-serif text-base leading-snug text-[#322a21] sm:text-xl">{item.title}</p>
          {item.originalPrice&&item.originalPrice>0&&<p className="mt-1 text-sm font-semibold text-[#775533]">{price(item.offerPrice??item.originalPrice)}</p>}
          <span className="mt-2 inline-flex min-h-8 items-center gap-1 text-xs font-semibold text-[#705131]">Explore design <ArrowUpRight size={13}/></span>
        </V2Link>)}
      </div>
    </section>}
  </div>;
}
