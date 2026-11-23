import {useEffect,useState} from 'react';
import {MessageCircle,Phone,ArrowUpRight,MapPin} from 'lucide-react';
import type {CatalogProduct} from '../storefront/catalog';
import type {CmsHome} from '../lib/cmsData';
import {callingContact,whatsappContact} from '../lib/contactLinks';

interface Props {home:CmsHome;path:string;product?:CatalogProduct|null;}

/**
 * Appears only once the current hero is behind the reader. A useful showroom
 * contact link is always available even before the owner publishes approved
 * phone numbers. Passive scroll listeners avoid unnecessary React updates.
 */
export default function FloatingContactDock({home,path,product}:Props){
  const [visible,setVisible]=useState(false);
  useEffect(()=>{
    let frame=0;
    const measure=()=>{
      frame=0;
      const hero=document.querySelector<HTMLElement>('[data-nb-contact-hero]');
      const cutoff=hero
        ? window.scrollY+hero.getBoundingClientRect().bottom
        : Math.max(280,Math.min(520,window.innerHeight*.65));
      const footer=document.querySelector('footer');
      const footerIsVisible=Boolean(footer&&footer.getBoundingClientRect().top<window.innerHeight-24);
      setVisible(window.scrollY>=cutoff-60&&!footerIsVisible);
    };
    const schedule=()=>{
      if(!frame)frame=window.requestAnimationFrame(measure);
    };
    setVisible(false);
    schedule();
    window.addEventListener('scroll',schedule,{passive:true});
    window.addEventListener('resize',schedule);
    return ()=>{
      window.removeEventListener('scroll',schedule);
      window.removeEventListener('resize',schedule);
      if(frame)window.cancelAnimationFrame(frame);
    };
  },[path,product?.id]);

  const context=product
    ? 'Hello Nomaan Brothers, I would like to enquire about '+product.title+
      ' (SKU '+(product.sku||product.id)+').'
    : 'Hello Nomaan Brothers, I would like to enquire about your menswear and kidswear collections.';
  const whatsapp=whatsappContact(home.contactWhatsapp,context);
  const calling=callingContact(home.contactPhone);
  // Never show a broken WhatsApp or tel: link. If neither phone number has
  // been approved in Studio, keep the dock visible with a working showroom
  // destination instead of silently rendering nothing.
  const fallback=!whatsapp&&!calling;
  const fallbackHref=path==='/contact'
    ? 'https://www.google.com/maps/search/?api=1&query=Nomaan+Brothers+Dresses+Mandi+Bazar+Warangal'
    : '/contact';
  if(!visible)return null;

  return <aside data-testid="floating-contact-dock" aria-label="Contact Nomaan Brothers"
    className="fixed bottom-[calc(.9rem+env(safe-area-inset-bottom))] left-[calc(.75rem+env(safe-area-inset-left))] z-40 flex max-w-[calc(100vw-1.5rem)] items-center gap-2 [@media(max-height:460px)]:hidden sm:bottom-6 sm:left-[calc(1.5rem+env(safe-area-inset-left))]"
    role="complementary">
    {fallback&&<a href={fallbackHref}
      aria-label={path==='/contact'?'Find Nomaan Brothers showroom directions':'Contact Nomaan Brothers showroom'}
      title={path==='/contact'?'Get directions':'Contact the showroom'}
      {...(path==='/contact'?{target:'_blank',rel:'noopener noreferrer'}:{})}
      className="group inline-flex min-h-13 min-w-13 items-center justify-center gap-2.5 rounded-full border border-[#e8d4b7] bg-[#2c231c] px-3.5 text-[#f6e8d5] shadow-[0_12px_30px_rgba(0,0,0,.23)] ring-1 ring-black/20 transition-[transform,background-color,box-shadow] duration-200 hover:-translate-y-1 hover:bg-[#493626] focus-visible:outline-offset-4 motion-reduce:transform-none sm:px-4">
      <MapPin size={21} strokeWidth={1.8} aria-hidden="true"/>
      <span className="text-xs font-semibold tracking-wide">{path==='/contact'?'Directions':'Contact showroom'}</span>
      <ArrowUpRight size={13} className="opacity-70" aria-hidden="true"/>
    </a>}
    {whatsapp&&<a href={whatsapp} target="_blank" rel="noopener noreferrer"
      aria-label={product?'WhatsApp about '+product.title:'Chat with Nomaan Brothers on WhatsApp'}
      title="WhatsApp us"
      className="group inline-flex min-h-13 min-w-13 items-center justify-center gap-2.5 rounded-full border border-white/30 bg-[#197848] px-3 text-white shadow-[0_12px_30px_rgba(0,0,0,.23)] ring-1 ring-[#14633c]/30 transition-[transform,background-color,box-shadow] duration-200 hover:-translate-y-1 hover:bg-[#116238] hover:shadow-[0_16px_36px_rgba(0,0,0,.25)] focus-visible:outline-offset-4 motion-reduce:transform-none sm:px-4">
      <MessageCircle size={23} strokeWidth={1.8}/>
      <span className="hidden text-xs font-semibold tracking-wide sm:inline">WhatsApp</span>
      <ArrowUpRight size={13} className="hidden opacity-70 sm:block" aria-hidden="true"/>
    </a>}
    {calling&&<a href={calling} aria-label="Call Nomaan Brothers" title="Call us"
      className="group inline-flex min-h-13 min-w-13 items-center justify-center gap-2.5 rounded-full border border-[#e8d4b7] bg-[#2c231c] px-3 text-[#f6e8d5] shadow-[0_12px_30px_rgba(0,0,0,.23)] ring-1 ring-black/20 transition-[transform,background-color,box-shadow] duration-200 hover:-translate-y-1 hover:bg-[#493626] hover:shadow-[0_16px_36px_rgba(0,0,0,.25)] focus-visible:outline-offset-4 motion-reduce:transform-none sm:px-4">
      <Phone size={21} strokeWidth={1.8}/>
      <span className="hidden text-xs font-semibold tracking-wide sm:inline">Call now</span>
    </a>}
  </aside>;
}
