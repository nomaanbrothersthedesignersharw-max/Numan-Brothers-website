import React from 'react';
import {ArrowUpRight,MapPin} from 'lucide-react';
import SocialLinks from './SocialLinks';
import V2Link from './V2Link';
import type {CmsHome,CmsCategoryRow} from '../lib/cmsData';
import {siteText} from '../lib/siteContent';

const men = [
  { label: 'Kurta Pyjama', path: '/men/kurta-pyjama' },
  { label: 'Sherwani', path: '/men/sherwani' },
  { label: 'Suits', path: '/men/suits' },
  { label: 'Jodhpuri', path: '/men/jodhpuri' },
  { label: 'Marriage Collection', path: '/men/marriage' },
];
const kids = [
  { label: 'Kurta Pyjama', path: '/kids/kurta-pyjama' },
  { label: 'Sherwani', path: '/kids/sherwani' },
  { label: 'Pathani', path: '/kids/pathani' },
  { label: 'Jodhpuri', path: '/kids/jodhpuri' },
  { label: 'Suits', path: '/kids/suits' },
];
export default function V2Footer({ onNavigate,home,categories=[] }: {onNavigate:(path:string)=>void;home?:CmsHome;categories?:CmsCategoryRow[]}) {
  const visible=(path:string)=>categories.length===0||categories.some(c=>c.path===path);
  const label=(path:string,fallback:string)=>categories.find(c=>c.path===path)?.label||fallback;
  return <footer className="bg-[#1d1916] px-4 pt-16 text-[#eee4d5] min-[360px]:px-6 md:px-12 md:pt-24 lg:px-20">
    <div className="mx-auto max-w-[1330px]">
      <div className="nb-responsive-grid grid gap-10 border-b border-[#594738] pb-16 sm:grid-cols-2 md:gap-12 xl:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))] xl:pb-20">
        <div className="min-w-0 max-w-xs">
          <V2Link href="/" onNavigate={onNavigate} className="break-words font-serif text-[clamp(1.8rem,6vw,2.25rem)] leading-[1.05] tracking-[-.05em]">{siteText(home,'footer.brand')}</V2Link>
          <p className="mt-5 text-[10px] font-semibold uppercase tracking-[.23em] text-[#d8b586]">{siteText(home,'footer.tagline')}</p>
          <p className="mt-7 text-sm leading-8 text-[#b9aa9a]">{siteText(home,'footer.description')}</p>
        </div>
        <div>
          <h2 className="mb-6 text-[10px] font-bold uppercase tracking-[.22em] text-[#cfae81]">{siteText(home,'footer.men')}</h2>
          <ul className="space-y-4">{men.filter(item=>visible(item.path)).map((item) => <li key={item.path}><V2Link href={item.path} onNavigate={onNavigate} className="text-sm text-[#cfc3b5] transition-colors hover:text-white">{label(item.path,item.label)}</V2Link></li>)}</ul>
        </div>
        <div>
          <h2 className="mb-6 text-[10px] font-bold uppercase tracking-[.22em] text-[#cfae81]">{siteText(home,'footer.kids')}</h2>
          <ul className="space-y-4">{kids.filter(item=>visible(item.path)).map((item) => <li key={item.path}><V2Link href={item.path} onNavigate={onNavigate} className="text-sm text-[#cfc3b5] transition-colors hover:text-white">{label(item.path,item.label)}</V2Link></li>)}</ul>
        </div>
        <div>
          <h2 className="mb-6 text-[10px] font-bold uppercase tracking-[.22em] text-[#cfae81]">{siteText(home,'footer.find')}</h2>
          <p className="flex items-start gap-3 text-sm leading-7 text-[#cfc3b5]"><MapPin size={18} className="mt-1 shrink-0"/> {siteText(home,'footer.address')}</p>
          <V2Link href="/contact" onNavigate={onNavigate} className="mt-6 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[.12em] text-[#e6c69d]">{siteText(home,'footer.cta')} <ArrowUpRight size={16}/></V2Link>
          <div className="mt-7 w-full min-w-0 border-t border-[#594738] pt-5">
            <h3 className="mb-4 text-[10px] font-bold uppercase tracking-[.2em] text-[#d8b586]">Instagram</h3>
            <SocialLinks home={home} showUnconfigured/>
          </div>
        </div>
      </div>
      <nav aria-label="Store policies" className="flex flex-wrap gap-x-6 gap-y-3 border-b border-[#44382c] py-6 text-xs text-[#ddc9ad]">
         <V2Link href="/privacy-policy" onNavigate={onNavigate} className="min-h-11 content-center hover:text-white">Privacy Policy</V2Link>
         <V2Link href="/terms-and-conditions" onNavigate={onNavigate} className="min-h-11 content-center hover:text-white">Terms &amp; Conditions</V2Link>
         <V2Link href="/returns-and-exchanges" onNavigate={onNavigate} className="min-h-11 content-center hover:text-white">Returns &amp; Exchanges</V2Link>
       </nav>
       <div className="flex flex-wrap items-center justify-between gap-4 py-7 text-[10px] font-semibold uppercase tracking-[.15em] text-[#998b7c]">
        <span>© {new Date().getFullYear()} {siteText(home,'footer.brand')}. {siteText(home,'footer.copyright')}</span>
        <span>{siteText(home,'footer.slogan')}</span>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2 border-t border-[#3c332a] py-5 text-xs text-[#b9ad9c]">
        <span>Website by</span>
        <a href="https://alif-growth-media.vercel.app/" target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 font-semibold text-[#f2d4a1] underline-offset-4 hover:underline">
          <img src="https://alif-growth-media.vercel.app/favicon.png" alt="" loading="lazy"
            className="h-7 w-7 rounded-md object-contain"/>Alif Growth Media <ArrowUpRight size={14}/>
        </a>
      </div>
    </div>
  </footer>;
}
