import React, { useEffect, useState } from 'react';
import { ArrowRight, ArrowUpRight, MapPin } from 'lucide-react';
import { CatalogProduct, productImage, productPath, productsForCollection } from '../storefront/catalog';
import { CollectionRoute, getDepartment, getRelatedCollectionLinks } from '../storefront/navigation';
import V2Link from './V2Link';
import V2Reveal from './V2Reveal';
import {SAMPLE_SHERWANI} from '../storefront/sampleProduct';
import ShareCatalogue from './ShareCatalogue';
import type { CmsHome,CmsCategoryRow } from '../lib/cmsData';
import {siteText} from '../lib/siteContent';

interface Props { route: CollectionRoute; products: CatalogProduct[]; bannerImage?:string; hasMore?:boolean; error?:string|null; onRetry?:()=>void;
  page?:number;pageSize?:number;onPageChange?:(page:number)=>void;
  onNavigate: (path: string) => void;home?:CmsHome;categories?:CmsCategoryRow[]; }

function ProductCardImage({ product }: { product: CatalogProduct }) {
  const src = productImage(product);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(!src);
  useEffect(() => {
    setLoaded(false);
    setFailed(!src);
  }, [src]);

  return <div className="relative aspect-[3/4] overflow-hidden bg-[#e9e0d2]">
    {src && !failed ? <img src={src} alt={product.title} loading="lazy" decoding="async"
      onLoad={() => setLoaded(true)} onError={() => { setFailed(true); setLoaded(false); }}
      className={'h-full w-full object-cover object-top transition-[opacity,transform] duration-700 group-hover:scale-[1.06] ' + (loaded ? 'opacity-100' : 'opacity-0')}/> : null}
    {!loaded && !failed && <div className="nb-skeleton absolute inset-0" aria-hidden="true"/>}
    {failed && <div className="absolute inset-0 flex items-center justify-center font-serif text-3xl italic text-[#9a8668]">Nomaan</div>}
    <span className="absolute bottom-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-[#f8f3e9]/95 text-[#352b20] opacity-0 transition-all duration-300 group-hover:opacity-100 group-focus-visible:opacity-100"><ArrowUpRight size={19}/></span>
  </div>;
}

