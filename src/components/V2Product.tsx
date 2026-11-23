import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, Bookmark, Camera, ChevronLeft, ChevronRight, MessageCircle, Play, ShoppingBag, Sparkles, Star, Scissors, X, ZoomIn } from 'lucide-react';
import type { Product } from '../types';
import { productImage, productPath, type CatalogProduct } from '../storefront/catalog';
import { toggleShortlistItem, useShortlist } from '../storefront/shortlist';
import {loadRelatedProducts} from '../lib/catalogQueries';
import { getCmsClient } from '../lib/supabaseClient';
import { callingContact, whatsappContact } from '../lib/contactLinks';
import { getRelatedCollectionLinks } from '../storefront/navigation';
import { productTheme } from '../storefront/productTheme';
import V2Link from './V2Link';
import V2Reveal from './V2Reveal';
import { optimizedImageUrl, type CmsHome } from '../lib/cmsData';
import {siteText} from '../lib/siteContent';
import { compressReviewPhoto } from '../lib/imageCompress';

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
  const [selectedVideo, setSelectedVideo] = useState(0);
  const [selectedSize,setSelectedSize]=useState('');
  const [shareStatus,setShareStatus]=useState('');
  const [related,setRelated]=useState<CatalogProduct[]>([]);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [reviews, setReviews] = useState<{ id: string; display_name: string; rating: number; comment: string; created_at: string; photo_urls?: string[] }[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [revName, setRevName] = useState('');
  const [revRating, setRevRating] = useState(5);
  const [revComment, setRevComment] = useState('');
  const [revWebsite, setRevWebsite] = useState('');
  const [revStatus, setRevStatus] = useState('');
  const [revBusy, setRevBusy] = useState(false);
  const [revPhotos, setRevPhotos] = useState<{ dataUrl: string; sizeBytes: number; name: string }[]>([]);
  const [revPhotoCompressing, setRevPhotoCompressing] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);
  const shortlist = useShortlist();
  const isSaved = shortlist.some((item) => item.id === garment.id);
  useEffect(() => {
    if (!zoomOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoomOpen(false);
      else if (e.key === 'ArrowRight' && images.length > 1) setSelectedImage((c) => (c + 1) % images.length);
      else if (e.key === 'ArrowLeft' && images.length > 1) setSelectedImage((c) => (c + images.length - 1) % images.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoomOpen, images.length]);
  useEffect(()=>{
    let active=true;
    if(garment.slug!=='sample-plain-sherwani'){
      void loadRelatedProducts(garment,4).then(rows=>{if(active)setRelated(rows)});
      const loadRevs=async()=>{
        try{
          const res=await fetch('/api/reviews?productId='+encodeURIComponent(garment.id),{headers:{Accept:'application/json'}});
          if(res.ok&&res.headers.get('content-type')?.includes('application/json')){
            const payload=await res.json() as {reviews?:typeof reviews;averageRating?:number};
            if(active&&Array.isArray(payload.reviews)){
              setReviews(payload.reviews);setAvgRating(payload.averageRating||0);return;
            }
          }
        }catch{/**/}
        const client=getCmsClient();
        if(!client)return;
        const {data,error}=await client.from('nb_reviews').select('id,display_name,rating,comment,created_at')
          .eq('status','approved').eq('product_id',garment.id).order('created_at',{ascending:false}).limit(12);
        if(active&&!error&&Array.isArray(data)){
          const list=data as typeof reviews;
          setReviews(list);
          setAvgRating(list.length?Number((list.reduce((s,r)=>s+r.rating,0)/list.length).toFixed(1)):0);
        }
      };
      void loadRevs();
    }
    return()=>{active=false};
  },[garment.id]);
  useEffect(() => {
    if (typeof window === 'undefined' || images.length < 2) return;
    const nextIdx = (selectedImage + 1) % images.length;
    const img = new window.Image();
    img.src = optimizedImageUrl(images[nextIdx], 1200, 85);
  }, [selectedImage, images]);
  const visual = images[selectedImage] || productImage(product);
  const siblings = getRelatedCollectionLinks(theme.collectionPath)
    .filter(link => link.path !== theme.collectionPath).slice(0, 5);
  const videoList = (garment.videoUrls?.length ? garment.videoUrls : (garment.videoUrl ? [garment.videoUrl] : []))
    .filter((u) => typeof u === 'string' && /^https:\/\//i.test(u));
  const gallerySlides: { kind: 'image' | 'video'; url: string }[] = [
    ...images.map((url) => ({ kind: 'image' as const, url })),
    ...videoList.map((url) => ({ kind: 'video' as const, url })),
  ];
  const activeSlide = gallerySlides[selectedImage] || gallerySlides[0];
  const videoUrl = videoList[selectedVideo] || videoList[0];
  const playableVideo = typeof videoUrl === 'string' && /^https:\/\//i.test(videoUrl) &&
    (/\.(mp4|webm)(\?|$)/i.test(videoUrl) || videoUrl.includes('/storage/v1/object/public/nb-media-public/'));
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const remainingSlots = 3 - revPhotos.length;
    if (remainingSlots <= 0) {
      setRevStatus('Maximum 3 photos allowed.');
      return;
    }
    const toProcess = Array.from(files).slice(0, remainingSlots);
    setRevPhotoCompressing(true);
    try {
      const compressedList = await Promise.all(
        toProcess.map((f) => compressReviewPhoto(f, 1200, 90_000))
      );
      setRevPhotos((prev) => [...prev, ...compressedList]);
      setRevStatus('');
    } catch {
      setRevStatus('Could not process some photos. Please try different images.');
    } finally {
      setRevPhotoCompressing(false);
      e.target.value = '';
    }
  };

  const removePhoto = (idx: number) => {
    setRevPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  const submitProductReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (revWebsite) { setRevStatus('Thank you.'); return; }
    if (revName.trim().length < 2 || revName.trim().length > 70 || revComment.trim().length < 20 || revComment.trim().length > 1200) {
      setRevStatus('Enter your name and a review of at least 20 characters.'); return;
    }
    const subName = revName.trim();
    const subComment = revComment.trim();
    const subRating = revRating;
    const subPhotos = revPhotos.map((p) => p.dataUrl);
    setRevBusy(true); setRevStatus('');
    const applyLiveReview = () => {
      const newRev = {
        id: 'rev-' + Date.now(),
        display_name: subName,
        rating: subRating,
        comment: subComment,
        created_at: new Date().toISOString(),
        photo_urls: subPhotos,
      };
      setReviews((prev) => [newRev, ...prev.filter((r) => r.comment !== subComment)]);
      setAvgRating(() => {
        const all = [newRev, ...reviews.filter((r) => r.comment !== subComment)];
        return Number((all.reduce((s, r) => s + r.rating, 0) / all.length).toFixed(1));
      });
      setRevName(''); setRevComment(''); setRevRating(5); setRevPhotos([]);
      setRevStatus('Thank you! Your verified star review has been published.');
    };
    try {
      const res = await fetch('/api/submit-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          display_name: subName,
          rating: subRating,
          comment: subComment,
          product_id: garment.id,
          website: revWebsite,
          photos: subPhotos,
        }),
      });
      if (res.status !== 404) {
        const d = await res.json().catch(() => ({})) as { error?: string; code?: string };
        setRevBusy(false);
        if (!res.ok) {
          setRevStatus(res.status === 409 || d.code === '23505' ? 'This review has already been submitted.' : (d.error || 'Unable to submit.'));
          return;
        }
        applyLiveReview();
        return;
      }
    } catch {/**/}
    const client = getCmsClient();
    if (!client) { setRevBusy(false); setRevStatus('Review submissions are currently unavailable.'); return; }
    const { error } = await client.from('nb_reviews').insert({
      display_name: subName, rating: subRating, comment: subComment, product_id: garment.id,
      photo_urls: subPhotos,
    });
    setRevBusy(false);
    if (error) setRevStatus(error.code === '23505' ? 'This review has already been submitted.' : 'Unable to submit. Please try again.');
    else { applyLiveReview(); }
  };
  const call = callingContact(contactPhone);
  const original=garment.originalPrice??null;
  const discounted=garment.offerPrice!=null&&original!=null&&garment.offerPrice<original?garment.offerPrice:null;
  const price=(n:number)=>n.toLocaleString('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0});
  const sizeNote=selectedSize?' Requested size: '+selectedSize+'.':'';
  const fullProductUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${productPath(garment)}`
    : `https://numanbrothers.com${productPath(garment)}`;

  const customizationContact = whatsappContact(
    whatsappNumber,
    `Hello Nomaan Brothers, I would like to customize ${product.title} (Style Reference: ${garment.sku || product.id}) with bespoke fabric and measurements.\n\nProduct Link: ${fullProductUrl}${sizeNote}`
  );
  const contact = whatsappContact(
    whatsappNumber,
    `Hello Nomaan Brothers, I would like to inquire about ${product.title} (Style Reference: ${garment.sku || product.id}).\n\nProduct Link: ${fullProductUrl}${sizeNote}`
  );
  const orderContact = whatsappContact(
    whatsappNumber,
    `Hello Nomaan Brothers, I would like to order ${product.title} (Style Reference: ${garment.sku || product.id}).\n\nProduct Link: ${fullProductUrl}${sizeNote}`
  );
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
        <div className="absolute inset-0 transform-gpu blur-[68px]" style={{ background: `radial-gradient(ellipse at 18% 12%, ${theme.glow}99 0%, transparent 58%), radial-gradient(ellipse at 85% 75%, ${theme.accent}44 0%, transparent 60%)` }}/>
        <div className="absolute inset-0 bg-gradient-to-br from-[#100e0d]/70 via-[#201b18]/65 to-[#17120f]/90"/>
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
                {activeSlide?.kind === 'video' ? (
                  <video key={activeSlide.url} src={activeSlide.url} controls autoPlay muted loop playsInline preload="auto" poster={images[0] ? optimizedImageUrl(images[0], 1200, 80) : undefined}
                    className="h-full w-full bg-[#16110e] object-cover" aria-label={'Brand film of ' + product.title}/>
                ) : visual ? <img key={visual} src={optimizedImageUrl(visual, 1200, 85)} alt={product.title}
                  loading="eager" fetchPriority="high" decoding="async"
                  onClick={() => setZoomOpen(true)}
                  className="h-full w-full cursor-zoom-in object-cover object-top transition-opacity duration-300 motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover:scale-[1.02]"/> :
                  <div className="flex h-full items-center justify-center bg-gradient-to-br from-[#765d4c] via-[#3c302a] to-[#21191a]">
                    <span className="font-serif text-5xl italic text-[#ead5b3]/65 md:text-7xl">Nomaan</span>
                  </div>}
                <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/40 to-transparent px-5 py-5 text-[10px] font-semibold uppercase tracking-[.2em] text-white">
                  <span>{siteText(home,'product.brand')}</span>
                  <div className="flex items-center gap-3">
                    {gallerySlides.length > 0 && <span>{String(selectedImage + 1).padStart(2,'0')} / {String(gallerySlides.length).padStart(2,'0')}</span>}
                    {activeSlide?.kind !== 'video' && visual && <button type="button" onClick={() => setZoomOpen(true)} aria-label="Zoom garment photograph" className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full border border-white/40 bg-black/40 text-white transition-transform hover:bg-black/70 active:scale-95"><ZoomIn size={15}/></button>}
                  </div>
                </div>
                {gallerySlides.length > 1 && <div className="pointer-events-none absolute inset-x-4 bottom-4 flex justify-between gap-3">
                  <button type="button" onClick={() => setSelectedImage(current => (current + gallerySlides.length - 1) % gallerySlides.length)}
                    aria-label="Previous garment media" className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-white/40 bg-[#241b16]/75 text-white backdrop-blur-sm transition-all hover:bg-[#241b16] active:scale-95">
                    <ChevronLeft size={21}/>
                  </button>
                  <button type="button" onClick={() => setSelectedImage(current => (current + 1) % gallerySlides.length)}
                    aria-label="Next garment media" className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-white/40 bg-[#241b16]/75 text-white backdrop-blur-sm transition-all hover:bg-[#241b16] active:scale-95">
                    <ChevronRight size={21}/>
                  </button>
                </div>}
              </div>
              {gallerySlides.length > 1 && <div className="mt-4 flex gap-3 overflow-x-auto pb-3" role="group" aria-label="Choose product media">
                {gallerySlides.map((slide, index) => <button key={slide.url + index} type="button"
                  aria-label={slide.kind === 'video' ? 'Play garment brand film' : `View photograph ${index + 1} of ${images.length}`} aria-pressed={selectedImage === index}
                  onClick={() => setSelectedImage(index)}
                  className={'relative h-20 w-[68px] shrink-0 overflow-hidden border-2 bg-[#231b15] transition-all active:scale-95 md:h-24 md:w-20 ' +
                    (selectedImage === index ? 'border-[#efc995]' : 'border-white/25 hover:border-white/65')}>
                  {slide.kind === 'video' ? (
                    <div className="relative flex h-full w-full items-center justify-center bg-[#1c1714] text-[#efc995]">
                      {images[0] && <img src={optimizedImageUrl(images[0], 200, 70)} alt="" className="absolute inset-0 h-full w-full object-cover opacity-45" />}
                      <span className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full border border-[#efc995]/70 bg-black/60"><Play size={14} className="fill-current"/></span>
                    </div>
                  ) : (
                    <img src={optimizedImageUrl(slide.url, 200, 75)} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover object-top"/>
                  )}
                  {selectedImage === index && <span className="absolute inset-x-1 bottom-1 h-[2px] bg-[#efc995]" aria-hidden="true"/>}
                </button>)}
              </div>}
              {videoList.length > 0 && <div className="mt-5 overflow-hidden border border-white/15 bg-[#1c1714]">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-5 py-3 text-[10px] font-semibold uppercase tracking-[.16em] text-[#e5c89e]">
                  <span className="inline-flex items-center gap-2"><Sparkles size={14}/> {siteText(home,'product.videoTitle')}</span>
                  {videoList.length > 1 && (
                    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Choose garment video">
                      {videoList.map((_, idx) => (
                        <button key={idx} type="button" onClick={() => setSelectedVideo(idx)} aria-pressed={selectedVideo === idx}
                          className={'rounded-full px-2.5 py-1 text-[10px] font-bold transition-colors ' +
                            (selectedVideo === idx ? 'bg-[#e5c89e] text-[#1c1714]' : 'border border-white/25 text-white/80 hover:bg-white/10')}>
                          Video {String(idx + 1).padStart(2, '0')}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {playableVideo ? <video key={videoUrl} src={videoUrl} controls preload="metadata" playsInline poster={images[0] ? optimizedImageUrl(images[0], 1200, 80) : undefined}
                  className="aspect-video w-full" aria-label={'Video of ' + product.title}/> :
                  <a href={videoUrl} target="_blank" rel="noopener noreferrer"
                    className="flex min-h-20 items-center justify-center gap-3 text-sm font-medium text-white">{siteText(home,'product.videoCta')} <ArrowUpRight size={17}/></a>}
              </div>}
            </div>
          </V2Reveal>
          <V2Reveal delay={0.12} className="lg:sticky lg:top-32 lg:self-start">
            <div className="min-w-0 border border-[#fff9ed]/60 bg-[#fcf8f0]/[0.97] px-4 py-7 shadow-[0_28px_90px_-30px_rgba(0,0,0,.5)] backdrop-blur-md min-[360px]:px-6 min-[360px]:py-9 sm:px-9 sm:py-12 xl:px-12">
              <p className="mb-6 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[.22em] text-[#85623d]">
                <span className="h-px w-8" style={{ backgroundColor: theme.accent }}/>{theme.name}
              </p>
              <h1 className="font-serif break-words text-[clamp(2.3rem,4.5vw,5.3rem)] leading-[1.04] tracking-[-.055em] text-[#251d18]">{product.title}</h1>
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <p className="text-[11px] font-medium uppercase tracking-[.15em] text-[#8b745b]">{theme.collectionLabel} / Nomaan Brothers</p>
                {reviews.length > 0 && (
                  <a href="#product-reviews" className="inline-flex items-center gap-1.5 rounded-full border border-[#dfd0bc] bg-[#f6efe3] px-3 py-1 text-xs font-semibold text-[#5a4227]">
                    <Star size={13} className="fill-[#af8251] text-[#af8251]" /> {avgRating.toFixed(1)} · {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}
                  </a>
                )}
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                {garment.sku&&<p className="break-all text-xs font-semibold tracking-[.09em] text-[#8a745b]">Style code · {garment.sku}</p>}
                <div className="flex flex-wrap items-center gap-4">
                  <button type="button" onClick={() => toggleShortlistItem(garment)} aria-pressed={isSaved}
                    className="inline-flex min-h-11 items-center gap-1.5 border-b border-[#957c5b] text-xs font-semibold text-[#6b5133] hover:text-[#29221b]">
                    <Bookmark size={14} className={isSaved ? 'fill-[#6b5133]' : ''} /> {isSaved ? 'Saved to shortlist' : 'Save to shortlist'}
                  </button>
                  <button type="button" onClick={()=>void share()}
                    className="inline-flex min-h-11 items-center gap-2 border-b border-[#957c5b] text-xs font-semibold text-[#6b5133] hover:text-[#29221b]">
                    Share this design <ArrowUpRight size={15}/>
                  </button>
                </div>
              </div>
              <p role="status" aria-live="polite" className="text-xs text-[#78624b]">{shareStatus}</p>
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
                <div className="flex flex-wrap justify-between gap-4"><dt className="text-[#857565]">Style code</dt><dd className="max-w-[65%] break-all text-right font-medium text-[#362b21]">{garment.sku||product.id}</dd></div>
              </dl>
              <div className="mt-8 space-y-3">
                {contact && (
                  <a href={contact} target="_blank" rel="noopener noreferrer"
                    className="flex min-h-14 items-center justify-between gap-4 bg-[#30251b] px-6 text-xs font-semibold uppercase tracking-[.14em] text-[#fbf3e8] transition-all hover:bg-[#765332] hover:shadow-md">
                    <span className="inline-flex items-center gap-3"><MessageCircle size={18}/> Inquire about this design</span><ArrowUpRight size={18}/>
                  </a>
                )}
                {orderContact && (
                  <a href={orderContact} target="_blank" rel="noopener noreferrer"
                    className="flex min-h-14 items-center justify-between gap-4 border-2 border-[#30251b] bg-white px-6 text-xs font-semibold uppercase tracking-[.14em] text-[#30251b] transition-all hover:bg-[#30251b] hover:text-[#fbf3e8]">
                    <span className="inline-flex items-center gap-3"><ShoppingBag size={18}/> Order this product</span><ArrowUpRight size={18}/>
                  </a>
                )}
                {call && (
                  <p className="pt-2 text-center text-xs text-[#8c7b6c]">
                    Need phone assistance? <a href={call} className="font-semibold underline hover:text-[#30251b]">{contactPhone}</a>
                  </p>
                )}
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
    {related.length>0&&<section className="mx-auto max-w-[1400px] px-5 pb-20 md:px-12 lg:px-20" aria-labelledby="related-garments-title">
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
            {productImage(item)?<img src={optimizedImageUrl(productImage(item), 500, 80)} alt={item.title} loading="lazy" decoding="async"
              className="h-full w-full object-cover object-top transition-transform duration-500 motion-safe:group-hover:scale-[1.04]"/>:
              <div className="flex h-full items-center justify-center font-serif text-xl text-[#6a5844]">Nomaan</div>}
          </div>
          <p className="mt-3 line-clamp-2 font-serif text-base leading-snug text-[#322a21] sm:text-xl">{item.title}</p>
          {item.originalPrice&&item.originalPrice>0&&<p className="mt-1 text-sm font-semibold text-[#775533]">{price(item.offerPrice??item.originalPrice)}</p>}
          <span className="mt-2 inline-flex min-h-8 items-center gap-1 text-xs font-semibold text-[#705131]">Explore design <ArrowUpRight size={13}/></span>
        </V2Link>)}
      </div>
    </section>}
    {garment.slug !== 'sample-plain-sherwani' && (
      <section id="product-reviews" aria-labelledby="product-reviews-title" className="border-t border-[#e2d4c0] bg-[#f4ece0] px-5 py-16 md:px-12 md:py-20 lg:px-20">
        <div className="mx-auto max-w-[1330px]">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#d6c5ae] pb-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.22em] text-[#95714a]">Verified garment feedback</p>
              <h2 id="product-reviews-title" className="mt-2 font-serif text-[clamp(1.9rem,4vw,3rem)] text-[#2a211a]">
                Customer Reviews {reviews.length > 0 ? `(${avgRating.toFixed(1)} ★)` : ''}
              </h2>
            </div>
            {reviews.length > 0 && (
              <div className="flex items-center gap-1.5" aria-label={`Rated ${avgRating} out of 5`}>
                {Array.from({ length: 5 }, (_, i) => (
                  <Star key={i} size={18} className={i < Math.round(avgRating) ? 'fill-[#af8251] text-[#af8251]' : 'text-stone-300'} />
                ))}
                <span className="ml-2 text-xs font-semibold text-[#5a442c]">{reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}</span>
              </div>
            )}
          </div>
          {reviews.length > 0 ? (
            <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {reviews.map((item) => (
                <blockquote key={item.id} className="rounded-xl border border-[#e2d2bd] bg-white p-6">
                  <div className="flex gap-1" aria-label={`${item.rating} out of 5 stars`}>
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star key={i} size={15} className={i < item.rating ? 'fill-[#af8251] text-[#af8251]' : 'text-stone-300'} />
                    ))}
                  </div>
                  <p className="mt-4 whitespace-pre-line break-words text-sm leading-7 text-[#3b3026]">“{item.comment}”</p>
                  {item.photo_urls && item.photo_urls.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {item.photo_urls.map((photo, pIdx) => (
                        <button
                          key={pIdx}
                          type="button"
                          onClick={() => setLightboxPhoto(photo)}
                          className="group relative h-16 w-16 overflow-hidden rounded-lg border border-stone-200 bg-stone-100 transition hover:border-[#b38a4d] sm:h-20 sm:w-20"
                          title="Click to view customer photo"
                        >
                          <img
                            src={photo}
                            alt={`${item.display_name} wearing this design`}
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/25">
                            <ZoomIn size={16} className="text-white opacity-0 transition group-hover:opacity-100" />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  <footer className="mt-5 border-t border-stone-200 pt-3 text-xs font-semibold text-[#6b5640]">{item.display_name}</footer>
                </blockquote>
              ))}
            </div>
          ) : (
            <p className="mt-8 rounded-xl border border-dashed border-[#c2ab8c] bg-[#faf5ed] p-6 text-sm text-[#6b5a47]">
              No reviews published for this garment yet. Share your showroom experience below.
            </p>
          )}
          <form onSubmit={(e) => void submitProductReview(e)} className="mt-10 grid gap-4 rounded-xl border border-[#e2d2bd] bg-white p-5 sm:grid-cols-2 sm:p-7">
            <label className="text-xs font-semibold">Your name
              <input required maxLength={70} value={revName} onChange={(e) => setRevName(e.target.value)}
                className="mt-2 block min-h-11 w-full rounded-md border border-stone-300 px-3 text-base sm:text-sm" />
            </label>
            <label className="text-xs font-semibold">Star rating
              <select value={revRating} onChange={(e) => setRevRating(Number(e.target.value))}
                className="mt-2 block min-h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-base sm:text-sm">
                {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} ★ out of 5</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold sm:col-span-2">Your review
              <textarea required minLength={20} maxLength={1200} rows={3} value={revComment} onChange={(e) => setRevComment(e.target.value)}
                placeholder="Share fabric feel, fit, and tailoring experience…"
                className="mt-2 block w-full rounded-md border border-stone-300 p-3 text-base sm:text-sm" />
            </label>
            <div className="sm:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label htmlFor="review-photo-input" className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-stone-800">
                  <Camera size={15} className="text-[#a17c4f]" />
                  Add customer photos <span className="font-normal text-stone-500">(wearing this garment, up to 3 photos)</span>
                </label>
                <span className="text-[11px] text-stone-500">{revPhotos.length}/3 attached</span>
              </div>
              <input
                id="review-photo-input"
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => void handlePhotoUpload(e)}
                disabled={revBusy || revPhotoCompressing || revPhotos.length >= 3}
                className="mt-2 block w-full text-xs text-stone-500 file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-[#f2e7d7] file:px-4 file:py-2 file:text-xs file:font-semibold file:text-[#4a3a29] hover:file:bg-[#e7d5bd] disabled:opacity-50"
              />
              {revPhotoCompressing && (
                <p className="mt-1 text-xs text-amber-700 animate-pulse">Optimizing photo for fast delivery…</p>
              )}
              {revPhotos.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-3">
                  {revPhotos.map((photo, idx) => (
                    <div key={idx} className="group relative h-20 w-20 overflow-hidden rounded-lg border border-stone-200 bg-stone-100">
                      <img src={photo.dataUrl} alt="Review upload preview" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removePhoto(idx)}
                        className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white hover:bg-black"
                        title="Remove photo"
                      >
                        <X size={12} />
                      </button>
                      <span className="absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-center text-[9px] text-white">
                        {Math.round(photo.sizeBytes / 1024)} KB
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <label className="absolute -left-[10000px]" aria-hidden="true">Website
              <input tabIndex={-1} autoComplete="off" value={revWebsite} onChange={(e) => setRevWebsite(e.target.value)} />
            </label>
            <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
              <button type="submit" disabled={revBusy} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#2c241c] px-6 text-xs font-semibold uppercase tracking-wider text-white disabled:opacity-60">
                {revBusy ? 'Submitting…' : 'Submit star review'}
              </button>
              <p role="status" aria-live="polite" className="text-xs text-[#6f5841]">{revStatus}</p>
            </div>
          </form>
        </div>
      </section>
    )}
    {zoomOpen && visual && (
      <div role="dialog" aria-modal="true" aria-label={product.title + ' enlarged photograph'}
        className="fixed inset-0 z-[95] flex items-center justify-center bg-[#120e0b]/95 p-4 backdrop-blur-md">
        <button type="button" aria-label="Close zoom" onClick={() => setZoomOpen(false)}
          className="absolute right-4 top-4 z-10 flex h-12 w-12 items-center justify-center rounded-full border border-white/30 bg-black/50 text-white hover:bg-white hover:text-[#211b17]">
          <X size={22} />
        </button>
        {images.length > 1 && (
          <>
            <button type="button" aria-label="Previous photograph"
              onClick={() => setSelectedImage((c) => (c + images.length - 1) % images.length)}
              className="absolute left-4 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/50 text-white hover:bg-white hover:text-[#211b17]">
              <ChevronLeft size={22} />
            </button>
            <button type="button" aria-label="Next photograph"
              onClick={() => setSelectedImage((c) => (c + 1) % images.length)}
              className="absolute right-4 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/50 text-white hover:bg-white hover:text-[#211b17]">
              <ChevronRight size={22} />
            </button>
          </>
        )}
        <img src={visual} alt={product.title} className="max-h-[90vh] max-w-[92vw] rounded object-contain shadow-2xl" />
      </div>
    )}
    {lightboxPhoto && (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Customer review photo"
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md"
        onClick={() => setLightboxPhoto(null)}
      >
        <button
          type="button"
          onClick={() => setLightboxPhoto(null)}
          className="absolute right-4 top-4 z-10 flex h-12 w-12 items-center justify-center rounded-full border border-white/30 bg-black/60 text-white hover:bg-white hover:text-black"
          aria-label="Close customer photo"
        >
          <X size={22} />
        </button>
        <div className="relative max-h-[90vh] max-w-[90vw] overflow-hidden rounded-xl bg-black" onClick={(e) => e.stopPropagation()}>
          <img src={lightboxPhoto} alt="Customer review photograph enlarged" className="max-h-[85vh] w-auto max-w-full object-contain" />
        </div>
      </div>
    )}
  </div>;
}
