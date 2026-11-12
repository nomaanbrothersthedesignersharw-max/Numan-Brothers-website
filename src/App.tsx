import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, ArrowRight, ArrowUpRight, MapPin, MessageCircle } from 'lucide-react';
import { type PublishedData, HOME_TEMPLATE, loadPublishedData, isSafeHttps } from './lib/cmsData';
import {siteText} from './lib/siteContent';
import { loadCataloguePage, loadProductById, type CataloguePage } from './lib/catalogQueries';
import type { CatalogProduct } from './storefront/catalog';
import { productPath, publicProducts } from './storefront/catalog';
import { SAMPLE_SHERWANI } from './storefront/sampleProduct';
import { getCollection } from './storefront/navigation';
import { useStoreHistory } from './storefront/history';
import V2Header from './components/V2Header';
import FloatingContactDock from './components/FloatingContactDock';
import SocialLinks from './components/SocialLinks';
import V2Reviews from './components/V2Reviews';
import { CollectionPageSkeleton, ProductDetailSkeleton, ProductGridSkeleton } from './components/StorefrontLoading';
import V2Home from './components/V2Home';

import V2Footer from './components/V2Footer';
import V2Link from './components/V2Link';
import V2Reveal from './components/V2Reveal';
// Keep the landing page eager; secondary catalogue and garment editors load on demand.
const V2Collection = React.lazy(() => import('./components/V2Collection'));
const V2ProductGrid = React.lazy(() => import('./components/V2Collection').then(module => ({ default: module.V2ProductGrid })));
const V2Product = React.lazy(() => import('./components/V2Product'));
const CmsStudio = React.lazy(() => import('./components/CmsStudio'));

