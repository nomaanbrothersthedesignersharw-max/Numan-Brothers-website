import React, { useMemo, useState } from 'react';
import { ArrowRight, ArrowUpRight, Bookmark, Sparkles } from 'lucide-react';
import { optimizedImageUrl, type CmsCategoryRow, type CmsHome } from '../lib/cmsData';
import { siteText } from '../lib/siteContent';
import { type CatalogProduct, productImage, productPath, productsForCollection } from '../storefront/catalog';
import { toggleShortlistItem, useShortlist } from '../storefront/shortlist';
import V2Link from './V2Link';
import V2Reveal from './V2Reveal';

interface Props {
  products: CatalogProduct[];
  home: CmsHome;
  categories?: CmsCategoryRow[];
  onNavigate: (path: string) => void;
}

const CATEGORY_TILES = [
  { path: '/men/sherwani', label: 'Sherwani', eyebrow: 'Ceremonial', fallback: '/editorial/sherwani.svg' },
  { path: '/men/suits/handwork', label: 'Handwork Suits', eyebrow: 'Couture', fallback: '/editorial/jodhpuri.svg' },
  { path: '/men/suits/plain', label: 'Plain Suits', eyebrow: 'Tailored', fallback: '/editorial/jodhpuri.svg' },
  { path: '/men/pathani', label: 'Pathani', eyebrow: 'Festive', fallback: '/editorial/kurta.svg' },
  { path: '/men/jodhpuri', label: 'Jodhpuri', eyebrow: 'Bandhgala', fallback: '/editorial/jodhpuri.svg' },
  { path: '/men/kurta-pyjama', label: 'Kurta Pyjama', eyebrow: 'Heritage', fallback: '/editorial/kurta.svg' },
  { path: '/men/marriage', label: 'Marriage Edit', eyebrow: 'Groom', fallback: '/editorial/sherwani.svg' },
  { path: '/kids', label: 'Kids Wear', eyebrow: 'Junior', fallback: '/editorial/kids.svg' },
] as const;

const SHOWCASE_TABS = [
  { key: 'all', label: 'All Designs' },
  { key: '/men/sherwani', label: 'Sherwani' },
  { key: '/men/suits', label: 'Suits & Blazers' },
  { key: '/men/pathani', label: 'Pathani' },
  { key: '/men/jodhpuri', label: 'Jodhpuri' },
  { key: '/men/kurta-pyjama', label: 'Kurta Pyjama' },
  { key: '/kids', label: 'Kids Wear' },
] as const;

const formatInr = (n: number) =>
  n.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

