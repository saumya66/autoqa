import { motion } from 'motion/react';
import Eyebrow from './Eyebrow';
import { EyeIcon, SparkIcon, QuestionIcon, MemoryIcon, CheckIcon, GlobeIcon, MonitorIcon, PhoneIcon } from './Icons';
import AppWindow from './AppWindow';

// ── Per-pillar mockups ──────────────────────────────────────────────────────

function VisionMock() {
  return (
    <AppWindow breadcrumb="clariti › scan › viewport 1280×800">
      <div className="relative p-5">
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
          <div className="h-2.5 w-24 rounded bg-white/15" />
          <div className="mt-3 flex items-center gap-2">
            <div className="relative flex-1">
              <div className="h-8 rounded-md border border-rose-400/40 bg-rose-400/5" />
              <span className="absolute -top-2 right-2 rounded bg-rose-500/90 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-white">
                text truncated
              </span>
            </div>
            <div className="h-8 w-16 rounded-md bg-violet-500/70" />
          </div>
          <div className="mt-3 h-2 w-3/4 rounded bg-white/10" />
          <div className="mt-2 h-2 w-1/2 rounded bg-white/10" />
        </div>
        <div className="mt-3 flex items-center justify-between font-mono text-[11px]">
          <span className="text-white/30">CTA · ok</span>
          <span className="rounded-md border border-rose-400/30 bg-rose-400/10 px-2 py-0.5 text-rose-300">
            2 visual issues
          </span>
        </div>
      </div>
    </AppWindow>
  );
}

function ThinkMock() {
  const steps = [
    'Goal: complete checkout with a coupon.',
    'I see a cart with 2 items → click "Checkout".',
    'A coupon field appeared → type "SAVE20".',
    'Total dropped 20% → proceed to payment.',
  ];
  return (
    <AppWindow breadcrumb="clariti › reasoning › next action">
      <div className="space-y-2.5 p-5 font-mono text-[12px]">
        {steps.map((s, i) => (
          <div key={i} className="flex gap-2.5">
            <span className="text-violet-400">›</span>
            <span className={i === steps.length - 1 ? 'text-white/85' : 'text-white/50'}>{s}</span>
          </div>
        ))}
        <div className="flex gap-2.5">
          <span className="text-violet-400">›</span>
          <span className="inline-flex items-center gap-1 text-white/85">
            deciding
            <span className="inline-flex gap-0.5">
              <span className="h-1 w-1 animate-pulse-soft rounded-full bg-violet-400" />
              <span className="h-1 w-1 animate-pulse-soft rounded-full bg-violet-400" style={{ animationDelay: '0.2s' }} />
              <span className="h-1 w-1 animate-pulse-soft rounded-full bg-violet-400" style={{ animationDelay: '0.4s' }} />
            </span>
          </span>
        </div>
      </div>
    </AppWindow>
  );
}

function AskMock() {
  return (
    <AppWindow breadcrumb="clariti › run #428 › interrupted">
      <div className="p-5">
        <div className="flex items-center gap-2 text-emerald-300">
          <span className="text-sm">▶</span>
          <span className="text-sm font-semibold">Running</span>
          <span className="ml-auto font-mono text-[11px] text-white/35">step 6 of 12</span>
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] p-3 text-sm text-white/60">
          <span className="text-violet-400">›</span>
          Adding item to cart → heading to checkout…
        </div>

        <div className="my-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-amber-300/80">
          <span className="h-px flex-1 bg-amber-300/20" />
          you interrupt
          <span className="h-px flex-1 bg-amber-300/20" />
        </div>

        <div className="rounded-lg border border-violet-400/25 bg-violet-500/5 px-3 py-2.5">
          <div className="mb-1.5 flex items-center gap-1.5">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-violet-500/80 font-mono text-[9px] font-semibold text-white">
              Y
            </span>
            <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-violet-300">
              You
            </span>
          </div>
          <span className="text-sm text-white/80">
            Wait — apply the SAVE20 coupon before you go to payment.
          </span>
        </div>
        <div className="mt-3 flex items-center gap-2 text-sm text-white/70">
          <span className="text-violet-400">›</span>
          Got it — adding the coupon, then continuing checkout.
          <span className="ml-auto font-mono text-[10px] text-white/30">↵ resuming</span>
        </div>
      </div>
    </AppWindow>
  );
}

function AnywhereMock() {
  const surfaces = [
    { label: 'Web app', Icon: GlobeIcon },
    { label: 'Desktop app', Icon: MonitorIcon },
    { label: 'Android / iOS', Icon: PhoneIcon },
  ];
  return (
    <AppWindow breadcrumb="clariti › surfaces › one agent">
      <div className="p-5">
        <div className="grid grid-cols-3 gap-2.5">
          {surfaces.map((s) => {
            const Icon = s.Icon;
            return (
              <div
                key={s.label}
                className="flex flex-col items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] py-3"
              >
                <Icon className="h-5 w-5 text-white/70" />
                <span className="text-[11px] text-white/50">{s.label}</span>
              </div>
            );
          })}
        </div>
        <div className="flex justify-center py-1" aria-hidden="true">
          <svg width="180" height="34" viewBox="0 0 180 34" fill="none">
            <path
              d="M30 0 V12 Q30 18 90 18 M90 0 V18 M150 0 V12 Q150 18 90 18 M90 18 V34"
              stroke="rgba(168,85,247,0.35)"
              strokeWidth="1.5"
            />
          </svg>
        </div>
        <div className="flex items-center justify-center gap-2 rounded-lg border border-violet-400/25 bg-violet-500/10 px-3 py-2.5">
          <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-violet-400" />
          <span className="text-sm font-semibold text-white">Clariti runs on</span>
          <span className="ml-1 font-mono text-[10px] text-white/40">every surface</span>
        </div>
      </div>
    </AppWindow>
  );
}