/** Public catalogue is read-only. All editorial mutations happen in the authenticated studio. */
export default function App() {
  const { path, url, navigate } = useStoreHistory();
  const isStudioPath = path === '/studio' || path.startsWith('/studio/');
  const [siteData, setSiteData] = useState<PublishedData>({
    products: [], homepage: HOME_TEMPLATE, categories: [], error: null,
  });
  const [catalogLoading, setCatalogLoading] = useState(true);
  useEffect(() => {
    if(isStudioPath)return;
    let active = true;
    const reload = async () => {
      const next = await loadPublishedData();
      if (active) { setSiteData(next); setCatalogLoading(false); }
    };
    void reload();
    window.addEventListener('focus', reload);
    return () => { active = false; window.removeEventListener('focus', reload); };
  }, [isStudioPath]);

  const published = useMemo(() => publicProducts(siteData.products), [siteData.products]);
  const rawCollection=getCollection(path);
  // Inactive leaf categories disappear from the public catalogue and menus.
  const collectionDefault=rawCollection && (
    siteData.categories.length===0 || rawCollection.isDepartment || rawCollection.isGroup
    || siteData.categories.some(c=>c.path===rawCollection.path)
  )?rawCollection:null;
  const categoryOverride = siteData.categories.find((c) => c.path === collectionDefault?.path);
  const collection = collectionDefault && categoryOverride
    ? { ...collectionDefault, title: categoryOverride.label,
        description: categoryOverride.description || collectionDefault.description }
    : collectionDefault;
  const selectedId = path.startsWith('/products/') ? path.slice('/products/'.length) : null;
  const searchQuery = path === '/search' ? new URLSearchParams(url.split('?')[1] || '').get('q')?.trim() || '' : '';
  const [page,setPage] = useState(0);
  const [routeResult,setRouteResult] = useState<{key:string;data:CataloguePage}|null>(null);
  const [detail,setDetail] = useState<{id:string;product:CatalogProduct|null}|null>(null);
  const [catalogRequestVersion,setCatalogRequestVersion] = useState(0);
  const retryCatalogue = () => setCatalogRequestVersion(version => version + 1);
  const routeKey = path + '|' + searchQuery + '|' + page;
  useEffect(()=>setPage(0),[path,searchQuery]);
  useEffect(()=>{
    let active=true;
    if(collectionDefault || path==='/search'){
      void loadCataloguePage({route:collectionDefault?.path,query:searchQuery,page})
        .then(data=>{if(active)setRouteResult({key:routeKey,data})});
    } else setRouteResult(null);
    if(selectedId)void loadProductById(selectedId).then(product=>{if(active)setDetail({id:selectedId,product})});
    else setDetail(null);
    return ()=>{active=false};
  },[path,searchQuery,page,catalogRequestVersion]);
  const activeRoutePage = routeResult?.key===routeKey ? routeResult.data : null;
  const matches = activeRoutePage?.products || [];
  const product = selectedId===SAMPLE_SHERWANI.slug ? SAMPLE_SHERWANI : selectedId && detail?.id===selectedId ? detail.product : undefined;
  const policyLabels:Record<string,{key:'privacy'|'terms'|'returns';title:string}>={
    '/privacy-policy':{key:'privacy',title:'Privacy Policy'},
    '/terms-and-conditions':{key:'terms',title:'Terms & Conditions'},
    '/returns-and-exchanges':{key:'returns',title:'Returns & Exchanges'},
  };
  const legalPage=policyLabels[path];
  const title = path === '/' ? 'Traditional Menswear & Kidswear in Warangal' :
    collection ? collection.title : product ? product.title :
    path === '/search' ? 'Search Collections' : path === '/contact' ? 'Visit Our Showroom' : legalPage?.title || 'Page Not Found';

  if (isStudioPath) {
    return <Suspense fallback={<p role="status" className="p-12">Loading private studio…</p>}><CmsStudio/></Suspense>;
  }

  return <div className="min-h-screen bg-[#fbf8f2]">
    <Helmet>
      {selectedId===SAMPLE_SHERWANI.slug&&<meta name="robots" content="noindex, nofollow"/>}
      <title>{title} | {siteText(siteData.homepage,'seo.brand')}</title>
      <meta name="description" content={product?.description?.trim().slice(0,210)||siteText(siteData.homepage,'seo.description')} />
      {product&&<meta property="og:type" content="product"/>}
      {product?.images?.[0]&&<meta property="og:image" content={product.images[0]}/>}
      <meta name="theme-color" content="#fbf8f2"/>
      <meta property="og:title" content={title + ' | '+siteText(siteData.homepage,'seo.brand')} />
    </Helmet>
    <V2Header path={path} home={siteData.homepage} categories={siteData.categories} onNavigate={navigate}/>
    <main id="main-content" className="min-h-[40vh]">
      {!catalogLoading && siteData.error && <div role="status" className="border-b border-amber-200 bg-amber-50 px-6 py-3 text-center text-xs text-amber-900">
        The online catalogue is temporarily unavailable. Contact the showroom for current styles.
      </div>}
      <Suspense fallback={<CollectionPageSkeleton/>}>
      {path === '/' ? <V2Home products={published} home={siteData.homepage} categories={siteData.categories} onNavigate={navigate}/> :
       collection ? (activeRoutePage ? <V2Collection route={collection} products={matches}
         bannerImage={categoryOverride?.image_url && isSafeHttps(categoryOverride.image_url) ? categoryOverride.image_url : undefined}
         home={siteData.homepage} categories={siteData.categories} hasMore={activeRoutePage.hasMore}
         error={activeRoutePage.error} onRetry={retryCatalogue}
         page={page} pageSize={activeRoutePage.pageSize} onPageChange={setPage} onNavigate={navigate}/> :
         <CollectionPageSkeleton/>) :
       selectedId && !detail && selectedId!==SAMPLE_SHERWANI.slug ? <ProductDetailSkeleton/> :
       product ? <V2Product key={product.id} product={product} home={siteData.homepage}
         whatsappNumber={siteData.homepage.contactWhatsapp} contactPhone={siteData.homepage.contactPhone} onNavigate={navigate}/> :
       path === '/search' ? <section className="mx-auto min-h-[70vh] min-w-0 max-w-[1360px] px-4 py-16 min-[360px]:px-5 md:px-12">
         <V2Reveal>
           <p className="mb-5 text-[10px] font-bold uppercase tracking-[.24em] text-[#a37f50]">{siteText(siteData.homepage,'search.eyebrow')}</p>
           <h1 className="break-words font-serif text-[clamp(2.4rem,6vw,5.5rem)] tracking-[-.05em] text-[#29221c]">{siteText(siteData.homepage,'search.title')}</h1>
           <p className="mt-5 mb-12 text-sm text-[#817164]">{searchQuery ? 'Results for "' + searchQuery + '"' : 'Enter a product name or browse a collection.'} · {activeRoutePage ? 'Showing ' + matches.length + ' styles' : 'Loading styles'}</p>
         </V2Reveal>
         {!activeRoutePage ? <ProductGridSkeleton count={8}/> : activeRoutePage.error ?
          <div className="border border-amber-200 bg-amber-50 px-6 py-8 text-center text-sm text-amber-900" role="status">
            We couldn't load these results. <button type="button" onClick={retryCatalogue} className="ml-2 min-h-11 underline underline-offset-4">Try again</button>
          </div> : matches.length ? <V2ProductGrid products={matches} home={siteData.homepage} onNavigate={navigate}/> :
          <div className="border border-[#e4d5c2] bg-[#f5ece0] px-7 py-14 text-center">
            <h2 className="font-serif text-3xl">{siteText(siteData.homepage,'search.emptyTitle')}</h2>
            <p className="mt-4 text-sm leading-7 text-[#766b5e]">{siteText(siteData.homepage,'search.emptyText')}</p>
            <V2Link href="/men" onNavigate={navigate} className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-[#805e38]">{siteText(siteData.homepage,'search.browse')} <ArrowRight size={16}/></V2Link>
          </div>}
         {activeRoutePage && (activeRoutePage.hasMore || page>0) && <nav aria-label="Search results pages" className="mt-10 flex flex-wrap items-center justify-center gap-3">
           <button type="button" className="min-h-11 border border-stone-300 px-5 disabled:opacity-40"
             disabled={page===0} onClick={()=>setPage(current=>Math.max(0,current-1))}>Previous</button>
           <span className="self-center text-sm">Page {page+1}</span>
           <button type="button" className="min-h-11 border border-stone-300 px-5 disabled:opacity-40"
             disabled={!activeRoutePage.hasMore} onClick={()=>setPage(current=>current+1)}>Next</button>
         </nav>}
       </section> :
       legalPage ? <section className="mx-auto min-h-[65vh] max-w-[1050px] px-5 py-16 sm:px-7 md:px-12 md:py-24" aria-labelledby="nb-legal-title">
         <p className="text-[10px] font-bold uppercase tracking-[.25em] text-[#a17a4c]">{siteText(siteData.homepage,'policies.eyebrow')}</p>
         <h1 id="nb-legal-title" className="mt-5 font-serif text-[clamp(2.5rem,6vw,5.5rem)] leading-tight">{legalPage.title}</h1>
         {siteData.homepage.legalPolicies[legalPage.key].trim()
           ? <div className="mt-9 space-y-6 text-sm leading-8 text-[#5b4d3c] sm:text-base">
               {siteData.homepage.legalPolicies[legalPage.key].trim().split(/\n\s*\n/).map((paragraph,i)=>
                 <p key={i} className="whitespace-pre-line break-words">{paragraph}</p>)}
             </div>
           : <div className="mt-10 max-w-2xl border-l-4 border-[#ab895e] bg-[#f1e8db] px-6 py-7">
               <p className="text-sm leading-8">{siteText(siteData.homepage,'policies.pending')}</p>
             </div>}
         <V2Link href="/contact" onNavigate={navigate}
           className="mt-10 inline-flex min-h-12 items-center gap-3 border border-[#b89c77] px-5 text-sm font-semibold text-[#6a4d2e]">
           Contact the showroom <ArrowRight size={16}/>
         </V2Link>
       </section> :
       path === '/contact' ? <section data-nb-contact-hero className="relative min-h-[70vh] overflow-hidden bg-[#2b241e] px-6 py-20 text-[#f8eddd] md:px-12 md:py-32">
         <div className="pointer-events-none absolute -right-24 top-0 h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle,#644f38,transparent_70%)]"/>
         <div className="relative mx-auto max-w-[1050px]">
           <V2Link href="/" onNavigate={navigate} className="mb-12 inline-flex items-center gap-2 text-[11px] uppercase tracking-[.18em] text-[#dcc6a4]"><ArrowLeft size={15}/> {siteText(siteData.homepage,'contact.back')}</V2Link>
           <p className="mb-7 text-[10px] font-bold uppercase tracking-[.27em] text-[#dcba85]">{siteText(siteData.homepage,'contact.eyebrow')}</p>
           <h1 className="max-w-[12ch] break-words font-serif text-[clamp(2.8rem,7vw,7rem)] leading-[1.02] tracking-[-.06em]">{siteText(siteData.homepage,'contact.title')}</h1>
           <p className="mt-8 max-w-xl text-base leading-8 text-[#ded2c3]">{siteText(siteData.homepage,'contact.description')}</p>
           <div className="mt-10 flex min-w-0 flex-wrap gap-3">
             <a href="https://www.google.com/maps/search/?api=1&query=Nomaan+Brothers+Dresses+Mandi+Bazar+Warangal"
               target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center gap-3 bg-[#e2c9a4] px-7 text-xs font-bold uppercase tracking-[.12em] text-[#2b2118]">
               <MapPin size={17}/> {siteText(siteData.homepage,'contact.directions')} <ArrowUpRight size={17}/>
             </a>
             {siteData.homepage.contactWhatsapp && <a
               href={'https://wa.me/'+siteData.homepage.contactWhatsapp+'?text='+encodeURIComponent('Hello Nomaan Brothers, I would like to enquire about your collections.')}
               target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center gap-3 border border-[#e2c9a4] px-7 text-xs font-bold uppercase tracking-[.12em] text-[#f8e9d0]">
               <MessageCircle size={17}/> {siteText(siteData.homepage,'contact.whatsapp')}
             </a>}
           </div>
           {siteData.homepage.contactPhone&&<a href={'tel:+'+siteData.homepage.contactPhone}
             className="mt-6 inline-flex min-h-12 items-center gap-3 border border-[#e2c9a4] px-7 text-xs font-bold uppercase text-[#f8e9d0]">
             {siteText(siteData.homepage,'contact.call')} <ArrowUpRight size={16}/></a>}
           <div className="mt-10 w-full min-w-0 border-t border-[#786047] pt-6">
             <p className="text-xs font-semibold uppercase tracking-[.2em] text-[#e2bf8f]">Connect with us</p>
             <SocialLinks home={siteData.homepage} variant="dark" showUnconfigured/>
           </div>
           <p className="mt-12 max-w-lg text-xs leading-6 text-[#af9e8a]">{siteText(siteData.homepage,'contact.disclaimer')}</p>
         </div>
       </section> :
       <section className="mx-auto min-h-[60vh] max-w-3xl px-6 py-24 text-center">
         <p className="text-[10px] font-bold uppercase tracking-[.24em] text-[#9e7a4f]">404 / Unavailable collection</p>
         <h1 className="mt-7 font-serif text-[clamp(2.4rem,7vw,3.4rem)]">We couldn't find this page.</h1>
         <p className="mt-6 text-sm text-[#74685d]">Use the collection navigation to discover available styles.</p>
         <V2Link href="/" onNavigate={navigate} className="mt-9 inline-flex min-h-12 items-center gap-3 bg-[#32271d] px-7 text-xs font-semibold uppercase tracking-[.12em] text-white">Return home <ArrowRight size={16}/></V2Link>
       </section>}
      </Suspense>
      {path==='/'&&<V2Reviews/>}
    </main>
    <V2Footer home={siteData.homepage} categories={siteData.categories} onNavigate={navigate}/>
    <FloatingContactDock home={siteData.homepage} path={path} product={product}/>
  </div>;
}
