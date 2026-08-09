import { motion } from 'motion/react';
import Eyebrow from './Eyebrow';
import Reveal from './Reveal';
import { CheckIcon, CloseIcon } from './Icons';

const ROWS = [
  'Tests what users actually see',
  'Works on web, native & mobile',
  'No scripts to write or maintain',
  'Survives redesigns',
  'Takes guidance without starting over',
  'Pause & guide it mid-run',
];

// Real beta quotes go here once collected. Empty until then (no fabricated proof).
const QUOTES: { quote: string; role: string; org: string }[] = [];

export default function WhyTeamsSwitch() {
  return (
    <section className="relative mx-auto max-w-5xl px-6 py-28 sm:py-32">
      <div className="text-center">
        <Reveal className="flex justify-center">
          <Eyebrow>WHY TEAMS SWITCH</Eyebrow>
        </Reveal>
        <Reveal delay={0.05}>
          <h2 className="mx-auto mt-5 max-w-2xl text-[clamp(2rem,4.5vw,3.25rem)] font-extrabold leading-[1.05] tracking-tight text-white">
            A different way to think about testing.
          </h2>
        </Reveal>
      </div>

      <Reveal delay={0.1} y={30} className="mt-12">
        <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.015]">
          <div className="grid grid-cols-[1.6fr_1fr_1fr] border-b border-white/10 bg-white/[0.02] px-5 py-4">
            <span className="text-sm text-white/40" />
            <span className="text-center text-sm font-bold text-gradient">Clariti</span>
            <span className="text-center text-[13px] leading-tight text-white/40">
              Selenium / Cypress / Playwright
            </span>
          </div>
          {ROWS.map((row, i) => (
            <motion.div
              key={row}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] }}
              className="grid grid-cols-[1.6fr_1fr_1fr] items-center border-b border-white/5 px-5 py-4 last:border-0"
            >
              <span className="text-sm text-white/75">{row}</span>
              <span className="flex justify-center">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
                  <CheckIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
                </span>
              </span>
              <span className="flex justify-center">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/5 text-white/30">
                  <CloseIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
                </span>
              </span>
            </motion.div>
          ))}
        </div>
      </Reveal>

      {QUOTES.length > 0 && (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {QUOTES.map((q, i) => (
            <Reveal key={i} delay={i * 0.08}>
              <figure className="h-full rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
                <blockquote className="text-sm leading-relaxed text-white/75">“{q.quote}”</blockquote>
                <figcaption className="mt-4 text-xs text-white/40">
                  {q.role} · {q.org}
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      )}
    </section>
  );
}
