import React,{useCallback,useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowUpRight} from 'lucide-react';

export const INTRO_DURATION_MS=5000;
export const INTRO_EXIT_MS=900;
// A visitor returning from a collection to Home in the same SPA load should not
// be forced through the introduction again. A fresh page load may replay it.
let shownThisPage=false;
type Phase='playing'|'leaving'|'finished';
interface Props {
  url?:string;
  poster:string;
  reducedMotion:boolean;
  replay?:boolean;
  onComplete:()=>void;
}
type ConnectionWithSaveData=Navigator&{connection?:{saveData?:boolean}};

const INTRO_SESSION_KEY = 'nb_intro_seen';
const wasSeenInSession = (): boolean => {
  try { return typeof window !== 'undefined' && window.sessionStorage?.getItem(INTRO_SESSION_KEY) === '1'; }
  catch { return false; }
};

export default function HeroBrandIntro({url,poster,reducedMotion,replay=false,onComplete}:Props){
  const [phase,setPhase]=useState<Phase>(()=>(shownThisPage||wasSeenInSession())&&!replay?'finished':'playing');
  const [videoReady,setVideoReady]=useState(false);
  const [videoFailed,setVideoFailed]=useState(false);
  const videoRef=useRef<HTMLVideoElement>(null);
  const skipRef=useRef<HTMLButtonElement>(null);
  const wasSkipped=useRef(false);
  const beginExit=useCallback(()=>{
    setPhase(current=>current==='playing'?'leaving':current);
  },[]);

  useEffect(()=>{
    if(phase!=='playing')return;
    shownThisPage=true;
    try{window.sessionStorage?.setItem(INTRO_SESSION_KEY,'1');}catch{/**/}
    const dataSaver=(navigator as ConnectionWithSaveData).connection?.saveData===true;
    if(reducedMotion||dataSaver){setPhase('finished');return;}
    const timer=window.setTimeout(beginExit,INTRO_DURATION_MS);
    const onScroll=()=>{if(window.scrollY>120)beginExit();};
    const onEscape=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){wasSkipped.current=true;beginExit();}
    };
    const onTab=(event:KeyboardEvent)=>{
      if(event.key==='Tab'){event.preventDefault();skipRef.current?.focus({preventScroll:true});}
    };
    skipRef.current?.focus({preventScroll:true});
    window.addEventListener('keydown',onTab);
    window.addEventListener('scroll',onScroll,{passive:true});
    window.addEventListener('keydown',onEscape);
    // If a user arrives at a scrolled position, never conceal the hero.
    onScroll();
    return()=>{
      window.clearTimeout(timer);
      window.removeEventListener('scroll',onScroll);
      window.removeEventListener('keydown',onTab);
      window.removeEventListener('keydown',onEscape);
    };
  },[phase,reducedMotion,beginExit]);

  useEffect(()=>{
    if(phase!=='playing'||!url||reducedMotion)return;
    const video=videoRef.current;
    if(!video)return;
    const promise=video.play();
    if(promise)void promise.catch(()=>setVideoFailed(true));
  },[phase,url,reducedMotion]);

  useEffect(()=>{
    if(phase!=='leaving')return;
    // Animation-end plus a timer fallback for background tabs and old browsers.
    const timer=window.setTimeout(()=>setPhase('finished'),INTRO_EXIT_MS+100);
    return()=>window.clearTimeout(timer);
  },[phase]);

  useEffect(()=>{
    if(phase!=='finished')return;
    videoRef.current?.pause();
    onComplete();
    if(wasSkipped.current||document.activeElement===skipRef.current){
      // The parent removes inert on the next React commit; focus after it.
      window.requestAnimationFrame(()=>{
        document.getElementById('v2-home-title')?.focus({preventScroll:true});
      });
    }
  },[phase,onComplete]);

  if(phase==='finished'||reducedMotion)return null;
  const skip=()=>{wasSkipped.current=true;beginExit();};
  return <div
    data-testid="brand-intro"
    data-phase={phase}
    role="dialog" aria-modal="true"
    aria-label="Nomaan Brothers opening introduction"
    onClick={skip}
    className={'nb-brand-intro fixed inset-0 z-[90] cursor-pointer overflow-hidden bg-[#16110e] text-[#f8ead5] '+
      (phase==='leaving'?'nb-brand-intro--leaving':'')}
    onTransitionEnd={event=>{
      if(event.target===event.currentTarget&&phase==='leaving')setPhase('finished');
    }}
  >
    <div className="absolute inset-0 bg-[linear-gradient(145deg,#38271b,#130d0a_65%)]"/>
    <img src={poster} alt="" aria-hidden="true" fetchPriority="high" decoding="async"
      className="nb-intro-poster absolute inset-0 h-full w-full object-cover object-[50%_35%] opacity-80 sm:object-center"/>
    {url&&!videoFailed&&<video key={url} ref={videoRef} src={url}
      autoPlay muted loop playsInline preload="auto" poster={poster}
      aria-hidden="true" tabIndex={-1}
      onLoadedData={()=>setVideoReady(true)}
      onError={()=>setVideoFailed(true)}
      className={'absolute inset-0 h-full w-full object-cover object-[50%_35%] transition-opacity duration-500 sm:object-center '+
        (videoReady?'opacity-100':'opacity-0')}/>}
    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#120e0c]/90 via-[#120e0c]/15 to-[#120e0c]/50"/>
    <div className="pointer-events-none absolute inset-0 border-[11px] border-[#f1dfc2]/[.07] sm:border-[22px]"/>
    <div className="absolute inset-x-0 top-0 flex min-w-0 flex-wrap items-start justify-between gap-3 px-4 pb-6 pt-[calc(1.25rem+env(safe-area-inset-top))] sm:px-10 sm:pt-8 lg:px-16">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[.22em] text-[#f0d2a2] sm:tracking-[.35em]">Nomaan Brothers</p>
        <p className="mt-2 text-[9px] uppercase tracking-[.14em] text-[#ead8bc]/75">Mandi Bazar · Warangal</p>
      </div>
      <button ref={skipRef} type="button" onClick={skip}
        aria-label="Skip brand introduction"
        className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full border border-white/60 bg-black/35 px-4 text-[11px] font-bold uppercase tracking-[.12em] text-white backdrop-blur-md transition-colors hover:bg-[#f7e7cd] hover:text-[#21170f] focus-visible:outline-white">
        Skip intro <ArrowUpRight size={16} aria-hidden="true"/>
      </button>
    </div>
    <div className="absolute inset-x-0 bottom-[calc(3rem+env(safe-area-inset-bottom))] px-5 sm:bottom-16 sm:px-10 lg:px-16">
      <div className="max-w-[850px]">
        <p className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.24em] text-[#efd0a6]">
          <span className="h-px w-8 bg-[#efd0a6]"/> A heritage of celebration
        </p>
        <p className="max-w-[18ch] font-serif text-[clamp(2.3rem,8.6vw,6.6rem)] leading-[.99] tracking-[-.065em] text-[#fff4e0] drop-shadow-lg">
          Every occasion has a story.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-4 text-[10px] font-medium uppercase tracking-[.17em] text-[#f9e8cc]">
          <span>{url?'Brand film':'Editorial preview'}</span>
          <ArrowLeft size={17} aria-hidden="true"/>
          <span>Revealing the collection</span>
        </div>
        <div className="mt-5 h-[2px] w-full max-w-[390px] overflow-hidden bg-white/25" aria-hidden="true">
          <div className="nb-brand-intro__progress h-full origin-left bg-[#f4dab0]"/>
        </div>
      </div>
    </div>
  </div>;
}