export function V2ProductGrid({ products, onNavigate,home }: { products: CatalogProduct[]; onNavigate: (path: string) => void;home?:CmsHome }) {
  return <div className="nb-responsive-grid grid grid-cols-1 gap-x-4 gap-y-9 min-[360px]:grid-cols-2 md:grid-cols-3 md:gap-x-6 md:gap-y-12 lg:grid-cols-4">
    {products.map((product, index) => (
      <V2Reveal key={product.id} delay={Math.min(index % 4, 3) * 0.04}>
        <V2Link href={productPath(product)} onNavigate={onNavigate} className="group block">
          <ProductCardImage product={product}/>
          <p className="mt-4 text-[9px] font-semibold uppercase tracking-[.18em] text-[#a17e4f]">{siteText(home,'footer.brand')}</p>
          <h3 className="mt-1.5 break-words font-serif text-base leading-snug text-[#2d271f] md:text-xl">{product.title}</h3>
          {product.fabric && <p className="mt-1.5 text-xs leading-5 text-[#807366]">{product.fabric}</p>}
          {!!product.originalPrice&&product.originalPrice>0&&<div className="mt-2 flex flex-wrap items-baseline gap-2">
            <strong className="text-sm text-[#30251d]">{(product.offerPrice??product.originalPrice).toLocaleString('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0})}</strong>
            {product.offerPrice!=null&&product.offerPrice<product.originalPrice&&<span className="text-xs text-stone-500 line-through">
              {product.originalPrice.toLocaleString('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0})}</span>}
          </div>}
          {product.customizable&&<p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-[#80603b]">Tailoring available</p>}
          <span className="mt-2 inline-flex items-center gap-2 text-[11px] font-medium text-[#82623f]">{siteText(home,'collection.cardCta')} <ArrowRight size={13}/></span>
        </V2Link>
      </V2Reveal>
    ))}
  </div>;
}

export default function V2Collection({ route, products, bannerImage, hasMore = false, error = null, onRetry, page = 0, pageSize = 24, onPageChange,home,categories=[],onNavigate }: Props) {
  const department = getDepartment(route.department);
  const links = getRelatedCollectionLinks(route.path)
    .filter(item=>item.path!==route.path && (categories.length===0||categories.some(c=>c.path===item.path)))
    .map(item=>({...item,label:categories.find(c=>c.path===item.path)?.label||item.label}));
  const matches = productsForCollection(products, route.path);
  return <div className="min-h-[70vh] bg-[#fbf8f2] pb-24">
    <section data-nb-contact-hero className="relative isolate overflow-hidden bg-[#2b241e] px-5 py-20 text-[#f7edde] md:px-12 md:py-28 lg:px-20">
      {bannerImage && <img src={bannerImage} alt="" aria-hidden="true" loading="eager" decoding="async"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center opacity-35 blur-[36px] saturate-75 md:blur-[54px]"/>}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#261b16]/95 via-[#271e18]/85 to-[#271e18]/60" aria-hidden="true"/>
      <div className="pointer-events-none absolute -right-24 -top-32 h-[510px] w-[510px] rounded-full border border-[#a28a6c]/20 bg-[radial-gradient(circle_at_center,#65513c,transparent_66%)]" aria-hidden="true"/>
      <div className="relative mx-auto max-w-[1330px]">
        <nav aria-label="Breadcrumb" className="mb-11 flex flex-wrap gap-2 text-[11px] uppercase tracking-[.15em] text-[#c6b59b]">
          <V2Link href="/" onNavigate={onNavigate}>{siteText(home,'collection.breadcrumb')}</V2Link><span aria-hidden="true">/</span>
          {route.isDepartment ? <span aria-current="page">{department.title}</span> : <>
            <V2Link href={department.path} onNavigate={onNavigate}>{department.title}</V2Link><span aria-hidden="true">/</span><span aria-current="page">{route.title}</span>
          </>}
        </nav>
        <p className="mb-6 text-[10px] font-semibold uppercase tracking-[.28em] text-[#ddb98b]">{siteText(home,'collection.eyebrow')} / {department.title}</p>
        <h1 className="max-w-[850px] font-serif break-words text-[clamp(2.65rem,8vw,7.4rem)] leading-[1] tracking-[-.06em]">{route.title}</h1>
        <p className="mt-7 max-w-xl text-sm leading-8 text-[#e0d2c1]">{route.description}</p>
         <div className="rounded-xl bg-[#fbf8f2] p-3 text-[#29221c] sm:inline-block">
           <ShareCatalogue title={route.title} path={route.path} compact/>
         </div>
         <p className="mt-3 max-w-lg text-xs leading-6 text-[#e5d0b2]">Share this catalogue to browse all published garments and photographs, including later pages.</p>
      </div>
    </section>
    <div className="mx-auto max-w-[1440px] px-5 pt-12 md:px-12 lg:px-20">
      {links.length > 0 && (
        <section className="mb-16" aria-label="Related collection categories">
          <div className="mb-7 flex flex-wrap items-center justify-between gap-3 border-b border-[#e2d7c8] pb-4">
            <h2 className="font-serif text-2xl text-[#2a241e]">{siteText(home,'collection.explore')} {department.title}</h2>
            <span className="text-[10px] uppercase tracking-[.15em] text-[#9c8059]">{links.length} categories</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {links.map((link) => (
              <V2Link key={link.path} href={link.path} onNavigate={onNavigate}
                className="inline-flex min-h-11 items-center gap-2 border border-[#ddcfbc] px-4 py-2 text-[12px] font-medium text-[#625342] transition-colors hover:border-[#9b7849] hover:bg-[#f1e7d7]">
                {link.label}<ArrowUpRight size={13}/>
              </V2Link>
            ))}
          </div>
        </section>
      )}
      <div className="mb-9 flex flex-wrap items-end justify-between gap-5 border-b border-[#e2d7c8] pb-5">
        <h2 className="font-serif text-[31px] tracking-[-.035em] text-[#2a241e] md:text-4xl">{siteText(home,'collection.heading')}</h2>
        <p className="text-xs text-[#84766a]">Showing {matches.length} {matches.length === 1 ? 'style' : 'styles'}{hasMore ? ' · more available' : ''}</p>
      </div>
      {route.path==='/men/sherwani/plain'&&<aside className="mb-9 rounded-xl border border-[#bea178] bg-[#f5ead9] p-5">
         <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#8f6637]">Interactive preview · Not inventory</p>
         <h3 className="mt-2 font-serif text-2xl">Explore our test Plain Sherwani</h3>
         <p className="mt-2 text-sm leading-6 text-[#66523e]">Review gallery, sizes and WhatsApp sharing before real stock photographs are approved.</p>
         <V2Link href={'/products/'+SAMPLE_SHERWANI.slug} onNavigate={onNavigate}
           className="mt-4 inline-flex min-h-12 items-center gap-2 border-b border-[#9e7547] text-sm font-semibold text-[#6b4a25]">
           Open demo garment <ArrowUpRight size={17}/>
         </V2Link>
       </aside>}
       {error ? <div className="border border-amber-200 bg-amber-50 px-6 py-8 text-center text-sm text-amber-900" role="status">
          The collection could not be loaded. Check your connection and try again.
          {onRetry && <button type="button" onClick={onRetry} className="ml-2 min-h-11 underline underline-offset-4">Try again</button>}
        </div> : matches.length ? <V2ProductGrid products={matches} home={home} onNavigate={onNavigate}/> :
        <V2Reveal className="relative overflow-hidden border border-[#dfd3c2] bg-[#f4ecdf] px-7 py-16 text-center md:py-24">
          <p className="mb-4 text-[10px] font-semibold uppercase tracking-[.22em] text-[#9b784e]">{siteText(home,'collection.emptyEyebrow')}</p>
          <h3 className="font-serif text-3xl text-[#29221c] md:text-5xl">{siteText(home,'collection.emptyTitle')}</h3>
          <p className="mx-auto mt-5 max-w-xl text-sm leading-8 text-[#74685b]">{siteText(home,'collection.emptyText')}</p>
          <V2Link href="/contact" onNavigate={onNavigate} className="mt-8 inline-flex min-h-12 items-center gap-3 bg-[#2c241c] px-6 text-xs font-semibold uppercase tracking-[.1em] text-white">
            <MapPin size={15}/> {siteText(home,'collection.emptyCta')}
          </V2Link>
        </V2Reveal>
      }
      {onPageChange && (hasMore || page>0) && <nav aria-label="Collection pages" className="mt-12 flex flex-wrap items-center justify-center gap-3">
        <button type="button" className="min-h-11 border border-[#b9a991] px-5 disabled:opacity-40"
          disabled={page===0} onClick={()=>onPageChange(Math.max(0,page-1))}>Previous</button>
        <span className="self-center text-sm">Page {page+1}</span>
        <button type="button" className="min-h-11 border border-[#b9a991] px-5 disabled:opacity-40"
          disabled={!hasMore} onClick={()=>onPageChange(page+1)}>Next</button>
      </nav>}
    </div>
  </div>;
}
