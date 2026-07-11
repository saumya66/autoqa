import { motion } from 'motion/react';
import Eyebrow from './Eyebrow';
import Reveal from './Reveal';

const CARDS = [
  {
    title: 'Chasing 100% coverage — and maintaining it',
    body: 'Your engineers & QAs are busy pushing test coverage to 100% and keeping it green. It\u2019s pure overhead.',
  },
  {
    title: "Your tests don't test what users see",
    body: 'They check functions, not the screen. The overlapping button, the endless spinner, the broken empty state — your customers catch those, not your suite.',
  },
  {
    title: 'Web, iOS, Android — you write & maintain tests for multiple platforms',
    body: 'Different platforms, different tools, different scripts, different people, testing the same flows from scratch.',
  },
  {
    title: 'One small change or one new feature, and your suites turn red',
    body: 'A rename or a redesign, and half your tests break. Eventually the team stops trusting them — and starts skipping them.',
  },
];

export default function ProblemSection() {
  return (
    <section id="problem" className="relative mx-auto max-w-6xl overflow-hidden px-6 py-20 sm:py-28 lg:py-36">
      <div className="max-w-3xl">
        <Reveal>
          <Eyebrow>SOUND FAMILIAR?</Eyebrow>
        </Reveal>
        <Reveal delay={0.05}>
          <h2 className="mt-5 text-[clamp(2rem,4.5vw,3.25rem)] font-extrabold leading-[1.05] tracking-tight text-white">
            Testing is quietly slowing your <span className="text-gradient">whole team</span> down.
          </h2>
        </Reveal>
      </div>

      <div className="mt-14 grid gap-5 sm:grid-cols-2">
        {CARDS.map((c, i) => {
          const fromLeft = i % 2 === 0;
          return (
            <motion.div
              key={c.title}
                        initial={{ opacity: 0, x: fromLeft ? -80 : 80 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          viewport={{ once: true, margin: '0px 0px -15% 0px' }}
                          transition={{ duration: 0.7, delay: Math.floor(i / 2) * 0.15, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] p-7 transition-all duration-300 hover:-translate-y-1 hover:border-violet-400/25 hover:bg-white/[0.04]">
                <span className="absolute inset-y-7 left-0 w-1 rounded-full bg-rose-500 [animation:glow-pulse_2.4s_ease-in-out_infinite]" style={{ boxShadow: '0 0 8px 2px rgba(239,68,68,0.7)' }} />
                <span className="font-mono text-xs text-white/30">0{i + 1}</span>
                <h3 className="mt-3 text-xl font-bold leading-snug tracking-tight text-white">{c.title}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-white/50">{c.body}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
