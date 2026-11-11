import React from 'react';
import {isValidSocialProfile} from '../lib/cmsData';
import type {CmsHome} from '../lib/cmsData';

interface Props {
  home?: CmsHome;
  variant?: 'dark' | 'light';
  showUnconfigured?: boolean;
}

/** One platform, one asset, one verified owner-supplied profile URL. */
export default function SocialLinks({home,variant='dark',showUnconfigured=false}:Props) {
  const url=home?.socialLinks?.instagram?.trim() || '';
  const enabled=isValidSocialProfile('instagram',url);
  if(!enabled && !showUnconfigured)return null;

  const dark=variant==='dark';
  const base='box-border inline-flex size-12 aspect-square max-w-full shrink-0 items-center justify-center rounded-full border transition-[color,background-color,border-color,transform] duration-200 sm:size-14';
  const active=dark
    ? 'border-[#987d5f] bg-[#3a2f26] text-[#f3e4cb] hover:-translate-y-0.5 hover:border-[#e1c292] hover:bg-[#604832] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#f2d4a1]'
    : 'border-[#ac9273] bg-white text-[#533d26] hover:-translate-y-0.5 hover:bg-[#e7d8c1] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#926837]';
  const pending=dark
    ? 'cursor-default border-[#655443] bg-[#2a231d] text-[#907f6c] opacity-75'
    : 'cursor-default border-[#d9cab4] bg-[#f3eee5] text-[#aa9a88] opacity-75';
  const icon=<img src="/social/instagram.svg" alt="" aria-hidden="true"
    loading="lazy" decoding="async"
    className={'block h-6 w-6 shrink-0 object-contain sm:h-7 sm:w-7 '+(dark?'brightness-0 invert':'brightness-0')}/>;

  return <nav className="flex w-full min-w-0 max-w-full flex-wrap items-center gap-3"
    data-testid="social-profile-icons"
    aria-label="Nomaan Brothers social media channels">
    {enabled
      ? <a href={url} target="_blank" rel="noopener noreferrer"
          aria-label="Visit Nomaan Brothers on Instagram"
          title="Official Instagram profile" data-testid="social-instagram-link"
          className={base+' '+active}>{icon}</a>
      : <span role="img" aria-label="Instagram profile not connected yet"
          title="Official Instagram profile not yet connected" data-testid="social-instagram-pending"
          className={base+' '+pending}>{icon}</span>}
  </nav>;
}
