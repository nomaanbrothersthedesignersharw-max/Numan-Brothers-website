import React from 'react';
import { prefetchRoute } from '../lib/prefetch';

type Props = Omit<React.ComponentProps<'a'>, 'href'> & {
  href: string;
  onNavigate: (path: string) => void;
};

/** Real href is retained for SEO, copy-link and opening in a new tab. */
export default function V2Link({
  href,
  onNavigate,
  onClick,
  onMouseEnter,
  onTouchStart,
  onFocus,
  children,
  ...rest
}: Props) {
  const handlePrefetch = () => {
    prefetchRoute(href);
  };

  const click = (event: React.MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey ||
        event.shiftKey || event.altKey || rest.target === '_blank') return;
    if (!href.startsWith('/') || href.startsWith('//')) return;
    event.preventDefault();
    onNavigate(href);
  };

  return (
    <a
      href={href}
      onClick={click}
      onMouseEnter={(e) => {
        onMouseEnter?.(e);
        handlePrefetch();
      }}
      onTouchStart={(e) => {
        onTouchStart?.(e);
        handlePrefetch();
      }}
      onFocus={(e) => {
        onFocus?.(e);
        handlePrefetch();
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
