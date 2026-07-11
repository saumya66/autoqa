import { useEffect, useRef, useState } from 'react';
import AppWindow from './AppWindow';
import { PriorityBadge, StatusBadge, type Priority, type RunStatus } from './Badge';
import { CheckIcon } from './Icons';

// ── Inline action icons (SVG) ─────────────────────────────────────────────────

function ClickIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2v7l2-2 2 4 1.5-.7-2-4h2.7L6 2z" />
    </svg>
  );
}
function TypeIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 4h10M8 4v8M5 12h6" />
    </svg>
  );
}
function NavIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="6" />
      <path d="M2 8h12M8 2a10 10 0 0 1 0 12M8 2a10 10 0 0 0 0 12" />
    </svg>
  );
}
function VerifyIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 8h12M8 2v12" /><circle cx="8" cy="8" r="3" />
    </svg>
  );
}
function SpinnerIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 animate-spin" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="6" strokeOpacity="0.25" />
      <path d="M14 8a6 6 0 0 0-6-6" strokeLinecap="round" />
    </svg>
  );
}
function BrainIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3C5.8 3 4 4.8 4 7c0 1 .4 2 1 2.7V13h6V9.7c.6-.7 1-1.7 1-2.7 0-2.2-1.8-4-4-4z" />
      <path d="M6 7h4M7 9.5V13M9 9.5V13" />
    </svg>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

type ActionType = 'navigate' | 'click' | 'type' | 'verify' | 'thinking';

interface StepEntry {
  step: number;
  action: ActionType;
  target: string;
  value?: string;
  reasoning: string;
  ok: boolean | null; // null = in-progress / thinking
}

interface TestRow {
  title: string;
  priority: Priority;
  status: RunStatus;
}

// ── Data: PASSED first, then RUNNING, then QUEUED ────────────────────────────

const DEFAULT_TESTS: TestRow[] = [
  { title: 'Sign in with valid credentials', priority: 'CRITICAL', status: 'PASSED' },
  { title: 'Password reset email sent',       priority: 'MEDIUM',   status: 'PASSED' },
  { title: 'Logout clears session',           priority: 'MEDIUM',   status: 'PASSED' },
  { title: 'Expired session redirects',       priority: 'LOW',      status: 'PASSED' },
  { title: 'Dashboard empty state renders',   priority: 'HIGH',     status: 'RUNNING' },
  { title: 'Upload avatar under 2MB',         priority: 'HIGH',     status: 'QUEUED'  },
];

const ALL_STEPS: StepEntry[] = [
  { step: 1, action: 'navigate', target: 'app.example.com/dashboard', reasoning: 'Opening the dashboard URL', ok: true },
  { step: 2, action: 'verify',   target: 'empty state widget',        reasoning: 'Checking for empty state UI', ok: true },
  { step: 3, action: 'click',    target: '"Add your first item" CTA', reasoning: 'Primary action on empty state', ok: true },
  { step: 4, action: 'verify',   target: 'modal open',                reasoning: 'Confirming dialog appeared', ok: true },
  { step: 5, action: 'type',     target: 'item name field', value: '"Q2 report"', reasoning: 'Filling in required field', ok: true },
  { step: 6, action: 'click',    target: '"Save" button',             reasoning: 'Submitting the form', ok: true },
  { step: 7, action: 'verify',   target: 'item in list',              reasoning: 'Confirming item was created', ok: null },
];

const INITIAL_VISIBLE = 4;

const ACTION_META: Record<ActionType, { Icon: () => JSX.Element; color: string; label: string }> = {
  navigate: { Icon: NavIcon,    color: 'text-sky-300',    label: 'Navigate' },
  click:    { Icon: ClickIcon,  color: 'text-violet-300', label: 'Click'    },
  type:     { Icon: TypeIcon,   color: 'text-amber-300',  label: 'Type'     },
  verify:   { Icon: VerifyIcon, color: 'text-emerald-300',label: 'Verify'   },
  thinking: { Icon: BrainIcon,  color: 'text-purple-300', label: 'Thinking' },
};

// ── Step card ─────────────────────────────────────────────────────────────────

