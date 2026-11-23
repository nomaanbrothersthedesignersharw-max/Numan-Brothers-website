import React, { useState } from 'react';
import { Bookmark, Copy, MessageCircle, Trash2, X } from 'lucide-react';
import { productPath } from '../storefront/catalog';
import { clearShortlist, removeShortlistItem, shortlistWhatsAppMessage, useShortlist } from '../storefront/shortlist';
import { whatsappContact } from '../lib/contactLinks';
import V2Link from './V2Link';

interface Props {
  whatsappNumber?: string;
  onNavigate: (path: string) => void;
}

export default function ShortlistDrawer({ whatsappNumber, onNavigate }: Props) {
  const items = useShortlist();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (items.length === 0 && !open) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const message = shortlistWhatsAppMessage(items, origin);
  const waUrl = whatsappContact(whatsappNumber, message);

  const copyLinks = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <>
      {items.length > 0 && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Open showroom shortlist (${items.length} saved)`}
          className="fixed bottom-[calc(.9rem+env(safe-area-inset-bottom))] right-[calc(.75rem+env(safe-area-inset-right))] z-40 inline-flex min-h-12 items-center gap-2 rounded-full border border-[#e5c69d] bg-[#211b17] px-4 text-xs font-semibold text-[#fbf3e6] shadow-[0_12px_30px_rgba(0,0,0,.28)] transition-transform hover:-translate-y-0.5 [@media(max-height:460px)]:hidden sm:bottom-6 sm:right-6"
        >
          <Bookmark size={16} className="fill-[#e5c69d] text-[#e5c69d]" />
          <span>Shortlist ({items.length})</span>
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[85] flex justify-end bg-black/55 backdrop-blur-xs" role="dialog" aria-modal="true" aria-label="Showroom Shortlist">
          <button type="button" aria-label="Close shortlist" className="flex-1 cursor-default" onClick={() => setOpen(false)} />
          <div className="flex h-full w-[min(92vw,420px)] flex-col bg-[#fbf8f2] text-[#29221c] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#e5d8c5] px-5 py-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.22em] text-[#9c784c]">Showroom Shortlist</p>
                <h2 className="font-serif text-2xl">{items.length} Saved {items.length === 1 ? 'Style' : 'Styles'}</h2>
              </div>
              <button type="button" aria-label="Close shortlist" onClick={() => setOpen(false)} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-[#efe6d8]">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-5">
              {items.length === 0 ? (
                <p className="py-12 text-center text-sm text-[#766a5c]">Your shortlist is empty. Tap the bookmark icon on any garment to save it for a showroom enquiry.</p>
              ) : (
                items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 rounded-lg border border-[#e3d6c3] bg-white p-3">
                    {item.image ? (
                      <img src={item.image} alt={item.title} className="h-20 w-16 shrink-0 rounded object-cover object-top" />
                    ) : (
                      <div className="flex h-20 w-16 shrink-0 items-center justify-center rounded bg-[#efe6d8] font-serif text-xs text-[#7c664a]">NB</div>
                    )}
                    <div className="min-w-0 flex-1">
                      <V2Link
                        href={productPath(item)}
                        onNavigate={(path) => { setOpen(false); onNavigate(path); }}
                        className="line-clamp-2 font-serif text-base font-medium text-[#29221c] hover:underline"
                      >
                        {item.title}
                      </V2Link>
                      {item.sku && <p className="mt-0.5 text-[11px] text-[#8a755c]">SKU · {item.sku}</p>}
                      {item.price && item.price > 0 ? (
                        <p className="mt-1 text-xs font-semibold text-[#5b452d]">
                          {item.price.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      aria-label={`Remove ${item.title} from shortlist`}
                      onClick={() => removeShortlistItem(item.id)}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#7c6c5a] hover:bg-[#f5ece0] hover:text-red-700"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {items.length > 0 && (
              <div className="space-y-2.5 border-t border-[#e5d8c5] bg-[#f4ece0] p-5">
                {waUrl ? (
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#197848] px-5 text-xs font-bold uppercase tracking-[.1em] text-white hover:bg-[#116238]"
                  >
                    <MessageCircle size={17} /> Enquire All on WhatsApp
                  </a>
                ) : (
                  <V2Link
                    href="/contact"
                    onNavigate={(p) => { setOpen(false); onNavigate(p); }}
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#2c231c] px-5 text-xs font-bold uppercase tracking-[.1em] text-white"
                  >
                    Visit Showroom to Enquire
                  </V2Link>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void copyLinks()}
                    className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full border border-[#bda788] bg-white px-4 text-xs font-semibold text-[#533f29] hover:bg-[#faf5ec]"
                  >
                    <Copy size={15} /> {copied ? 'Copied!' : 'Copy List'}
                  </button>
                  <button
                    type="button"
                    onClick={() => clearShortlist()}
                    className="min-h-11 rounded-full border border-[#d6c5ad] px-4 text-xs font-semibold text-[#756450] hover:bg-white"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
