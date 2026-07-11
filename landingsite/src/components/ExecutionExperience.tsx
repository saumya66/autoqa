import { motion } from 'motion/react';
import Eyebrow from './Eyebrow';
import Reveal from './Reveal';
import RunnerMockup from './RunnerMockup';
import { CheckIcon } from './Icons';

const CHECKS = [
  'Watch every step live',
  'Pause & guide any run',
  'Correct it in plain English',
  'Every run recorded & stored in cloud',
];

export default function ExecutionExperience() {
  return (
    <section className="relative mx-auto max-w-7xl px-6 py-28 sm:py-32">
      <div className="grid items-center gap-12 lg:grid-cols-[2fr_3fr] lg:gap-14">
        <div>
          <Reveal className="flex">
            <Eyebrow>THE EXECUTION EXPERIENCE</Eyebrow>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className="mt-5 text-[clamp(2rem,4.5vw,3.25rem)] font-extrabold leading-[1.05] tracking-tight text-white">
              See everything. <span className="text-gradient">Steer anything.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-5 text-base leading-relaxed text-white/55">
              Watch each step as it happens — and take the wheel whenever you want. Pause a run,
              correct a step, or guide Clariti in plain English, then let it carry on. It&apos;s a
              glass box, not a black box — and every run is saved so you can check exactly what
              happened.
            </p>
          </Reveal>

          <ul className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {CHECKS.map((c, i) => (
              <motion.li
                key={c}
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                className="flex items-center gap-2.5 text-sm text-white/70"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
                  <CheckIcon className="h-3 w-3" strokeWidth={2.5} />
                </span>
                {c}
              </motion.li>
            ))}
          </ul>
        </div>

        <Reveal delay={0.1} x={0} y={30}>
          <RunnerMockup animateLog />
        </Reveal>
      </div>
    </section>
  );
}
