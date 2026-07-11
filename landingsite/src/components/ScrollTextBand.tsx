import { motion, useScroll, useTransform } from 'motion/react';
import { useRef } from 'react';

interface ScrollTextBandProps {
  /** repeated pill text, e.g. "VISION · REASONING · ..." */
  text: string;
  className?: string;
}

/**
 * Scroll-linked horizontal text band. The two rows travel horizontally in
 * opposite directions, driven by the band's own progress through the viewport,
 * so the motion is continuous and substantial the whole time it's on screen.
 */
export default function ScrollTextBand({ text, className = '' }: ScrollTextBandProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  const xLeft = useTransform(scrollYProgress, [0, 1], ['10%', '-45%']);
  const xRight = useTransform(scrollYProgress, [0, 1], ['-45%', '10%']);

  const words = `${text}${text}${text}${text}`;

  return (
    <div
      ref={ref}
      className={`relative select-none overflow-hidden py-4 ${className}`}
      aria-hidden="true"
    >
      <motion.div style={{ x: xLeft }} className="flex whitespace-nowrap will-change-transform">
        <span className="text-gradient bg-clip-text font-sans text-[13vw] font-extrabold leading-none tracking-tight sm:text-[9vw] md:text-[7vw]">
          {words}
        </span>
      </motion.div>
      <motion.div style={{ x: xRight }} className="mt-1 flex whitespace-nowrap will-change-transform">
        <span
          className="font-sans text-[13vw] font-extrabold leading-none tracking-tight text-transparent sm:text-[9vw] md:text-[7vw]"
          style={{ WebkitTextStroke: '1px rgba(168,85,247,0.28)' }}
        >
          {words}
        </span>
      </motion.div>
    </div>
  );
}
