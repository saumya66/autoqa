import { motion } from 'motion/react';
import Aurora from './Aurora';
import { BookDemoButton, WatchDemoButton } from './CTAButtons';
import { EyeIcon, SparkIcon, QuestionIcon, GavelIcon } from './Icons';

const VERBS = [
  { word: 'Sees', Icon: EyeIcon },
  { word: 'Thinks', Icon: SparkIcon },
  { word: 'Asks', Icon: QuestionIcon },
  { word: 'Judges', Icon: GavelIcon },
];

const FLOAT_NODES: { label: string; cls: string; dur: number }[] = [
  { label: 'See', cls: 'left-[10%] top-[30%]', dur: 7 },
  { label: 'Think', cls: 'right-[9%] top-[26%]', dur: 8 },
  { label: 'Ask', cls: 'left-[14%] bottom-[24%]', dur: 9 },
  { label: 'Judge', cls: 'right-[12%] bottom-[28%]', dur: 7.5 },
];

export default function Hero() {
  return (
    <section id="top" className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 pt-28 pb-20">
      <Aurora />
      <div className="absolute inset-0 bg-grid bg-grid-fade" aria-hidden="true" />
      <div
        className="absolute left-1/2 top-1/3 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.16), transparent 65%)' }}
        aria-hidden="true"
      />

      {/* Floating loop-node labels (decorative) */}
      <div className="pointer-events-none absolute inset-0 hidden lg:block" aria-hidden="true">
        {FLOAT_NODES.map((n, i) => (
          <motion.span
            key={n.label}
            className={`absolute rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-mono text-[11px] text-white/40 backdrop-blur-sm ${n.cls}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, y: [0, -12, 0] }}
            transition={{
              opacity: { delay: 1.9 + i * 0.15, duration: 0.8 },
              y: { duration: n.dur, repeat: Infinity, ease: 'easeInOut' },
            }}
          >
            {n.label}
          </motion.span>
        ))}
      </div>

      <div className="relative z-10 mx-auto max-w-4xl text-center">
        {/* Eyebrow */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-sm text-white/60"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse-soft" />
          The autonomous QA agent
        </motion.p>

        {/* Headline — four verbs animate in */}
        <h1 className="font-sans text-[clamp(2.4rem,7.5vw,5.25rem)] font-extrabold leading-[0.98] tracking-[-0.03em] text-white">
          <span className="flex flex-wrap items-center justify-center gap-x-[0.35em] gap-y-1">
            {VERBS.map(({ word }, i) => (
              <motion.span
                key={word}
                initial={{ opacity: 0, filter: 'blur(14px)', y: 12 }}
                animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
                transition={{ duration: 0.7, delay: 0.15 + i * 0.28, ease: [0.16, 1, 0.3, 1] }}
                className="inline-flex items-center gap-[0.2em] whitespace-nowrap"
              >
                <span className="text-white/25">It</span>
                <span className="text-gradient">{word}.</span>
              </motion.span>
            ))}
          </span>
          <motion.span
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15 + 4 * 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="mt-2 block text-white"
          >
            Just like your QA would.
          </motion.span>
        </h1>

        {/* Sub */}
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.5, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto mt-7 max-w-2xl text-base leading-relaxed text-white/55 sm:text-lg"
        >
          Clariti tests your product the way a real QA does — it sees your app, works through
          every flow, notices what looks wrong, and tells you what broke.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.75, ease: [0.16, 1, 0.3, 1] }}
          className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <BookDemoButton size="lg" className="w-full sm:w-auto" />
          <WatchDemoButton size="lg" variant="ghost" className="w-full sm:w-auto" />
        </motion.div>
      </div>

      {/* Scroll cue */}
      <motion.a
        href="#problem"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.2, duration: 0.8 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 font-mono text-xs tracking-widest text-white/30 transition-colors hover:text-white/60"
      >
        <span className="flex flex-col items-center gap-2">
          <span className="inline-block animate-bounce">↓</span>
          SCROLL
        </span>
      </motion.a>
    </section>
  );
}
