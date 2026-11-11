import React from 'react';

function Block({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={'nb-skeleton ' + className}/>;
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return <div className="nb-responsive-grid grid grid-cols-1 gap-x-4 gap-y-9 min-[360px]:grid-cols-2 md:grid-cols-3 md:gap-x-6 md:gap-y-12 lg:grid-cols-4"
    role="status" aria-busy="true" aria-label="Loading product cards">
    <span className="sr-only">Loading published products…</span>
    {Array.from({ length: Math.max(1, Math.min(12, count)) }, (_, index) => (
      <div key={index} className="min-w-0">
        <Block className="aspect-[3/4] w-full"/>
        <Block className="mt-4 h-2.5 w-20"/>
        <Block className="mt-3 h-5 w-4/5"/>
        <Block className="mt-2 h-3.5 w-2/5"/>
        <Block className="mt-4 h-3 w-24"/>
      </div>
    ))}
  </div>;
}

export function CollectionPageSkeleton() {
  return <div className="min-h-[70vh] bg-[#fbf8f2] pb-24" role="status" aria-busy="true" aria-label="Loading collection">
    <span className="sr-only">Loading collection and published garments…</span>
    <section className="bg-[#2b241e] px-5 py-20 md:px-12 md:py-28 lg:px-20">
      <div className="mx-auto max-w-[1330px]">
        <Block className="h-3 w-36 nb-skeleton--dark"/>
        <Block className="mt-12 h-3 w-28 nb-skeleton--dark"/>
        <Block className="mt-6 h-16 max-w-2xl sm:h-24 nb-skeleton--dark"/>
        <Block className="mt-7 h-3 w-full max-w-lg nb-skeleton--dark"/>
        <Block className="mt-3 h-3 w-2/3 max-w-sm nb-skeleton--dark"/>
      </div>
    </section>
    <div className="mx-auto max-w-[1440px] px-5 pt-12 md:px-12 lg:px-20">
      <div className="mb-14 flex flex-wrap gap-2">
        {Array.from({ length: 5 }, (_, index) => <Block key={index} className="h-11 w-28"/>)}
      </div>
      <div className="mb-9 flex items-end justify-between gap-5 border-b border-[#e2d7c8] pb-5">
        <Block className="h-9 w-52"/>
        <Block className="h-3 w-20"/>
      </div>
      <ProductGridSkeleton count={8}/>
    </div>
  </div>;
}

export function ProductDetailSkeleton() {
  return <div className="min-h-[72vh] bg-[#2b241e] px-5 pb-20 pt-8 md:px-12 md:pt-12 lg:px-20"
    role="status" aria-busy="true" aria-label="Loading product details">
    <span className="sr-only">Loading product details…</span>
    <div className="mx-auto max-w-[1400px]">
      <Block className="mb-10 h-3 w-64 nb-skeleton--dark"/>
      <div className="nb-responsive-grid grid items-start gap-9 lg:grid-cols-[minmax(0,1.04fr)_minmax(0,.96fr)] lg:gap-12 xl:gap-20">
        <div className="mx-auto w-full max-w-[700px]">
          <Block className="aspect-[3/4] w-full nb-skeleton--dark"/>
          <div className="mt-4 flex gap-3">
            {Array.from({ length: 4 }, (_, index) => <Block key={index} className="h-20 w-[68px] shrink-0 nb-skeleton--dark"/>)}
          </div>
        </div>
        <div className="border border-white/30 bg-[#fcf8f0] px-5 py-9 sm:px-9 sm:py-12">
          <Block className="h-3 w-28"/>
          <Block className="mt-8 h-14 w-4/5"/>
          <Block className="mt-4 h-3 w-2/3"/>
          <Block className="mt-9 h-3 w-32"/>
          <Block className="mt-7 h-24 w-full"/>
          <Block className="mt-8 h-3 w-24"/>
          <div className="mt-4 flex gap-2">
            {Array.from({ length: 4 }, (_, index) => <Block key={index} className="h-11 w-12"/>)}
          </div>
          <Block className="mt-9 h-14 w-full"/>
          <Block className="mt-3 h-12 w-full"/>
        </div>
      </div>
    </div>
  </div>;
}
