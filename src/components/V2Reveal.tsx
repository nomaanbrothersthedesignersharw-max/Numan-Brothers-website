import React, { useEffect, useRef, useState } from 'react';

export default function V2Reveal({
  children,
  className = '',
  delay = 0,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      setVisible(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.06, rootMargin: '0px 0px -24px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const transitionDelay = `${Math.min(Math.max(delay, 0), 0.16)}s`;

  return (
    <div
      ref={ref}
      className={className}
      style={{
        ...style,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translate3d(0, 0, 0)' : 'translate3d(0, 12px, 0)',
        transition: `opacity 420ms cubic-bezier(0.22, 1, 0.36, 1) ${transitionDelay}, transform 420ms cubic-bezier(0.22, 1, 0.36, 1) ${transitionDelay}`,
      }}
    >
      {children}
    </div>
  );
}
