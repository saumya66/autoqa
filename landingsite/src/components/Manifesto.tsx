import { motion } from 'motion/react';
import Eyebrow from './Eyebrow';
import ScrollTextBand from './ScrollTextBand';

interface IconProps {
  className?: string;
}

const svg = (p: IconProps) => ({
  className: p.className,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  viewBox: '0 0 24 24',
});

const LayersIcon = (p: IconProps) => (
  <svg {...svg(p)}>
    <path d="m12 3 9 5-9 5-9-5 9-5Z" />
    <path d="m3 13 9 5 9-5M3 18l9 5 9-5" opacity={0.6} />
  </svg>
);
const LoopIcon = (p: IconProps) => (
  <svg {...svg(p)}>
    <path d="M21 12a9 9 0 1 1-3-6.7" />
    <path d="M21 3v5h-5" />
  </svg>
);
const HumanIcon = (p: IconProps) => (
  <svg {...svg(p)}>
    <circle cx="12" cy="8" r="3.2" />
    <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
  </svg>
);
const BrainIcon = (p: IconProps) => (
  <svg {...svg(p)}>
    <path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-1 5 3 3 0 0 0 2 5 3 3 0 0 0 3 2V4Z" />
    <path d="M15 4a3 3 0 0 1 3 3 3 3 0 0 1 1 5 3 3 0 0 1-2 5 3 3 0 0 1-3 2V4Z" opacity={0.6} />
  </svg>
);

const BLOCKS = [
  { label: 'Multiple Agents', Icon: LayersIcon, pos: 'left-[5%] top-[24%]', dur: 7 },
  { label: 'Agentic Loops', Icon: LoopIcon, pos: 'right-[6%] top-[18%]', dur: 8.5 },
  { label: 'Human In The Loop', Icon: HumanIcon, pos: 'left-[7%] top-[62%]', dur: 9 },
  { label: 'Vision + LLMs', Icon: BrainIcon, pos: 'right-[5%] top-[68%]', dur: 7.5 },
];

export default function Manifesto() {
  return (
    <section id="solution" className="relative overflow-hidden py-28 sm:py-36">
      {/* starfield + glow */}
      <div className="pointer-events-none absolute inset-0 bg-dots opacity-40" aria-hidden="true" />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 60% 55% at 50% 45%, rgba(124,58,237,0.14), transparent 70%)' }}
        aria-hidden="true"
      />

      {/* Content + floating building blocks (scoped so pills stay around the text) */}
      <div className="relative">
      {/* Building blocks — floating around the content on large screens */}
      <div className="pointer-events-none absolute inset-0 z-10 hidden lg:block">
        {BLOCKS.map((b, i) => {
          const Icon = b.Icon;
          return (
            <motion.div
              key={b.label}
              className={`absolute ${b.pos} inline-flex items-center gap-2.5 rounded-full border border-violet-400/20 bg-violet-500/[0.06] px-4 py-2.5 backdrop-blur-sm`}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1, y: [0, -12, 0] }}
              viewport={{ once: true }}
              transition={{
                opacity: { duration: 0.6, delay: 0.3 + i * 0.12 },
                scale: { duration: 0.6, delay: 0.3 + i * 0.12 },
                y: { duration: b.dur, repeat: Infinity, ease: 'easeInOut' },
              }}
            >
              <Icon className="h-4 w-4 text-violet-300" />
              <span className="text-sm font-semibold text-white/85">{b.label}</span>
            </motion.div>
          );
        })}
      </div>

      <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '0px 0px -20% 0px' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="flex justify-center"
        >
          <Eyebrow>BUILT FROM FIRST PRINCIPLES</Eyebrow>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, filter: 'blur(8px)', y: 16 }}
          whileInView={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
          viewport={{ once: true, margin: '0px 0px -20% 0px' }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto mt-6 max-w-3xl text-[clamp(1.8rem,4.2vw,3rem)] font-extrabold leading-[1.1] tracking-tight text-white"
        >
          We didn&apos;t automate the old way of testing.{' '}
          <span className="text-gradient">We reimagined it.</span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '0px 0px -20% 0px' }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/55 sm:text-xl"
        >
          We started from one question: how does a great QA engineer actually test? They never read
          your code. They open the app, explore like a real user, notice when something feels off,
          and ask when they&apos;re unsure. So we rebuilt testing around that — not scripts, not
          selectors, not even code.
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '0px 0px -20% 0px' }}
          transition={{ duration: 0.8, delay: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto mt-12 max-w-2xl text-[clamp(1.4rem,3vw,2.1rem)] font-bold leading-tight tracking-tight text-white"
        >
          The old way of testing is over.{' '}
          <span className="text-gradient">This is what it was always meant to be.</span>
        </motion.p>
      </div>
      </div>

      <div className="relative z-10 mt-16">
        <ScrollTextBand text="Presenting Clariti · Autonomous QA Agent · " />
      </div>
    </section>
  );
}
