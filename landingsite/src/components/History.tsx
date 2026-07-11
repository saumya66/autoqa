import { motion } from 'motion/react';
import Eyebrow from './Eyebrow';
import Reveal from './Reveal';

interface Run {
  id: string;
  suite: string;
  status: 'Passed' | 'Failed';
  actions: number;
  duration: string;
  when: string;
}

const RUNS: Run[] = [
  { id: '#428', suite: 'auth-flow.suite', status: 'Passed', actions: 8, duration: '12.4s', when: '2m ago' },
  { id: '#427', suite: 'checkout.suite', status: 'Failed', actions: 14, duration: '18.1s', when: '14m ago' },
  { id: '#426', suite: 'onboarding.suite', status: 'Passed', actions: 19, duration: '22.7s', when: '32m ago' },
  { id: '#425', suite: 'billing.suite', status: 'Passed', actions: 6, duration: '9.8s', when: '1h ago' },
  { id: '#424', suite: 'search.suite', status: 'Passed', actions: 5, duration: '7.2s', when: '1h ago' },
  { id: '#423', suite: 'admin-panel.suite', status: 'Passed', actions: 24, duration: '31.4s', when: '3h ago' },
];

export default function History() {
  return (
    <section id="history" className="relative mx-auto max-w-5xl px-6 py-28 sm:py-32">
      <div className="max-w-2xl">
        <Reveal className="flex">
          <Eyebrow>STORED IN THE CLOUD</Eyebrow>
        </Reveal>
        <Reveal delay={0.05}>
          <h2 className="mt-5 text-[clamp(2rem,4.5vw,3.25rem)] font-extrabold leading-[1.05] tracking-tight text-white">
            All your test data <span className="text-gradient">lives in the cloud.</span>
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mt-5 text-base leading-relaxed text-white/55">
            Every run, every step, every result — stored securely in the cloud and ready to audit.
            Your whole team sees the same history, from anywhere, anytime. No more &ldquo;works on my
            machine.&rdquo;
          </p>
        </Reveal>
      </div>

      <Reveal delay={0.1} y={30} className="mt-12">
        <div className="-mx-6 overflow-x-auto px-6 sm:mx-0 sm:px-0">
        <div className="min-w-[540px] overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.015]">
          {/* header */}
          <div className="grid grid-cols-[1fr_2fr_1fr_1fr_1fr] gap-4 border-b border-white/10 bg-white/[0.02] px-5 py-3 font-mono text-[11px] tracking-widest text-white/35">
            <span>RUN</span>
            <span>SUITE</span>
            <span>STATUS</span>
            <span className="hidden sm:block">ACTIONS</span>
            <span className="text-right">WHEN</span>
          </div>
          {RUNS.map((r, i) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
              className="grid grid-cols-[1fr_2fr_1fr_1fr_1fr] items-center gap-4 border-b border-white/5 px-5 py-3.5 text-sm transition-colors last:border-0 hover:bg-white/[0.03]"
            >
              <span className="font-mono text-white/70">{r.id}</span>
              <span className="truncate font-mono text-white/80">{r.suite}</span>
              <span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[11px] font-semibold ${
                    r.status === 'Passed'
                      ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
                      : 'border-rose-400/30 bg-rose-400/10 text-rose-300'
                  }`}
                >
                  {r.status}
                </span>
              </span>
              <span className="hidden font-mono text-white/50 sm:block">{r.actions}</span>
              <span className="text-right font-mono text-white/40">{r.when}</span>
            </motion.div>
          ))}
        </div>
        </div>
      </Reveal>
    </section>
  );
}
