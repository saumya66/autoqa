import { motion, useScroll, useTransform } from 'motion/react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

interface HorizontalScrollSectionProps {
  children: ReactNode;
  /** height of the scroll track in vh; larger = slower horizontal travel */
  trackVh?: number;
  className?: string;
  /** stack vertically below this width (px) */
  mobileBreakpoint?: number;
  /** optional content pinned above the track while it scrolls horizontally */
  header?: ReactNode;
}

/** Height of the fixed nav so pinned content clears it. */
const NAV_OFFSET = 88;

/**
 * Sticky pinned horizontal scroll: a tall outer container pins an inner viewport
 * and translates its track along X as you scroll vertically. The translate is
 * measured from the real track/viewport widths, so the scroll always ends with
 * the last item fully in view. Falls back to a normal vertical stack on small
 * screens / reduced motion.
 */
export default function HorizontalScrollSection({
  children,
  trackVh = 300,
  className = '',
  mobileBreakpoint = 768,
  header,
}: HorizontalScrollSectionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(true);
  const [maxX, setMaxX] = useState(0);

  useEffect(() => {
    const mqReduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const check = () =>
      setPinned(window.innerWidth >= mobileBreakpoint && !mqReduced.matches);
    check();
    window.addEventListener('resize', check);
    mqReduced.addEventListener?.('change', check);
    return () => {
      window.removeEventListener('resize', check);
      mqReduced.removeEventListener?.('change', check);
    };
  }, [mobileBreakpoint]);

  useLayoutEffect(() => {
    if (!pinned) return;
    const measure = () => {
      const track = trackRef.current;
      if (!track) return;
      const first = track.firstElementChild as HTMLElement | null;
      const last = track.lastElementChild as HTMLElement | null;
      if (!first || !last) return;
      // Scroll until the last card's left edge aligns with the first card's left edge
      const distance = last.offsetLeft - first.offsetLeft;
      setMaxX(Math.max(0, distance));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [pinned, children]);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });
  const x = useTransform(scrollYProgress, [0, 1], [0, -maxX]);

  if (!pinned) {
    return (
      <div className={`flex flex-col gap-12 ${className}`}>
        {header}
        {children}
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ height: `${trackVh}vh` }} className={className}>
      <div
        ref={viewportRef}
        className="sticky top-0 flex h-[100dvh] flex-col justify-center overflow-hidden"
        style={{ paddingTop: NAV_OFFSET }}
      >
        {header ? <div className="shrink-0">{header}</div> : null}
        <motion.div
          ref={trackRef}
          style={{ x }}
          className="flex gap-32 pl-[max(1.5rem,calc((100vw-72rem)/2))] pr-32 will-change-transform"
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}
