import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import Eyebrow from './Eyebrow';
import Reveal from './Reveal';
import { ArrowRight, EarIcon, EyeIcon, MemoryIcon, SparkIcon } from './Icons';

const NODES = [
  { key: 'SEE', Icon: EyeIcon, desc: 'Looks at the screen like a user.' },
  { key: 'THINK', Icon: SparkIcon, desc: 'Decides what to do next.' },
  { key: 'ACT', Icon: ArrowRight, desc: 'Clicks, types, moves through the app.' },
  { key: 'LISTEN', Icon: EarIcon, desc: 'Listens for your inputs.' },
  { key: 'LEARN', Icon: MemoryIcon, desc: 'Learns from every run.' },
];

const SIZE = 460;
const R = 168;
const CENTER = SIZE / 2;

// node positions around a circle, starting at top
const positions = NODES.map((_, i) => {
  const angle = (-90 + i * (360 / NODES.length)) * (Math.PI / 180);
  return { x: CENTER + R * Math.cos(angle), y: CENTER + R * Math.sin(angle) };
});

export default function AgenticLoop() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const id = setInterval(() => setActive((a) => (a + 1) % NODES.length), 1500);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="relative mx-auto max-w-6xl overflow-hidden px-6 py-20 sm:py-28 lg:py-36">
      <div className="text-center">
        <Reveal className="flex justify-center">
          <Eyebrow>UNDER THE HOOD.</Eyebrow>
        </Reveal>
        <Reveal delay={0.05}>
          <h2 className="mx-auto mt-5 max-w-2xl text-[clamp(2rem,4.5vw,3.25rem)] font-extrabold leading-[1.05] tracking-tight text-white">
            Clariti puts <span className="text-gradient">multiple agents</span> to work.
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-white/55 sm:text-lg">
            Under the hood, Clariti runs a tight loop — it looks at the screen, decides what to do,
            acts, listens for your inputs, and learns from every run. The same loop your QA runs
            in their head, now running on its own.
          </p>
        </Reveal>
      </div>

      {/* Circular diagram — shown on all screens, scaled down on mobile.
          Use absolute + left-1/2 -translate-x-1/2 so the VISUAL centre aligns
          with the viewport centre even when the layout box (460px) exceeds the
          mobile width. Wrapper height matches the scaled visual height. */}
      <div className="relative mt-12 h-[276px] sm:h-[368px] md:h-[460px] overflow-hidden">
        <div
          style={{ width: SIZE, height: SIZE }}
          className="absolute left-1/2 top-0 -translate-x-1/2 origin-top scale-[0.6] sm:scale-[0.8] md:scale-100"
        >
          {/* ring */}
          <svg className="absolute inset-0" width={SIZE} height={SIZE} aria-hidden="true">
            <circle
              cx={CENTER}
              cy={CENTER}
              r={R}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={1.5}
              strokeDasharray="4 6"
            />
          </svg>

          {/* traveling token */}
          <motion.div
            className="absolute z-20 h-2.5 w-2.5 rounded-full bg-violet-400 shadow-[0_0_12px_2px_rgba(168,85,247,0.45)]"
            animate={{
              left: positions[active].x - 5,
              top: positions[active].y - 5,
            }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            style={{ left: positions[0].x - 5, top: positions[0].y - 5 }}
          />

          {/* center label */}
          <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 text-center">
            <p className="font-mono text-[11px] tracking-[0.25em] text-white/30">THE LOOP</p>
            <p className="mt-1 text-2xl font-extrabold text-white">
              {NODES[active].key}
            </p>
            <p className="mx-auto mt-1 max-w-[150px] text-xs leading-snug text-white/45">
              {NODES[active].desc}
            </p>
          </div>

          {/* nodes */}
          {NODES.map((n, i) => {
            const isActive = i === active;
            const { x, y } = positions[i];
            const Icon = n.Icon;
            return (
              <div
                key={n.key}
                className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
                style={{ left: x, top: y }}
              >
                <motion.div
                  animate={{
                    scale: isActive ? 1.12 : 1,
                    borderColor: isActive ? 'rgba(168,85,247,0.6)' : 'rgba(255,255,255,0.1)',
                    backgroundColor: isActive ? 'rgba(124,58,237,0.18)' : 'rgba(255,255,255,0.03)',
                  }}
                  transition={{ duration: 0.4 }}
                  className="flex h-24 w-24 flex-col items-center justify-center gap-1.5 rounded-2xl border backdrop-blur-sm"
                >
                  <Icon
                    className={`h-6 w-6 ${isActive ? 'text-violet-300' : 'text-white/40'}`}
                    strokeWidth={1.75}
                  />
                  <span
                    className={`font-mono text-[11px] font-semibold tracking-wide ${isActive ? 'text-white' : 'text-white/50'}`}
                  >
                    {n.key}
                  </span>
                </motion.div>
                {/* LISTEN → user input */}
                {n.key === 'LISTEN' && (
                  <motion.div
                    animate={{ opacity: isActive ? 1 : 0.3 }}
                    className="absolute left-1/2 top-full mt-2 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/50"
                  >
                    <span>🧑</span> you
                  </motion.div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
