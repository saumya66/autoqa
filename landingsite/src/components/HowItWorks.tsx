import Eyebrow from './Eyebrow';
import Reveal from './Reveal';
import HorizontalScrollSection from './HorizontalScrollSection';
import AppWindow from './AppWindow';
import RunnerMockup from './RunnerMockup';
import { PriorityBadge } from './Badge';

// ── Step mockups ─────────────────────────────────────────────────────────────

function ContextMock() {
  return (
    <AppWindow breadcrumb="clariti › context › new-project">
      <div className="p-5">
        <div className="rounded-xl border border-violet-400/25 bg-violet-500/4 p-4">
          <p className="text-sm font-semibold text-white">Tell us about your app</p>
          <p className="mt-0.5 text-[11px] text-violet-200/60">We’ll turn it into project context.</p>
          <p className="mt-3 text-xs leading-relaxed text-white/60">
            A B2B analytics dashboard for product teams. Users sign in with email + password, monitor
            real-time usage, invite teammates, and manage billing through Stripe.
          </p>
        </div>
        <div className="mt-3 rounded-xl border border-white/10 bg-white/2 p-3">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-xs font-semibold text-white/80">Always remember</p>
            <p className="font-mono text-[9px] tracking-wider text-violet-300/70">MEMORY</p>
          </div>
          <p className="mt-0.5 text-[11px] text-white/40">Add known quirks and rules.</p>
          <p className="mt-2 rounded-md bg-white/3 px-2.5 py-2 text-[11px] leading-relaxed text-white/55">
            The upgrade modal only appears for trial users.
          </p>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-[11px] text-white/40">Add a URL or screenshots <span className="text-white/25">· Optional</span></p>
          <span className="shrink-0 rounded-md border border-white/10 bg-white/3 px-2 py-1 font-mono text-[10px] text-white/55">
            + Add context
          </span>
        </div>
      </div>
    </AppWindow>
  );
}

function GenerateMock() {
  const tests = [
    { id: '#001', p: 'CRITICAL' as const, t: 'User can sign up with a valid email' },
    { id: '#002', p: 'CRITICAL' as const, t: 'Password reset email delivers' },
    { id: '#003', p: 'HIGH' as const, t: 'Dashboard loads under 2s on cold start' },
    { id: '#004', p: 'HIGH' as const, t: 'Avatar upload rejects files over 2MB' },
  ];
  return (
    <AppWindow breadcrumb="clariti › generate › checkout-flow">
      <div className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-mono text-[11px] tracking-widest text-white/35">GENERATED · {tests.length}</span>
          <span className="rounded-md border border-violet-400/25 bg-violet-500/10 px-2 py-0.5 font-mono text-[10px] text-violet-300">
            AI-written
          </span>
        </div>
        <ul className="space-y-2">
          {tests.map((tt) => (
            <li key={tt.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
              <div className="flex items-center gap-2">
                <PriorityBadge level={tt.p} />
                <span className="font-mono text-[11px] text-white/35">{tt.id}</span>
              </div>
              <p className="mt-1.5 text-[13px] text-white/80">{tt.t}</p>
            </li>
          ))}
        </ul>
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

const STEPS = [
  {
    num: '01',
    label: 'ONBOARD YOUR PROJECT',
    title: 'Tell it about your app.',
    body: 'Tell Clariti about your product — what it does, who uses it, how it\u2019s meant to work. Plain English is all you need. No config files, no selectors, no setup project.',
    Mock: ContextMock,
  },
  {
    num: '02',
    label: 'CREATE A TEST SUITE',
    title: 'Describe what you want to test.',
    body: 'Just like you\u2019d brief your QA. Drop in a screenshot if it helps. Clariti generates the full test cases — and you decide what makes the cut. Add, remove, tweak in plain English.',
    Mock: GenerateMock,
  },
  {
    num: '03',
    label: "THAT'S IT. RUN.",
    title: 'Hit run. Watch it go.',
    body: 'Clariti finds your live app and works through every test — clicking, typing, checking — exactly like a human would. You get results you can trust, replay, and share.',
    Mock: () => <RunnerMockup animateLog />,
  },
  {
    num: '04',
    label: 'LEARNS FROM EVERY RUN',
    title: 'Every run makes the next one smarter.',
    body: 'After each run, Clariti turns what it learns into lasting project context—so it understands more of your app the next time it tests.',
    Mock: LearningMock,
  },
];

function Panel({ step }: { step: (typeof STEPS)[number] }) {
  const Mock = step.Mock;
  return (
    <div className="flex w-[88vw] shrink-0 flex-col gap-2 px-1 md:w-[90vw] md:flex-row md:items-center md:gap-8 lg:w-[75vw] lg:gap-12">
      <div className="md:w-2/5 md:shrink-0">
        <div className="numeral-outline text-[clamp(2rem,8vw,9rem)] font-extrabold leading-none">
          {step.num}
        </div>
        <p className="mt-2 font-mono text-[10px] font-semibold tracking-[0.2em] text-violet-300 sm:text-xs sm:mt-4">
          {step.label}
        </p>
        <h3 className="mt-1.5 text-[clamp(1.1rem,2.5vw,2rem)] font-bold leading-tight tracking-tight text-white sm:mt-3">
          {step.title}
        </h3>
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-white/55 sm:mt-3 sm:text-base">{step.body}</p>
      </div>
      {/* zoom shrinks layout + visual together — no dead-space compensation needed */}
      <div className="min-w-0 flex-1 [zoom:0.58] sm:[zoom:0.75] md:[zoom:1]">
        <Mock />
      </div>
    </div>
  );
}

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="relative py-24">
      <HorizontalScrollSection
        trackVh={500}
        mobileBreakpoint={0}
        header={
          <div className="mx-auto mb-10 max-w-6xl px-6">
            <Reveal className="flex">
              <Eyebrow>HOW IT WORKS</Eyebrow>
            </Reveal>
            <Reveal delay={0.05}>
              <h2 className="mt-5 max-w-2xl text-[clamp(2rem,4.5vw,3.25rem)] font-extrabold leading-[1.05] tracking-tight text-white">
                Just describe it — like you&apos;d brief your QA.
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-white/55 sm:text-lg">
                And let it do the rest.
              </p>
            </Reveal>
          </div>
        }
      >
        {STEPS.map((s) => (
          <Panel key={s.num} step={s} />
        ))}
      </HorizontalScrollSection>
    </section>
  );
}