function StepCard({ entry, isNew = false }: { entry: StepEntry; isNew?: boolean }) {
  const meta = ACTION_META[entry.action];
  const Icon = meta.Icon;
  const inProgress = entry.ok === null;

  return (
    <div
      className={`flex min-w-0 gap-2.5 rounded-lg border p-2.5 transition-all ${
        inProgress
          ? 'border-violet-400/30 bg-violet-500/[0.06]'
          : entry.ok
          ? 'border-white/[0.07] bg-white/[0.02]'
          : 'border-rose-400/25 bg-rose-500/[0.04]'
      } ${isNew ? 'animate-fade-up' : ''}`}
    >
      {/* Step badge */}
      <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[9px] ${
        inProgress ? 'bg-violet-500/20 text-violet-300' : entry.ok ? 'bg-white/10 text-white/50' : 'bg-rose-500/20 text-rose-300'
      }`}>
        {entry.step}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={meta.color}><Icon /></span>
          <span className="text-[12px] font-medium text-white/90">{meta.label}</span>
          <span className="truncate text-[12px] text-white/45">{entry.target}</span>
          {entry.value && <span className="shrink-0 font-mono text-[10px] text-white/30">{entry.value}</span>}
        </div>
        <p className="mt-0.5 truncate text-[11px] leading-snug text-white/35">{entry.reasoning}</p>
      </div>

      {/* Status icon */}
      <div className="mt-0.5 shrink-0">
        {inProgress
          ? <span className="text-violet-400"><SpinnerIcon /></span>
          : entry.ok
          ? <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300"><CheckIcon className="h-2 w-2" strokeWidth={3} /></span>
          : <span className="font-mono text-[10px] text-rose-300">✕</span>
        }
      </div>
    </div>
  );
}

// ── Thinking bubble ───────────────────────────────────────────────────────────

function ThinkingBubble() {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-purple-400/20 bg-purple-500/[0.06] px-3 py-2">
      <span className="text-purple-400"><BrainIcon /></span>
      <span className="text-[11px] text-purple-300/70">Checking element visibility…</span>
      <span className="ml-auto flex gap-0.5">
        {[0, 0.15, 0.3].map((d) => (
          <span key={d} className="h-1 w-1 rounded-full bg-purple-400 animate-pulse-soft" style={{ animationDelay: `${d}s` }} />
        ))}
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface RunnerMockupProps {
  breadcrumb?: string;
  tests?: TestRow[];
  className?: string;
  animateLog?: boolean;
}

export default function RunnerMockup({
  breadcrumb = 'clariti › run #429 › dashboard.suite',
  tests = DEFAULT_TESTS,
  className = '',
  animateLog = false,
}: RunnerMockupProps) {
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const [showThinking, setShowThinking] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!animateLog) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    let current = INITIAL_VISIBLE;

    const tick = () => {
      if (current >= ALL_STEPS.length) {
        setShowThinking(false);
        return;
      }
      setShowThinking(true);
      setTimeout(() => {
        current += 1;
        setVisibleCount(current);
        setShowThinking(false);
      }, 900);
    };

    const id = setInterval(tick, 1800);
    return () => clearInterval(id);
  }, [animateLog]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [visibleCount, showThinking]);

  const steps = ALL_STEPS.slice(0, visibleCount);
  const runningStep = steps.length;

  return (
    <AppWindow breadcrumb={breadcrumb} live className={`flex h-[480px] flex-col ${className}`}>
      {/* Running header */}
      <div className="flex shrink-0 items-center gap-2.5 border-b border-white/[0.07] bg-violet-500/[0.04] px-4 py-2.5">
        <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse-soft" />
        <span className="text-[12px] font-semibold text-white/80">Executing</span>
        <span className="text-[12px] text-white/35">Dashboard empty state renders</span>
        <span className="ml-auto font-mono text-[10px] text-white/30">step {runningStep} of {ALL_STEPS.length}</span>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[1fr_1.2fr] overflow-hidden">
        {/* Test cases */}
        <div className="min-w-0 overflow-hidden border-r border-white/[0.07] p-3">
          <p className="mb-3 font-mono text-[11px] tracking-widest text-white/35">
            TEST CASES · {tests.length}
          </p>
          <ul className="space-y-1.5">
            {tests.map((tt, i) => (
              <li
                key={i}
                className={`rounded-lg border px-3 py-2 ${
                  tt.status === 'RUNNING'
                    ? 'border-violet-400/30 bg-violet-500/10'
                    : 'border-transparent'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    tt.status === 'PASSED'  ? 'bg-emerald-400' :
                    tt.status === 'RUNNING' ? 'bg-violet-400 animate-pulse-soft' :
                    tt.status === 'FAILED'  ? 'bg-rose-400' :
                    'bg-white/25'
                  }`} />
                  <span className="truncate text-[13px] text-white/80">{tt.title}</span>
                </div>
                <div className="mt-1.5 flex items-center gap-2 pl-3.5">
                  <PriorityBadge level={tt.priority} />
                  <StatusBadge status={tt.status} />
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Execution log — fills full height */}
        <div className="flex min-h-0 min-w-0 flex-col overflow-hidden p-3">
          <div className="mb-3 flex shrink-0 items-center justify-between">
            <p className="font-mono text-[11px] tracking-widest text-white/35">EXECUTION LOG</p>
            <div className="flex gap-1.5">
              <span className="rounded-md border border-white/10 px-2 py-0.5 font-mono text-[10px] text-white/45">Pause</span>
              <span className="rounded-md border border-white/10 px-2 py-0.5 font-mono text-[10px] text-white/45">Stop</span>
            </div>
          </div>
          <div ref={logRef} className="flex flex-1 flex-col gap-2 overflow-y-auto">
            {steps.map((entry, i) => (
              <StepCard key={entry.step} entry={entry} isNew={i === steps.length - 1 && animateLog} />
            ))}
            {showThinking && <ThinkingBubble />}
          </div>
        </div>
      </div>
    </AppWindow>
  );
}

export type { TestRow };