function LearningMock() {
  return (
    <AppWindow breadcrumb="clariti › learning › checkout-flow">
      <div className="p-5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] tracking-widest text-white/35">RUN COMPLETE</span>
          <span className="rounded-md border border-emerald-400/25 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] text-emerald-300">
            12 PASSED
          </span>
        </div>
        <div className="my-4 h-px bg-white/10" />
        <p className="font-mono text-[10px] font-semibold tracking-[0.18em] text-violet-300">LEARNING SAVED</p>
        <div className="mt-2 space-y-2 rounded-xl border border-violet-400/25 bg-violet-500/4 p-3">
          <p className="text-xs leading-relaxed text-white/70">Checkout opens a native payment sheet.</p>
          <p className="border-t border-white/10 pt-2 text-xs leading-relaxed text-white/70">Billing settings are admin-only.</p>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-white/40">
          <span className="text-emerald-300">✓</span> Saved to project context
        </p>
      </div>
    </AppWindow>
  );
}

// ── Pillars data ─────────────────────────────────────────────────────────────

const PILLARS = [
  {
    tag: 'Vision',
    Icon: EyeIcon,
    label: 'IT SEES',
    title: 'It actually looks at your screen.',
    body: 'Clariti sees your app the way your users do — the real, rendered UI. So it catches the things your current tests can\u2019t even look for: cut-off text, a spinner that never stops, a layout that breaks on one screen size.',
    Mock: VisionMock,
  },
  {
    tag: 'Reasoning',
    Icon: SparkIcon,
    label: 'IT THINKS',
    title: 'Built for changing products',
    body: 'When a page is redesigned or a button is renamed, Clariti can reason through the new experience and continue toward the goal—reducing the need to constantly repair tests.',
    Mock: ThinkMock,
  },
  {
    tag: 'Human-in-the-loop',
    Icon: QuestionIcon,
    label: 'IT LISTENS',
    title: 'You’re always in control.',
    body: 'Interrupt a run whenever you need to. Give Clariti new context, correct its course, or point it in the right direction in plain English—then let it continue toward the goal.',
    Mock: AskMock,
  },
  {
    tag: 'Platform-agnostic',
    Icon: GlobeIcon,
    label: 'IT WORKS ANYWHERE',
    title: 'It runs anywhere your product does.',
    body: 'Your web app, your desktop app, the mobile simulators your team already runs — Clariti tests them all. No separate tools, no separate scripts, no separate QA setup per platform.',
    Mock: AnywhereMock,
  },
  {
    tag: 'Learning',
    Icon: MemoryIcon,
    label: 'IT LEARNS',
    title: 'Every run makes the next one smarter.',
    body: 'Clariti learns from what it observes in each run and carries that context forward—so future tests start with a better understanding of your product.',
    Mock: LearningMock,
  },
];

export default function Pillars() {
  return (
    <section id="why-it-works" className="relative mx-auto max-w-6xl px-6 py-28 sm:py-32">
      <div className="text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center"
        >
          <Eyebrow>WHY IT WORKS</Eyebrow>
          <h2 className="mt-5 max-w-2xl text-[clamp(2rem,4.5vw,3.25rem)] font-extrabold leading-[1.05] tracking-tight text-white">
            It works like your <span className="text-gradient">best QA hire.</span>
          </h2>
        </motion.div>
      </div>

      <div className="mt-14 space-y-16 sm:space-y-24 lg:space-y-28">
        {PILLARS.map((p, i) => {
          const reversed = i % 2 === 1;
          const Icon = p.Icon;
          const Mock = p.Mock;
          return (
            <div
              key={p.label}
              className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16"
            >
              {/* Copy */}
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '0px 0px -15% 0px' }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className={reversed ? 'lg:order-2' : ''}
              >
                <div className="mb-4 inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5">
                  <Icon className="h-4 w-4 text-violet-300" />
                  <span className="font-mono text-[11px] font-semibold tracking-widest text-white/70">
                    {p.label}
                  </span>
                  <span className="text-white/20">·</span>
                  <span className="text-[11px] text-white/40">{p.tag}</span>
                </div>
                <h3 className="text-[clamp(1.5rem,3vw,2.25rem)] font-bold leading-tight tracking-tight text-white">
                  {p.title}
                </h3>
                <p className="mt-4 max-w-md text-base leading-relaxed text-white/55">{p.body}</p>
              </motion.div>

              {/* Mockup */}
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '0px 0px -15% 0px' }}
                transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                className={reversed ? 'lg:order-1' : ''}
              >
                <Mock />
              </motion.div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
