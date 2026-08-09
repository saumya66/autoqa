import { motion } from 'motion/react';
import Aurora from './Aurora';
import { BookDemoButton, WatchDemoButton } from './CTAButtons';
import HeroVisual from './HeroVisual';

const VALUES = [
  {
    heading: 'SEES WHAT USERS SEE',
    body: 'Traditional E2E tests verify functionality and, at best, compare screenshots to a baseline. Clariti sees your product like a user—and notices when something looks or feels broken.',
  },
  {
    heading: 'TEST IN ENGLISH, NOT CODE',
    body: 'Describe what should work in plain English. Clariti generates and runs tests on the platform you choose—web, desktop, Android, or iOS—with no test code to write or maintain.',
  },
  {
    heading: 'SCALE QA, NOT HEADCOUNT.',
    body: 'Clariti saves you time and capital by running QA autonomously—so your team can focus on what matters most: building the business.',
  },
];

export default function Hero() {
  return (
    <section id="top" className="relative min-h-screen overflow-hidden px-6 pt-32 pb-0 sm:pt-36">
      <Aurora />
      <div className="absolute inset-0 bg-grid bg-grid-fade" aria-hidden="true" />
      <div
        className="absolute left-1/3 top-1/4 h-130 w-130 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.16), transparent 65%)' }}
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto max-w-7xl">
        <div className="grid items-center gap-12 lg:min-h-140 lg:grid-cols-[0.92fr_1.08fr] lg:gap-8">
          <div className="max-w-2xl text-left">
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="mb-6 inline-flex items-center gap-2 font-mono text-[11px] font-semibold tracking-[0.18em] text-violet-200/75"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse-soft" />
              AUTONOMOUS QA
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, filter: 'blur(10px)', y: 16 }}
              animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
              transition={{ duration: 0.8, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="font-sans text-[clamp(2.65rem,5.8vw,4.9rem)] font-medium leading-[0.98] tracking-[-0.045em] text-white"
            >
              Meet Clariti —{' '}
              <span className="text-gradient">Your Team&apos;s Autonomous QA</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.75, delay: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="mt-7 max-w-xl text-base leading-relaxed text-white/60 sm:text-lg"
            >
              Clariti tests your product the way a real QA does—it sees your app, works through
              critical flows, notices what looks wrong, and tells you what broke.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.75, delay: 0.34, ease: [0.16, 1, 0.3, 1] }}
              className="mt-9 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center"
            >
              <BookDemoButton size="lg" className="w-full sm:w-auto" />
              <WatchDemoButton size="lg" variant="ghost" className="w-full sm:w-auto" />
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.9, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="mx-auto w-full max-w-2xl lg:max-w-none"
          >
            <HeroVisual />
          </motion.div>
        </div>

        <div className="mt-14 grid overflow-hidden border-x border-t border-white/8 sm:mt-18 lg:grid-cols-3">
          {VALUES.map((value, index) => (
            <motion.article
              key={value.heading}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.7,
                delay: 0.55 + index * 0.12,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="border-b border-white/8 p-6 sm:p-7 lg:min-h-44 lg:border-r last:lg:border-r-0"
            >
              <h2 className="font-mono text-xs font-semibold tracking-[0.14em] text-violet-200/80 sm:text-sm">
                {value.heading}
              </h2>
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/55">{value.body}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
