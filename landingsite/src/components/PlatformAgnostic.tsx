import { motion } from 'motion/react';
import Eyebrow from './Eyebrow';
import Reveal from './Reveal';
import { GlobeIcon, MonitorIcon, PhoneIcon, LogoMark } from './Icons';

const SURFACES = [
  { label: 'Web app', Icon: GlobeIcon },
  { label: 'Desktop app', Icon: MonitorIcon },
  { label: 'Android/iOS', Icon: PhoneIcon },
];

export default function PlatformAgnostic() {
  return (
    <section className="relative overflow-hidden py-28 sm:py-36">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 55% 45% at 50% 45%, rgba(99,102,241,0.1), transparent 70%)' }}
        aria-hidden="true"
      />
      <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
        <Reveal className="flex justify-center">
          <Eyebrow>ONE AGENT, EVERY SURFACE</Eyebrow>
        </Reveal>
        <Reveal delay={0.05}>
          <h2 className="mx-auto mt-5 max-w-2xl text-[clamp(2rem,4.5vw,3.25rem)] font-extrabold leading-[1.05] tracking-tight text-white">
            One tool for web, native, <span className="text-gradient">and mobile.</span>
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-white/55 sm:text-lg">
            Because Clariti works from what&apos;s on the screen, it isn&apos;t stuck in the browser.
            Your web app, your desktop app, the mobile simulators your team already runs — one agent
            tests them all. Stop maintaining a separate QA setup for every platform.
          </p>
        </Reveal>

        {/* Surfaces → agent */}
        <div className="relative mx-auto mt-16 max-w-2xl">
          <div className="grid grid-cols-3 gap-4">
            {SURFACES.map((s, i) => {
              const Icon = s.Icon;
              return (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                  className="flex flex-col items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 text-center"
                >
                  <Icon className="h-7 w-7 text-white/70" />
                  <span className="text-sm text-white/60">{s.label}</span>
                </motion.div>
              );
            })}
          </div>

          {/* connectors */}
          <div className="flex justify-center py-4" aria-hidden="true">
            <svg width="220" height="48" viewBox="0 0 220 48" fill="none">
              <path d="M40 0 V16 Q40 24 110 24 M110 0 V24 M180 0 V16 Q180 24 110 24 M110 24 V48" stroke="rgba(168,85,247,0.35)" strokeWidth="1.5" />
            </svg>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="mx-auto inline-flex items-center gap-3 rounded-2xl border border-violet-400/25 bg-violet-500/10 px-6 py-4"
          >
            <LogoMark className="h-8 w-8 animate-pulse-soft" />
            <div className="text-left">
              <p className="text-sm font-semibold text-white">Clariti</p>
              <p className="font-mono text-[11px] text-white/45">watching every surface</p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
