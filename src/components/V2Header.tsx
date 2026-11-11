import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion, useScroll } from 'motion/react';
import { ArrowRight, ChevronDown, MapPin, Menu, Search, X } from 'lucide-react';
import { DEPARTMENTS, DepartmentId, getDepartment } from '../storefront/navigation';
import V2Link from './V2Link';
import type {CmsHome,CmsCategoryRow} from '../lib/cmsData';
import {siteText} from '../lib/siteContent';

interface Props {
  path: string;
  home?: CmsHome;
  categories?: CmsCategoryRow[];
  onNavigate: (path: string) => void;
}
export default function V2Header({ path, home, categories=[] , onNavigate }: Props) {
  const visible=(route:string)=>categories.length===0||categories.some(c=>c.path===route);
  const categoryLabel=(route:string,fallback:string)=>categories.find(c=>c.path===route)?.label||fallback;
  const deptLabel=(id:DepartmentId)=>siteText(home,id==='men'?'nav.men':'nav.kids');
  const [open, setOpen] = useState<DepartmentId | null>(null);
  const [mobile, setMobile] = useState(false);
  const [mobileDepartment, setMobileDepartment] = useState<DepartmentId>('men');
  const [searchOpen, setSearchOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const reducedMotion = useReducedMotion();
  const wrapper = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll();

  const closeAll = () => { setOpen(null); setMobile(false); setSearchOpen(false); };
  const go = (target: string) => { closeAll(); onNavigate(target); };

  useEffect(() => { closeAll(); }, [path]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeAll();
    };
    const clickAway = (event: PointerEvent) => {
      if (open && wrapper.current && !wrapper.current.contains(event.target as Node)) setOpen(null);
    };
    document.addEventListener('keydown', escape);
    document.addEventListener('pointerdown', clickAway);
    return () => {
      document.removeEventListener('keydown', escape);
      document.removeEventListener('pointerdown', clickAway);
    };
  }, [open]);
  useEffect(() => {
    if (!mobile && !searchOpen) return;
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = old; };
  }, [mobile, searchOpen]);

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    if (keyword.trim()) go('/search?q=' + encodeURIComponent(keyword.trim()));
  };

  return <>
    <header ref={wrapper} className="sticky top-0 z-50 border-b border-[#e5ddd1] bg-[#fbf8f2]/95 backdrop-blur-xl">
      <div className="border-b border-[#e7dfd1] bg-[#1d1917] px-4 py-2 text-center text-[9px] font-semibold uppercase tracking-[0.22em] text-[#e7d9bf] md:text-[10px]">
        {siteText(home,'nav.announcement')}
      </div>
      <div className="relative mx-auto flex h-[76px] min-w-0 max-w-[1440px] items-center justify-between gap-2 px-3 min-[360px]:gap-3 min-[360px]:px-5 md:h-[90px] md:px-10 xl:px-14">
        <div className="flex items-center lg:hidden">
          <button type="button" aria-label="Open navigation" onClick={() => { setMobile(true); setOpen(null); }}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#ded6c8]">
            <Menu className="h-5 w-5" />
          </button>
        </div>
        <V2Link href="/" onNavigate={go} className="group flex min-w-0 max-w-[52vw] shrink flex-col items-center justify-center text-center sm:max-w-[45vw] lg:max-w-none lg:items-start lg:text-left"
          aria-label="Nomaan Brothers, return to homepage">
          <span className="max-w-full break-words font-serif text-[clamp(1.1rem,5.5vw,1.45rem)] font-medium leading-[.95] tracking-[-0.03em] text-[#201b17] sm:text-[26px] lg:text-[30px]">{siteText(home,'nav.brand')}</span>
          <span className="max-w-full break-words text-[8px] font-semibold uppercase tracking-[.12em] text-[#997b56] sm:tracking-[.22em] lg:text-[9px]">{siteText(home,'nav.tagline')}</span>
        </V2Link>
        <nav className="hidden items-center gap-2 lg:flex" aria-label="Shop departments">
          {DEPARTMENTS.map((department) => (
            <div key={department.id} className="flex items-center">
              <V2Link href={department.path} onNavigate={go}
                className={'px-4 py-3 text-[11px] font-semibold uppercase tracking-[.14em] transition-colors hover:text-[#a27e50] ' +
                  (path.startsWith(department.path) ? 'text-[#a27e50]' : 'text-[#29241e]')}>
                {deptLabel(department.id)}
              </V2Link>
              <button type="button" aria-expanded={open === department.id}
                aria-controls={'department-' + department.id}
                aria-label={'Explore ' + department.title + ' categories'}
                className="flex h-11 w-8 items-center justify-center"
                onClick={() => { setOpen(open === department.id ? null : department.id); setSearchOpen(false); }}>
                <ChevronDown className={'h-4 w-4 transition-transform ' + (open === department.id ? 'rotate-180' : '')} />
              </button>
            </div>
          ))}
          <V2Link href="/contact" onNavigate={go}
            className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[.14em] text-[#29241e] hover:text-[#a27e50]">
            {siteText(home,'nav.visit')}
          </V2Link>
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={() => { setSearchOpen(true); setOpen(null); }}
            aria-label="Search collections" className="flex h-11 w-11 items-center justify-center rounded-full text-[#29241e] hover:bg-[#f0e8dc]">
            <Search className="h-[19px] w-[19px]" strokeWidth={1.7}/>
          </button>
          <V2Link href="/contact" onNavigate={go}
            className="hidden min-h-11 items-center gap-2 border border-[#bea783] px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[.12em] text-[#524029] transition-colors hover:bg-[#efe4d2] md:inline-flex">
            {siteText(home,'nav.visitCta')} <ArrowRight className="h-3.5 w-3.5"/>
          </V2Link>
        </div>
      </div>
      <motion.div className="absolute bottom-0 left-0 h-[2px] w-full origin-left bg-[#af8754]"
        style={reducedMotion ? undefined : { scaleX: scrollYProgress }} aria-hidden="true" />
      <AnimatePresence>
        {open && (
          <motion.div id={'department-' + open}
            initial={reducedMotion ? false : { opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
            className="absolute left-0 top-full hidden w-full border-t border-[#e9dfd1] bg-[#fbf8f2] shadow-[0_26px_55px_-25px_rgba(25,20,16,.3)] lg:block">
            <div className="nb-responsive-grid mx-auto grid max-w-[1380px] grid-cols-[minmax(0,230px)_minmax(0,1fr)] gap-6 px-8 py-10 xl:gap-10 xl:px-12 xl:py-11">
              <div className="border-r border-[#e5d7c4] pr-9">
                <span className="text-[10px] font-semibold uppercase tracking-[.25em] text-[#a38053]">{siteText(home,'nav.discover')}</span>
                <h2 className="mt-4 font-serif text-4xl leading-[1.05] text-[#29221c]">{deptLabel(open)}</h2>
                <p className="mt-4 text-sm leading-7 text-[#756e65]">{getDepartment(open).description}</p>
                <V2Link href={getDepartment(open).path} onNavigate={go}
                  className="mt-7 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.12em] text-[#926c3e]">
                  {siteText(home,'nav.viewAll')} <ArrowRight className="h-4 w-4" />
                </V2Link>
              </div>
              <div className={'nb-responsive-grid grid gap-5 xl:gap-9 ' + (open === 'men' ? 'grid-cols-2 xl:grid-cols-4' : 'grid-cols-2')}>
                {getDepartment(open).groups.map(group=>({...group,items:group.items.filter(item=>visible(item.path))})).filter(group=>group.items.length>0).map((group) => (
                  <div key={group.title}>
                    <h3 className="mb-4 border-b border-[#ded1bd] pb-3 font-serif text-lg text-[#24201c]">{group.title}</h3>
                    <ul className="space-y-3.5">
                      {group.items.map((item) => (
                        <li key={item.path}>
                          <V2Link href={item.path} onNavigate={go}
                            className="text-[13px] text-[#6d655c] transition-colors hover:text-[#936f44]">
                            {categoryLabel(item.path,item.label)}
                          </V2Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>

    <AnimatePresence>
      {mobile && (
        <motion.div className="fixed inset-0 z-[70] lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button aria-label="Close navigation" onClick={closeAll} className="absolute inset-0 h-full w-full bg-black/50" />
          <motion.div role="dialog" aria-modal="true" aria-label="Browse collections" className="absolute inset-y-0 left-0 flex w-[min(92vw,420px)] flex-col overflow-y-auto overscroll-contain bg-[#fbf8f2] px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-[calc(1.25rem+env(safe-area-inset-top))] shadow-2xl sm:px-5"
            initial={reducedMotion ? false : { x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
            <div className="mb-5 flex items-center justify-between border-b border-[#e7ddd0] pb-5">
              <span className="font-serif text-2xl">{siteText(home,'nav.brand')}</span>
              <button type="button" aria-label="Close menu" className="flex h-11 w-11 items-center justify-center" onClick={closeAll}><X/></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {DEPARTMENTS.map((department) => (
                <button key={department.id} type="button" aria-expanded={mobileDepartment === department.id}
                  className={'min-h-12 border px-2 text-xs font-semibold uppercase tracking-[.08em] ' +
                    (mobileDepartment === department.id ? 'border-[#9c7949] bg-[#30251c] text-[#f4e9d4]' : 'border-[#dfd4c5] text-[#544b40]')}
                  onClick={() => setMobileDepartment(department.id)}>{deptLabel(department.id)}</button>
              ))}
            </div>
            <V2Link href={getDepartment(mobileDepartment).path} onNavigate={go}
              className="my-6 flex items-center justify-between border-b border-[#e6dbcc] pb-4 font-serif text-xl">
              All {deptLabel(mobileDepartment)}<ArrowRight size={17}/>
            </V2Link>
            {getDepartment(mobileDepartment).groups.map(group=>({...group,items:group.items.filter(item=>visible(item.path))})).filter(group=>group.items.length>0).map((group) => (
              <section key={group.title} className="mb-6">
                <h3 className="mb-3 text-[10px] font-bold uppercase tracking-[.2em] text-[#9b794d]">{group.title}</h3>
                <ul className="space-y-1">
                  {group.items.map((item) => (
                    <li key={item.path}>
                      <V2Link href={item.path} onNavigate={go}
                        className="flex min-h-11 items-center border-b border-[#ede4d9] py-3 text-sm text-[#3d362e]">
                        {categoryLabel(item.path,item.label)}
                      </V2Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            <V2Link href="/contact" onNavigate={go} className="mt-auto flex min-h-12 items-center gap-2 border-t border-[#e3d7c8] pt-5 text-sm font-semibold">
              <MapPin size={17}/> {siteText(home,'nav.mobileContact')}
            </V2Link>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    <AnimatePresence>
      {searchOpen && (
        <motion.div role="dialog" aria-modal="true" aria-label="Search clothing collections"
          className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-[#16110d]/70 px-3 pt-[max(1.5rem,env(safe-area-inset-top))] backdrop-blur-sm sm:px-4 sm:pt-[12vh]"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="max-h-[calc(100svh-2.5rem)] w-full min-w-0 max-w-2xl overflow-y-auto bg-[#fbf8f2] p-4 shadow-2xl min-[360px]:p-6 md:p-9">
            <div className="mb-7 flex min-w-0 items-center justify-between gap-3">
              <h2 className="min-w-0 break-words font-serif text-[clamp(1.5rem,6vw,1.875rem)]">{siteText(home,'nav.searchTitle')}</h2>
              <button type="button" aria-label="Close search" onClick={closeAll} className="flex h-11 w-11 items-center justify-center"><X/></button>
            </div>
            <form onSubmit={submitSearch} className="flex gap-2 border-b border-[#bda887] pb-3">
              <input autoFocus aria-label="Search products" placeholder={siteText(home,'nav.searchPlaceholder')}
                value={keyword} onChange={(e) => setKeyword(e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-[#998a77]"/>
              <button type="submit" aria-label="Submit search" className="flex h-11 w-11 items-center justify-center"><ArrowRight/></button>
            </form>
            <p className="mt-5 text-xs leading-6 text-[#786d5e]">{siteText(home,'nav.searchHelp')}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </>;
}
