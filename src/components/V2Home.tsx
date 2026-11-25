import React, { useCallback, useEffect, useRef, useState } from 'react';
import {ArrowDownRight,ArrowRight,ArrowUpRight,MapPin,MoveDownRight,MessageCircle,Phone,Scissors,Ruler} from 'lucide-react';
import { Product } from '../types';
import { optimizedImageUrl, type CmsHome, type CmsCategoryRow } from '../lib/cmsData';
import {siteText,homeSectionStyle,featuredCardStyle} from '../lib/siteContent';
import { type CatalogProduct, productsForCollection, productImage } from '../storefront/catalog';
import V2Link from './V2Link';
import V2Reveal from './V2Reveal';
import V2HomeDiscovery from './V2HomeDiscovery';
import V2HomeShowcase from './V2HomeShowcase';
import HeroBrandIntro from './HeroBrandIntro';

interface Props {products: CatalogProduct[]; home: CmsHome; categories?:CmsCategoryRow[]; onNavigate:(path:string)=>void;}

function SectionVideo({url,label}:{url?:string;label:string}){
  return url?<div className="mx-auto mt-10 max-w-[1050px] overflow-hidden rounded-md border border-[#a7906e]/25 bg-[#1c1714]">
    <video controls preload="none" playsInline src={url} aria-label={label} className="aspect-video w-full object-cover"/>
  </div>:null;
}
export default function V2Home({ products, home, categories=[], onNavigate }: Props) {
  const photo = home.heroImage;
  const call=home.contactPhone?'tel:+'+home.contactPhone:null;
  const whatsapp=home.contactWhatsapp?'https://wa.me/'+home.contactWhatsapp+
    '?text='+encodeURIComponent('Hello Nomaan Brothers, I would like to discuss customized sherwani tailoring, fabric choices and measurements.'):null;
  const photoTwo = home.storyImage || home.menImage;
  const hero = useRef<HTMLElement>(null);
  const heroBgRef = useRef<HTMLImageElement>(null);
  const heroTextRef = useRef<HTMLDivElement>(null);
  const scrollHintRef = useRef<HTMLDivElement>(null);
  const [reduce, setReduce] = useState(false);
  const [introCycle,setIntroCycle]=useState(0);
  const [introActive,setIntroActive]=useState(true);
  const onIntroComplete=useCallback(()=>setIntroActive(false),[]);
  const replayFilm=()=>{setIntroActive(true);setIntroCycle(n=>n+1);};

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const prefersReduced = Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    setReduce(prefersReduced);
    if (prefersReduced) return;

    let raf = 0;
    const applyParallax = () => {
      raf = 0;
      const el = hero.current;
      if (!el) return;
      const height = Math.max(1, el.offsetHeight);
      const progress = Math.min(1, Math.max(0, window.scrollY / height));
      if (heroBgRef.current) {
        heroBgRef.current.style.transform = `translate3d(0, ${(progress * 64).toFixed(1)}px, 0) scale(1.10)`;
      }
      if (heroTextRef.current) {
        heroTextRef.current.style.transform = `translate3d(0, ${(-progress * 30).toFixed(1)}px, 0)`;
      }
      if (scrollHintRef.current) {
        scrollHintRef.current.style.opacity = String(Math.max(0, 1 - progress / 0.6));
      }
    };
    const onScroll = () => {
      if (!raf) raf = window.requestAnimationFrame(applyParallax);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);
  const getImage = (route: string, fallback = '') =>
    productImage(productsForCollection(products, route)[0] || {} as Product) || fallback;

  const edits = [
    { id:'one', eyebrow: siteText(home,'home.card1Eyebrow'), title:siteText(home,'home.card1Title'), description:siteText(home,'home.card1Text'), route: '/men/sherwani',
      image: home.featuredImages.one || getImage('/men/sherwani', photo) || '/editorial/sherwani.svg', tone: 'bg-[#2b2926]' },
    { id:'two', eyebrow:siteText(home,'home.card2Eyebrow'), title:siteText(home,'home.card2Title'), description:siteText(home,'home.card2Text'), route: '/men/kurta-pyjama',
      image: home.featuredImages.two || getImage('/men/kurta-pyjama', photoTwo) || '/editorial/kurta.svg', tone: 'bg-[#44392d]' },
    { id:'three', eyebrow:siteText(home,'home.card3Eyebrow'), title:siteText(home,'home.card3Title'), description:siteText(home,'home.card3Text'), route: '/men/jodhpuri',
      image: home.featuredImages.three || getImage('/men/jodhpuri', '') || '/editorial/jodhpuri.svg', tone: 'bg-[#545045]' },
  ];

  return <div className="flex flex-col overflow-hidden bg-[#fbf8f2]">
    {/* An immersive cover with a real heading and accessible normal scrolling. */}
    <section ref={hero} data-nb-contact-hero style={homeSectionStyle(home,'hero')} className="relative isolate min-h-[620px] overflow-hidden bg-[#211b17] text-[#fff8ed] md:min-h-[730px] lg:min-h-[min(860px,calc(100svh-106px))]" aria-labelledby="v2-home-title">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_28%_35%,#5d4939_0,transparent_56%)]" />
      <div className="absolute inset-y-0 right-0 w-[100%] md:w-[65%] lg:w-[57%]">
           {photo && <img ref={heroBgRef} src={optimizedImageUrl(photo, 1600, 85)} alt="" fetchPriority="high" loading="eager" decoding="async"
             className="h-full w-full scale-[1.10] object-cover object-center opacity-[.60] md:opacity-90" />}
         </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#211b17] via-[#211b17]/90 to-[#211b17]/30 md:via-[#211b17]/75 md:to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#211b17]/70 via-transparent to-[#211b17]/10" />
      <div data-testid="main-hero" inert={introActive&&!reduce}
        className="relative mx-auto grid min-h-[620px] max-w-[1440px] grid-cols-1 items-center gap-8 px-4 pb-24 pt-16 min-[360px]:px-5 sm:px-6 sm:pt-20 md:min-h-[730px] md:px-12 lg:min-h-[min(860px,calc(100svh-106px))] lg:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)] lg:gap-8 lg:px-20 xl:gap-14">
        <div ref={heroTextRef} className="relative z-10 min-w-0 max-w-[660px]">
          <div className="motion-safe:animate-[nb-hero-enter_560ms_cubic-bezier(0.22,1,0.36,1)_both]">
            <div className="mb-8 flex min-w-0 items-center gap-3 break-words text-[10px] font-semibold uppercase tracking-[.19em] text-[#e9c797] min-[360px]:gap-4 min-[360px]:tracking-[.26em]">
              <span className="h-px w-10 bg-[#cba777]"/> {home.heroEyebrow}
            </div>
            <h1 id="v2-home-title" tabIndex={-1} className="nb-liquid-hero max-w-[12ch] font-serif break-words text-[clamp(2.8rem,10vw,8.1rem)] font-normal leading-[.98] tracking-[-.065em] sm:leading-[.93]">
              {home.heroTitle}
            </h1>
            <p className="mt-8 max-w-[465px] text-sm leading-8 text-[#e0d6c7] md:text-base">
              {home.heroSubtitle}
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <V2Link href="/men" onNavigate={onNavigate} className="inline-flex min-h-12 items-center gap-4 border border-[#f1dfbd] bg-[#e9d2ad] px-7 py-3 text-[11px] font-bold uppercase tracking-[.12em] text-[#281f16] transition-colors hover:bg-[#fff1d8]">
                {siteText(home,'home.heroMen')} <ArrowUpRight size={17}/>
              </V2Link>
              <V2Link href="/kids" onNavigate={onNavigate} className="inline-flex min-h-12 items-center gap-4 border border-white/50 px-7 py-3 text-[11px] font-semibold uppercase tracking-[.12em] text-white transition-colors hover:bg-white/10">
                {siteText(home,'home.heroKids')} <ArrowRight size={17}/>
              </V2Link>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-semibold uppercase tracking-[.12em] text-[#e6cfa9]">
              <a href="#tailoring" className="inline-flex min-h-10 items-center gap-2 border-b border-[#e9d2ad]/50 hover:border-[#fff1d8] hover:text-white">
                <Scissors size={14}/>{siteText(home,'home.heroTailor')}
              </a>
              {whatsapp&&<a href={whatsapp} target="_blank" rel="noopener noreferrer"
                className="inline-flex min-h-10 items-center gap-2 hover:text-white">
                <MessageCircle size={14}/>{siteText(home,'home.heroWhatsapp')}</a>}
              {call&&<a href={call} className="inline-flex min-h-10 items-center gap-2 hover:text-white">
                <Phone size={14}/>{siteText(home,'home.heroPhone')}</a>}
              {home.sectionVideos.hero&&<button type="button" onClick={replayFilm}
                className="inline-flex min-h-10 items-center gap-1.5 hover:text-white">
                Replay brand film <ArrowUpRight size={14}/>
              </button>}
            </div>
          </div>
        </div>
        <div className="relative z-10 w-full min-w-0 lg:justify-self-end" aria-label="Editorial collection artwork">
          <div className="group nb-hero-editorial-frame relative mx-auto aspect-[16/10] max-h-[330px] w-full max-w-[530px] overflow-hidden rounded-[1.55rem] border border-[#e5c69d]/50 bg-[#31271e] shadow-[0_28px_90px_-30px_rgba(0,0,0,.72)] sm:aspect-[5/4] lg:mx-0 lg:aspect-[4/5] lg:max-h-[570px]">
            <img src={photo||'/editorial/sherwani.svg'}
              alt={photo?'Nomaan Brothers showroom editorial photograph':'Illustrative garment concept, not actual showroom inventory'}
              loading="eager" decoding="async"
              className="h-full w-full object-cover object-[50%_30%] opacity-[.93] transition-transform duration-[1500ms] ease-out motion-safe:group-hover:scale-[1.045]"/>
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#130e0b]/80 via-transparent to-[#130e0b]/20"/>
            <div className="pointer-events-none absolute inset-4 rounded-[1rem] border border-white/25 sm:inset-6" aria-hidden="true"/>
            <span className="absolute left-7 top-7 text-[10px] font-semibold uppercase tracking-[.22em] text-[#f8e7c9] sm:left-10 sm:top-10">The occasion edit</span>
            <div className="absolute inset-x-0 bottom-0 flex min-w-0 items-end justify-between gap-4 p-7 text-white sm:p-10">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-[#f0cca0]">Nomaan Brothers / Warangal</p>
                <p className="mt-2 max-w-[14ch] font-serif text-[clamp(1.55rem,4vw,2.5rem)] leading-tight">Discover your signature look.</p>
                {!photo&&<p className="mt-2 text-[10px] leading-5 text-[#ecd9bd]">Illustrative concept</p>}
              </div>
              <V2Link href="/men/sherwani" onNavigate={onNavigate}
                aria-label="Explore the sherwani collection"
                className="inline-flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-full border border-white/70 bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white hover:text-[#281d14]">
                <ArrowUpRight size={19}/>
              </V2Link>
            </div>
          </div>
        </div>
         <div ref={scrollHintRef} className="absolute bottom-8 left-6 flex items-center gap-3 text-[10px] font-medium uppercase tracking-[.22em] text-white/75 md:left-12 lg:left-20">
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/40"><MoveDownRight size={14}/></span> {siteText(home,'home.scroll')}
        </div>
        <div className="absolute bottom-9 right-7 hidden border-l border-white/40 pl-5 text-[10px] uppercase tracking-[.24em] text-[#e3d6c4] lg:block">
          Nomaan Brothers · Warangal
        </div>
      </div>
    </section>
    {/* Keep the fixed intro outside the isolated hero stacking context so it
        truly covers the mobile navigation and the entire viewport. */}
    <HeroBrandIntro key={introCycle} url={home.sectionVideos.hero}
      poster={photo||'/editorial/sherwani.svg'} reducedMotion={Boolean(reduce)}
      replay={introCycle>0} onComplete={onIntroComplete}/>

    <nav aria-label="Explore popular collections" style={homeSectionStyle(home,'quick')} className="border-b border-[#e0d4c2] bg-[#f2eadd] px-5 md:px-12 lg:px-20">
      <div className="mx-auto flex max-w-[1330px] items-center gap-5 overflow-x-auto overscroll-x-contain scroll-px-4 py-4 md:gap-8">
        <span className="shrink-0 text-[10px] font-bold uppercase tracking-[.18em] text-[#8d704d]">{siteText(home,'home.quickLabel')}</span>
        <div className="h-6 w-px shrink-0 bg-[#d2c2ac]" aria-hidden="true"/>
        <V2Link href="/men/sherwani" onNavigate={onNavigate} className="inline-flex min-h-11 shrink-0 items-center gap-2 text-xs font-semibold text-[#4b3827] hover:text-[#a17848]">{siteText(home,'home.quickSherwani')} <ArrowUpRight size={15}/></V2Link>
        <V2Link href="/men/kurta-pyjama" onNavigate={onNavigate} className="inline-flex min-h-11 shrink-0 items-center gap-2 text-xs font-semibold text-[#4b3827] hover:text-[#a17848]">{siteText(home,'home.quickKurta')} <ArrowUpRight size={15}/></V2Link>
        <V2Link href="/men/marriage" onNavigate={onNavigate} className="inline-flex min-h-11 shrink-0 items-center gap-2 text-xs font-semibold text-[#4b3827] hover:text-[#a17848]">{siteText(home,'home.quickWedding')} <ArrowUpRight size={15}/></V2Link>
        <V2Link href="/kids" onNavigate={onNavigate} className="inline-flex min-h-11 shrink-0 items-center gap-2 text-xs font-semibold text-[#4b3827] hover:text-[#a17848]">{siteText(home,'home.quickKids')} <ArrowUpRight size={15}/></V2Link>
        <a href="#collection-directory" className="inline-flex min-h-11 shrink-0 items-center gap-2 border-b border-[#a17b4b] text-xs font-semibold text-[#70512e] hover:text-[#a17848]">{siteText(home,'home.quickAll')} <ArrowRight size={16}/></a>
      </div>
      <SectionVideo url={home.sectionVideos.quick} label="Featured quick-links video"/>
    </nav>

    <V2HomeShowcase products={products} home={home} categories={categories} onNavigate={onNavigate}/>

    <section style={homeSectionStyle(home,'departments')} className="mx-auto max-w-[1440px] px-5 pb-16 pt-16 md:px-12 md:pb-24 md:pt-24 lg:px-20" aria-labelledby="departments-title">
      <V2Reveal className="mb-10 flex flex-wrap items-end justify-between gap-4 md:mb-16">
        <div>
          <p className="mb-4 text-[10px] font-bold uppercase tracking-[.28em] text-[#a37d50]">{siteText(home,'home.departmentEyebrow')}</p>
          <h2 id="departments-title" className="max-w-[730px] font-serif text-[clamp(2.8rem,5.5vw,5.5rem)] leading-[1.04] tracking-[-.05em] text-[#29221b]">
            {siteText(home,'home.departmentTitle')}
          </h2>
        </div>
        <p className="max-w-xs text-sm leading-7 text-[#73685e]">{siteText(home,'home.departmentDescription')}</p>
      </V2Reveal>
      <div className="nb-responsive-grid grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
        <V2Reveal className="group relative min-h-[390px] overflow-hidden bg-[#332b24] text-white min-[360px]:min-h-[490px] md:min-h-[560px] xl:min-h-[620px]">
          {(home.menImage || getImage('/men') || '/editorial/sherwani.svg') && <img src={home.menImage || getImage('/men') || '/editorial/sherwani.svg'} loading="lazy" decoding="async" alt="Traditional menswear collection preview"
            className="absolute inset-0 h-full w-full object-cover object-top opacity-75 transition-transform duration-700 group-hover:scale-[1.045]"/>}
          <div className="absolute inset-0 bg-gradient-to-t from-[#1b1815]/95 via-[#1b1815]/5 to-black/5"/>
          <div className="absolute inset-x-0 bottom-0 flex min-w-0 items-end justify-between gap-3 px-5 pb-7 min-[360px]:px-7 min-[360px]:pb-9 md:px-8 md:pb-10 xl:px-11 xl:pb-12">
            <div className="min-w-0"><span className="text-[10px] uppercase tracking-[.27em] text-[#ebd6b2]">{siteText(home,'home.menCardEyebrow')}</span>
              <h3 className="mt-3 font-serif text-[clamp(2.35rem,10vw,3rem)] tracking-[-.04em] md:text-6xl">{siteText(home,'home.menCardTitle')}</h3>
              <p className="mt-3 text-sm text-[#eee2d2]">{siteText(home,'home.menCardDescription')}</p>
            </div>
            <V2Link href="/men" onNavigate={onNavigate} aria-label="Explore men's wear"
              className="flex h-13 w-13 shrink-0 items-center justify-center rounded-full border border-white/70 transition-colors hover:bg-white hover:text-[#241d17]"><ArrowUpRight/></V2Link>
          </div>
        </V2Reveal>
        <V2Reveal delay={0.1} className="group relative min-h-[390px] overflow-hidden bg-[#c7bba4] min-[360px]:min-h-[490px] md:min-h-[560px] xl:min-h-[620px]">
          {/* An illustrated placeholder avoids presenting adult product photographs as kidswear. */}
          {(home.kidsImage || '/editorial/kids.svg') ? <img src={home.kidsImage || '/editorial/kids.svg'} alt="Illustrative kidswear editorial artwork (not current stock)" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover object-top"/> : <>
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_20%,#eee3cb_0,transparent_50%),linear-gradient(130deg,#c2ad8a,#f4e5cc_70%,#a58e6b)]"/>
            <div className="absolute left-[45%] top-[12%] h-[370px] w-[240px] rotate-[-16deg] rounded-[48%_48%_12%_12%] border-[22px] border-[#8e7250]/25 bg-[#d6c19b]/30 shadow-[30px_40px_90px_rgba(50,34,18,.2)] md:h-[460px] md:w-[290px]"/>
            <div className="absolute left-[30%] top-[17%] h-[330px] w-[170px] rotate-[15deg] rounded-[46%_46%_18%_18%] border-[12px] border-[#f8ead1]/45 bg-[#d9bf93]/15 md:h-[430px] md:w-[210px]"/>
          </>}
          <div className="absolute left-10 top-10 flex h-24 w-24 items-center justify-center rounded-full border border-[#9b7f58]/55 text-[9px] uppercase tracking-[.18em] text-[#816744] md:h-28 md:w-28">Little<br/>Traditions</div>
          <div className="absolute inset-0 bg-gradient-to-t from-[#6d5135]/70 via-transparent to-transparent"/>
          <div className="absolute inset-x-0 bottom-0 flex min-w-0 items-end justify-between gap-3 px-5 pb-7 text-white min-[360px]:px-7 min-[360px]:pb-9 md:px-8 md:pb-10 xl:px-11 xl:pb-12">
            <div className="min-w-0"><span className="text-[10px] uppercase tracking-[.27em] text-[#fff1d9]">{siteText(home,'home.kidsCardEyebrow')}</span>
              <h3 className="mt-3 font-serif text-[clamp(2.35rem,10vw,3rem)] tracking-[-.04em] md:text-6xl">{siteText(home,'home.kidsCardTitle')}</h3>
              <p className="mt-3 text-sm text-[#fff2df]">{siteText(home,'home.kidsCardDescription')}</p>
            </div>
            <V2Link href="/kids" onNavigate={onNavigate} aria-label="Explore kids wear"
              className="flex h-13 w-13 shrink-0 items-center justify-center rounded-full border border-white/70 text-white transition-colors hover:bg-white hover:text-[#241d17]"><ArrowUpRight/></V2Link>
          </div>
        </V2Reveal>
      </div>
      <SectionVideo url={home.sectionVideos.departments} label="Departments video"/>
    </section>

    <div style={homeSectionStyle(home,'directory')}>
      <V2HomeDiscovery products={products} home={home} categories={categories} onNavigate={onNavigate}/>
      <SectionVideo url={home.sectionVideos.directory} label="Collection directory video"/>
    </div>

    <section style={homeSectionStyle(home,'featured')} className="bg-[#eee7db] px-5 py-24 md:px-12 md:py-28 lg:px-20" aria-labelledby="featured-title">
      <div className="mx-auto max-w-[1330px]">
        <V2Reveal className="mb-12 flex flex-wrap items-end justify-between gap-6">
          <div><p className="mb-4 text-[10px] font-bold uppercase tracking-[.28em] text-[#a37d50]">{siteText(home,'home.featureEyebrow')}</p>
            <h2 id="featured-title" className="font-serif text-[clamp(2.8rem,5vw,5.1rem)] leading-[1.02] tracking-[-.045em] text-[#29221b]">{siteText(home,'home.featureTitle')}</h2></div>
          <V2Link href="/men" onNavigate={onNavigate} className="inline-flex items-center gap-3 border-b border-[#a98d6a] pb-2 text-[11px] font-bold uppercase tracking-[.14em] text-[#6b502d]">{siteText(home,'home.featureCta')} <ArrowRight size={16}/></V2Link>
        </V2Reveal>
        <div className="nb-responsive-grid grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {edits.map((edit, i) => (
            <V2Reveal key={edit.route} delay={i * 0.075} style={featuredCardStyle(home,edit.id)} className={'group overflow-hidden ' + edit.tone}>
              <V2Link href={edit.route} onNavigate={onNavigate} className="block">
                <div className="relative aspect-[3/4] overflow-hidden">
                  {edit.image ? <img src={optimizedImageUrl(edit.image, 700, 80)} alt="" loading="lazy" decoding="async"
                    className="h-full w-full object-cover object-top opacity-85 transition-transform duration-700 group-hover:scale-[1.045]"/>
                    : <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_60%_30%,#80705c,transparent_60%)]">
                      <span className="font-serif text-7xl italic text-white/15">{String(i + 1).padStart(2,'0')}</span></div>}
                  <span className="absolute left-6 top-6 text-[10px] font-semibold uppercase tracking-[.18em] text-white/95">{edit.eyebrow}</span>
                  <span className="absolute bottom-5 right-5 flex h-11 w-11 items-center justify-center rounded-full border border-white/70 text-white transition-colors group-hover:bg-white group-hover:text-[#29221b]"><ArrowUpRight size={19}/></span>
                </div>
                <div className="bg-[#faf7f0] p-6"><h3 className="font-serif text-[28px] leading-tight tracking-[-.03em] text-[#28231e]">{edit.title}</h3>
                  <p className="mt-2 text-[13px] leading-6 text-[#81786e]">{edit.description}</p></div>
              </V2Link>
            </V2Reveal>
          ))}
        </div>
        <SectionVideo url={home.sectionVideos.featured} label="Featured garment video"/>
      </div>
    </section>

    <section style={homeSectionStyle(home,'story')} className="relative overflow-hidden bg-[#211b17] px-5 py-24 text-[#f9efe0] md:px-12 md:py-32 lg:px-20">
      <div className="nb-responsive-grid mx-auto grid max-w-[1330px] items-center gap-12 lg:grid-cols-[minmax(0,.93fr)_minmax(0,1.07fr)] lg:gap-16 xl:gap-20">
        <V2Reveal>
          <p className="mb-6 text-[10px] font-semibold uppercase tracking-[.29em] text-[#d8b581]">{siteText(home,'home.storyEyebrow')}</p>
          <h2 className="max-w-[14ch] break-words font-serif text-[clamp(2.7rem,5.3vw,6rem)] leading-[1.03] tracking-[-.045em]">{home.storyTitle}</h2>
          <p className="mt-7 max-w-md text-sm leading-8 text-[#d7cabc]">{home.storyDescription}</p>
          <V2Link href="/men/marriage" onNavigate={onNavigate} className="mt-9 inline-flex items-center gap-4 border-b border-[#d8bd93] pb-3 text-xs font-semibold uppercase tracking-[.12em] text-[#ead7b8]">{siteText(home,'home.storyCta')} <ArrowDownRight size={17}/></V2Link>
        </V2Reveal>
        <V2Reveal className="relative">
          <div className="absolute -right-5 -top-5 h-full w-full border border-[#a88e70]/50" aria-hidden="true"/>
          {home.sectionVideos.story?<video controls playsInline preload="metadata" src={home.sectionVideos.story}
              className="relative z-10 aspect-[4/5] w-full object-cover" aria-label="Brand story film"/>:
           (getImage('/men/kurta-pyjama', photoTwo)||'/editorial/kurta.svg') ? <img src={getImage('/men/kurta-pyjama', photoTwo)||'/editorial/kurta.svg'} alt="Editorial garment illustration" loading="lazy" decoding="async" className="relative z-10 aspect-[4/5] w-full object-cover object-top"/> :
            <div aria-hidden="true" className="relative z-10 aspect-[4/5] w-full bg-[radial-gradient(circle_at_70%_30%,#7f674c,transparent_60%)]"/>}
        </V2Reveal>
      </div>
    </section>

    <section id="tailoring" style={homeSectionStyle(home,'customization')}
      className="scroll-mt-24 overflow-hidden bg-[#e7d7c0] px-5 py-24 text-[#30251b] md:px-12 md:py-32 lg:px-20">
      <div className="nb-responsive-grid mx-auto grid max-w-[1320px] items-center gap-12 lg:grid-cols-2 lg:gap-20">
        <div>
          <p className="mb-6 text-xs font-bold uppercase tracking-[.25em] text-[#916a3a]"><Scissors size={18} className="mr-2 inline"/>
            {siteText(home,'home.customEyebrow')}</p>
          <h2 className="font-serif text-[clamp(2.8rem,5vw,5.6rem)] leading-[1.06] tracking-[-.05em]">{siteText(home,'home.customTitle')}</h2>
          <p className="mt-7 max-w-xl text-sm leading-8 text-[#695645]">{siteText(home,'home.customText')}</p>
          <ol className="mt-9 space-y-4 border-t border-[#c7ad8d] pt-7">
            {[siteText(home,'home.customStep1'),siteText(home,'home.customStep2'),siteText(home,'home.customStep3')].map((step,index)=>
              <li key={index} className="flex items-center gap-4 text-sm font-semibold">
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#a38762] text-xs">{String(index+1).padStart(2,'0')}</span>
                {step}</li>)}
          </ol>
          <div className="mt-10 flex flex-wrap gap-3">
            {whatsapp&&<a href={whatsapp} target="_blank" rel="noopener noreferrer"
              className="inline-flex min-h-12 items-center gap-3 bg-[#2c241c] px-6 text-xs font-bold uppercase text-white">
              <MessageCircle size={18}/>{siteText(home,'home.customWhatsApp')}</a>}
            {call&&<a href={call} className="inline-flex min-h-12 items-center gap-3 border border-[#7b6344] px-6 text-xs font-bold uppercase">
              <Phone size={18}/>{siteText(home,'home.customCall')}</a>}
            {!whatsapp&&!call&&<V2Link href="/contact" onNavigate={onNavigate}
              className="inline-flex min-h-12 items-center gap-2 border border-[#7b6344] px-6 text-xs font-bold uppercase">
              Contact about custom tailoring <ArrowUpRight size={16}/></V2Link>}
          </div>
        </div>
        <div className="relative overflow-hidden bg-[#816c56] shadow-[0_40px_75px_-30px_rgba(24,17,11,.45)]">
          {home.sectionVideos.customization?
            <video src={home.sectionVideos.customization} controls playsInline preload="metadata"
              className="aspect-[4/5] w-full object-cover" aria-label="Custom tailoring showcase"/>:
           home.customizationImage?
            <img src={home.customizationImage} loading="lazy" alt="Custom garment fabric and tailoring" className="aspect-[4/5] w-full object-cover"/>:
            <div className="flex aspect-[4/5] flex-col items-center justify-center gap-6 bg-[radial-gradient(circle_at_55%_25%,#baa084,transparent_55%),linear-gradient(140deg,#6a5038,#211a16)] text-[#eee0cc]">
              <Ruler size={70} strokeWidth={0.8}/><span className="font-serif text-4xl italic">Made for you.</span>
            </div>}
        </div>
      </div>
    </section>

    <section style={homeSectionStyle(home,'visit')} className="px-6 py-24 text-center md:py-28" aria-labelledby="visit-title">
      <V2Reveal className="mx-auto max-w-[790px]">
        <MapPin className="mx-auto mb-7 h-7 w-7 text-[#a47d4e]" strokeWidth={1.2}/>
        <p className="mb-5 text-[10px] font-bold uppercase tracking-[.27em] text-[#9b7649]">{siteText(home,'home.visitEyebrow')}</p>
        <h2 id="visit-title" className="font-serif text-[clamp(2.8rem,5vw,5.7rem)] leading-[1.05] tracking-[-.045em] text-[#282019]">{siteText(home,'home.visitTitle')}</h2>
        <p className="mx-auto mt-6 max-w-xl text-sm leading-8 text-[#71685e]">{siteText(home,'home.visitText')}</p>
        <V2Link href="/contact" onNavigate={onNavigate} className="mt-9 inline-flex min-h-12 items-center gap-4 bg-[#2b231b] px-8 py-3 text-[11px] font-semibold uppercase tracking-[.15em] text-white hover:bg-[#644a30]">
          {siteText(home,'home.visitCta')} <ArrowUpRight size={17}/>
        </V2Link>
      </V2Reveal>
      <SectionVideo url={home.sectionVideos.visit} label="Visit showroom film"/>
    </section>
  </div>;
}
