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
        <div className="rounded-xl border border-dashed border-violet-400/30 bg-violet-500/[0.04] p-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/15 ring-1 ring-violet-400/25">
            <svg viewBox="0 0 24 24" className="h-6 w-6 text-violet-300" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 16V4m0 0 4 4m-4-4L8 8" />
              <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
            </svg>
          </div>
          <p className="mt-3 text-sm font-semibold text-white">Drop screenshots of your app</p>
          <p className="mt-1 font-mono text-[11px] text-white/40">or paste a URL · describe it in plain English</p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {['dashboard.png', 'checkout.png', 'settings.png'].map((f) => (
            <span key={f} className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 font-mono text-[11px] text-white/50">
              <span className="h-2 w-2 rounded-sm bg-violet-400/50" /> {f}
            </span>
          ))}
        </div>
        <p className="mt-4 rounded-lg bg-white/[0.03] p-3 text-xs leading-relaxed text-white/45">
          &ldquo;A B2B analytics dashboard. Users sign in with email + password, then see a real-time
          usage chart. Admins can invite teammates and manage billing via Stripe.&rdquo;
        </p>
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
        trackVh={380}
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