export default function V2HomeShowcase({ products, home, categories = [], onNavigate }: Props) {
  const [activeTab, setActiveTab] = useState<string>('all');
  const shortlist = useShortlist();

  const tiles = useMemo(() => {
    return CATEGORY_TILES.filter(
      (t) => categories.length === 0 || t.path === '/kids' || categories.some((c) => c.path === t.path),
    ).map((tile) => {
      const catRow = categories.find((c) => c.path === tile.path);
      const firstProd = productsForCollection(products, tile.path)[0];
      const liveImg = firstProd ? productImage(firstProd) : '';
      const img = liveImg || catRow?.image_url || (tile.path === '/kids' ? home.kidsImage : '') || tile.fallback;
      const count = productsForCollection(products, tile.path).length;
      return {
        ...tile,
        label: catRow?.label || tile.label,
        image: img,
        count,
      };
    });
  }, [products, categories, home.kidsImage]);

  const availableTabs = useMemo(() => {
    return SHOWCASE_TABS.filter(
      (tab) => tab.key === 'all' || productsForCollection(products, tab.key).length > 0,
    );
  }, [products]);

  const visibleProducts = useMemo(() => {
    const list = activeTab === 'all' ? products : productsForCollection(products, activeTab);
    return list.slice(0, 8);
  }, [products, activeTab]);

  return (
    <div id="home-storefront-showcase" className="bg-[#fbf8f2]">
      {/* 1. Visual Shop-by-Category Strip */}
      <section
        aria-labelledby="home-categories-title"
        className="mx-auto max-w-[1440px] px-5 pt-14 pb-10 md:px-12 md:pt-20 md:pb-12 lg:px-20"
      >
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.26em] text-[#a37d50]">
              Shop by Category
            </p>
            <h2
              id="home-categories-title"
              className="mt-2 font-serif text-[clamp(1.9rem,3.6vw,3.1rem)] leading-[1.06] tracking-[-.04em] text-[#29221b]"
            >
              Signature Silhouettes
            </h2>
          </div>
          <V2Link
            href="/men"
            onNavigate={onNavigate}
            className="inline-flex min-h-11 items-center gap-2 border-b border-[#b3936b] pb-1 text-[11px] font-bold uppercase tracking-[.14em] text-[#6d502d] transition-colors hover:text-[#29221b]"
          >
            View all collections <ArrowRight size={15} />
          </V2Link>
        </div>

        <div className="flex snap-x snap-mandatory gap-3.5 overflow-x-auto pb-3 md:grid md:grid-cols-4 md:gap-5 md:overflow-visible md:pb-0 xl:grid-cols-8">
          {tiles.map((tile) => (
            <V2Link
              key={tile.path}
              href={tile.path}
              onNavigate={onNavigate}
              className="group w-[42vw] max-w-[185px] shrink-0 snap-start md:w-auto md:max-w-none"
            >
              <div className="relative aspect-[3/4] overflow-hidden border border-[#e3d7c6] bg-[#f4eee3]">
                <img
                  src={tile.image.startsWith('http') ? optimizedImageUrl(tile.image, 420, 80) : tile.image}
                  alt={tile.label}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover object-top transition-transform duration-700 group-hover:scale-[1.06]"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#1a1410]/85 via-[#1a1410]/15 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-3 text-white">
                  <span className="block text-[9px] font-semibold uppercase tracking-[.2em] text-[#ead0a6]">
                    {tile.eyebrow}
                  </span>
                  <span className="mt-0.5 block font-serif text-base leading-snug tracking-[-.01em]">
                    {tile.label}
                  </span>
                </div>
              </div>
            </V2Link>
          ))}
        </div>
      </section>

      {/* 2. Live New Arrivals & Signature Pieces Grid */}
      {products.length > 0 && (
        <section
          aria-labelledby="home-new-arrivals-title"
          className="border-y border-[#e7dccb] bg-[#f6f0e5]/75 px-5 py-16 md:px-12 md:py-22 lg:px-20"
        >
          <div className="mx-auto max-w-[1440px]">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
              <div>
                <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.26em] text-[#9b7444]">
                  <Sparkles size={13} /> New Arrivals &amp; Signature Pieces
                </p>
                <h2
                  id="home-new-arrivals-title"
                  className="mt-2 font-serif text-[clamp(2.1rem,4.4vw,3.8rem)] leading-[1.04] tracking-[-.045em] text-[#282019]"
                >
                  Latest from the Atelier
                </h2>
              </div>
              <V2Link
                href="/men"
                onNavigate={onNavigate}
                className="inline-flex min-h-11 items-center gap-2.5 bg-[#29221b] px-6 text-[11px] font-bold uppercase tracking-[.14em] text-[#f9eedc] transition-colors hover:bg-[#5e462d]"
              >
                Explore full catalogue <ArrowUpRight size={16} />
              </V2Link>
            </div>

            {availableTabs.length > 2 && (
              <div
                role="tablist"
                aria-label="Filter homepage designs by category"
                className="mb-9 flex gap-2 overflow-x-auto pb-2"
              >
                {availableTabs.map((tab) => {
                  const selected = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      onClick={() => setActiveTab(tab.key)}
                      className={
                        'min-h-10 shrink-0 rounded-full border px-5 text-[11px] font-semibold uppercase tracking-[.12em] transition-colors ' +
                        (selected
                          ? 'border-[#29221b] bg-[#29221b] text-[#f9eedc]'
                          : 'border-[#d4c3aa] bg-[#fbf8f2] text-[#5e4e3d] hover:border-[#9e7d52] hover:text-[#29221b]')
                      }
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="nb-responsive-grid grid grid-cols-2 gap-x-3.5 gap-y-8 md:grid-cols-3 md:gap-x-6 md:gap-y-11 lg:grid-cols-4">
              {visibleProducts.map((product, index) => {
                const primaryImg = productImage(product);
                const secondaryImg =
                  Array.isArray(product.images) && product.images.length > 1 ? product.images[1] : '';
                const saved = shortlist.some((item) => item.id === product.id);
                const hasPrice = Boolean(product.originalPrice && product.originalPrice > 0);
                const hasOffer =
                  hasPrice &&
                  product.offerPrice != null &&
                  product.offerPrice < (product.originalPrice || 0);

                return (
                  <V2Reveal key={product.id} delay={Math.min(index % 4, 3) * 0.04}>
                    <article className="group relative flex flex-col">
                      <button
                        type="button"
                        aria-label={saved ? `Remove ${product.title} from shortlist` : `Save ${product.title} to shortlist`}
                        aria-pressed={saved}
                        onClick={() => toggleShortlistItem(product)}
                        className={
                          'absolute right-2.5 top-2.5 z-10 flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur-md transition-colors sm:right-3 sm:top-3 sm:h-10 sm:w-10 ' +
                          (saved
                            ? 'border-[#e5c69d] bg-[#211b17] text-[#f3dfc0]'
                            : 'border-white/60 bg-white/85 text-[#352b20] hover:bg-white')
                        }
                      >
                        <Bookmark size={15} className={saved ? 'fill-current' : ''} />
                      </button>

                      <V2Link href={productPath(product)} onNavigate={onNavigate} className="block">
                        <div className="relative aspect-[3/4] overflow-hidden border border-[#e6dac8] bg-[#f7f3ec]">
                          {primaryImg ? (
                            <>
                              <img
                                src={optimizedImageUrl(primaryImg, 600, 82)}
                                alt={product.title}
                                loading="lazy"
                                decoding="async"
                                className={
                                  'h-full w-full object-cover object-top transition-all duration-700 ' +
                                  (secondaryImg
                                    ? 'group-hover:scale-[1.03] group-hover:opacity-0'
                                    : 'group-hover:scale-[1.05]')
                                }
                              />
                              {secondaryImg && (
                                <img
                                  src={optimizedImageUrl(secondaryImg, 600, 82)}
                                  alt=""
                                  aria-hidden="true"
                                  loading="lazy"
                                  decoding="async"
                                  className="absolute inset-0 h-full w-full object-cover object-top opacity-0 transition-all duration-700 group-hover:scale-[1.03] group-hover:opacity-100"
                                />
                              )}
                            </>
                          ) : (
                            <div className="flex h-full items-center justify-center font-serif text-3xl italic text-[#9a8668]">
                              Nomaan
                            </div>
                          )}

                          {product.customizable && (
                            <span className="absolute left-2.5 top-2.5 rounded-full border border-[#e6cda2]/80 bg-[#211b17]/80 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[.14em] text-[#f6e3c2] backdrop-blur-sm sm:left-3 sm:top-3">
                              Customizable
                            </span>
                          )}

                          <span className="absolute bottom-3 right-3 hidden h-10 w-10 items-center justify-center rounded-full bg-[#f8f3e9]/95 text-[#352b20] opacity-0 shadow-sm transition-all duration-300 group-hover:opacity-100 sm:flex">
                            <ArrowUpRight size={18} />
                          </span>
                        </div>

                        <p className="mt-3.5 text-[9px] font-semibold uppercase tracking-[.18em] text-[#a17e4f]">
                          {product.sku || siteText(home, 'footer.brand')}
                        </p>
                        <h3 className="mt-1 line-clamp-2 font-serif text-[15px] leading-snug text-[#28211a] transition-colors group-hover:text-[#7c5a32] sm:text-lg">
                          {product.title}
                        </h3>
                        {hasPrice && (
                          <div className="mt-1.5 flex flex-wrap items-baseline gap-2">
                            <strong className="text-sm font-semibold text-[#2d2219]">
                              {formatInr(product.offerPrice ?? product.originalPrice!)}
                            </strong>
                            {hasOffer && (
                              <span className="text-xs text-[#8f8275] line-through">
                                {formatInr(product.originalPrice!)}
                              </span>
                            )}
                          </div>
                        )}
                      </V2Link>
                    </article>
                  </V2Reveal>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
