import * as React from 'react';
import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Minus,
  MousePointer,
  Keyboard,
  ArrowUpDown,
  Eye,
  Navigation,
  Clock,
  Zap,
  AlertCircle,
  StopCircle,
  ChevronDown,
  ChevronUp,
  PauseCircle,
  PlayCircle,
  MessageSquare,
  Send,
  ArrowLeft,
  RotateCcw,
  Ban,
  ListChecks,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useFeatureTestCases, useTestRunDetail } from '@/hooks/useProjectsQueries';
import { useTestSuiteExecutionStore, type TestRunStatus, type ActivityEntry } from '@/store/testSuiteExecutionStore';
import { cn } from '@/lib/utils';
import { z } from 'zod';

export const Route = createFileRoute('/app/execute')({
  validateSearch: z.object({
    featureId: z.string().optional(),
    projectId: z.string().optional(),
    windowTitle: z.string().optional(),
    featureName: z.string().optional(),
    runId: z.string().optional(),
  }),
  component: ExecutePage,
});

// ─── Status icon ─────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: TestRunStatus }) {
  switch (status) {
    case 'passed':
      return <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />;
    case 'failed':
      return <XCircle className="size-4 text-red-500 shrink-0" />;
    case 'running':
      return <Loader2 className="size-4 text-primary animate-spin shrink-0" />;
    case 'skipped':
      return <Minus className="size-4 text-muted-foreground shrink-0" />;
    default:
      return <Minus className="size-4 text-muted-foreground/40 shrink-0" />;
  }
}

// ─── Activity entry icon ──────────────────────────────────────────────────────

function ActivityIcon({ type, success }: { type: ActivityEntry['type']; success: boolean }) {
  const iconClass = 'size-3.5';
  const base = success ? '' : 'opacity-60';

  const colorMap: Record<ActivityEntry['type'], string> = {
    click:    'bg-blue-500/10 text-blue-500',
    type:     'bg-purple-500/10 text-purple-500',
    scroll:   'bg-slate-500/10 text-slate-500',
    observe:  'bg-muted text-muted-foreground',
    navigate: 'bg-emerald-500/10 text-emerald-600',
    wait:     'bg-amber-500/10 text-amber-500',
    guidance: 'bg-orange-500/10 text-orange-500',
    other:    'bg-muted text-muted-foreground',
  };

  const IconComp: Record<ActivityEntry['type'], React.ElementType> = {
    click:    MousePointer,
    type:     Keyboard,
    scroll:   ArrowUpDown,
    observe:  Eye,
    navigate: Navigation,
    wait:     Clock,
    guidance: MessageSquare,
    other:    Zap,
  };

  const Icon = IconComp[type];

  return (
    <div className={cn('flex size-5 shrink-0 items-center justify-center rounded-full', colorMap[type], base)}>
      <Icon className={iconClass} />
    </div>
  );
}

// ─── Guidance panel ───────────────────────────────────────────────────────────

function GuidancePanel({
  question,
  currentState,
  isPaused,
  onSubmit,
}: {
  question?: string;
  currentState?: string;
  isPaused: boolean;
  onSubmit: (guidance: string) => void;
}) {
  const [text, setText] = React.useState('');

  const handleSubmit = () => {
    if (!text.trim()) return;
    onSubmit(text.trim());
    setText('');
  };

  return (
    <div className="mx-8 mb-4 rounded-2xl border border-orange-400/30 bg-orange-500/5 overflow-hidden">
      {/* Banner */}
      <div className="flex items-center gap-2.5 px-5 py-3 border-b border-orange-400/20 bg-orange-500/10">
        <MessageSquare className="size-4 text-orange-500 shrink-0" />
        <span className="text-sm font-semibold text-orange-600">
          {isPaused ? 'Execution paused — your turn' : 'Agent needs your guidance'}
        </span>
      </div>

      {/* Question / state */}
      {(question || currentState) && (
        <div className="px-5 pt-4 pb-2 space-y-1.5">
          {currentState && (
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Current state
            </p>
          )}
          {currentState && (
            <p className="text-xs text-muted-foreground leading-relaxed">{currentState}</p>
          )}
          {question && (
            <p className="text-sm text-foreground leading-relaxed font-medium mt-2">{question}</p>
          )}
        </div>
      )}

      {/* Input */}
      <div className="px-5 pb-4 pt-2 flex gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit();
          }}
          placeholder={
            isPaused
              ? 'Tell the agent what to do next… (Cmd+Enter to send)'
              : 'Help the agent — describe what it should do… (Cmd+Enter to send)'
          }
          rows={2}
          className="flex-1 resize-none rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 leading-relaxed"
        />
        <button
          onClick={handleSubmit}
          disabled={!text.trim()}
          className="inline-flex items-center justify-center size-10 rounded-xl bg-primary text-primary-foreground shadow-sm transition-all hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 shrink-0 self-end"
        >
          <Send className="size-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Conclusion block ────────────────────────────────────────────────────────

function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function ConclusionBlock({ conclusion, status }: { conclusion: string; status: string }) {
  const [expanded, setExpanded] = React.useState(false);
  const cleaned = stripMarkdown(conclusion);
  const lines = cleaned.split('\n').filter(Boolean);
  const preview = lines.slice(0, 3).join('\n');
  const hasMore = lines.length > 3;

  const isPassed = status === 'passed';

  return (
    <div className={cn(
      'rounded-xl border px-4 py-3',
      isPassed ? 'bg-white border-emerald-500/40' : 'bg-white border-red-500/40'
    )}>
      <p className={cn(
        'text-[10px] font-semibold uppercase tracking-wider mb-1',
        isPassed ? 'text-emerald-600/70' : 'text-red-500/70'
      )}>
        Result
      </p>
      <p className="text-xs leading-relaxed whitespace-pre-line text-foreground">
        {expanded ? cleaned : preview}
      </p>
      {hasMore && (
        <button
          onClick={() => setExpanded((p) => !p)}
          className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? <><ChevronUp className="size-3" /> Show less</> : <><ChevronDown className="size-3" /> Show full result</>}
        </button>
      )}
    </div>
  );
}

// ─── Execute Page ─────────────────────────────────────────────────────────────

function ExecutePage() {
  const { featureId, projectId, windowTitle, featureName, runId } = Route.useSearch();
  const { token, user } = useAuthStore();
  const router = useRouter();
  const isReplayMode = !!runId;
  const { testCases } = useFeatureTestCases(featureId ?? '');
  const { runDetail } = useTestRunDetail(isReplayMode ? runId : undefined);
  const activityEndRef = React.useRef<HTMLDivElement>(null);
  const [thinkingExpanded, setThinkingExpanded] = React.useState(true);
  // null = follow live (currentTestId); string = user has pinned a specific test to view
  const [selectedTestId, setSelectedTestId] = React.useState<string | null>(null);

  const {
    status,
    tests,
    currentTestId,
    activityLog,
    thinking,
    suiteResult,
    error,
    guidanceNeeded,
    isPaused,
    isPausePending,
    isAbortPending,
    projectLearningStatus,
    projectLearningMessage,
    setInitialTests,
    startExecution,
    submitGuidance,
    pauseExecution,
    resumeExecution,
    abortExecution,
    loadPastRun,
    reset,
  } = useTestSuiteExecutionStore();

  // Reset store to idle on every fresh navigation — but not in replay mode (loadPastRun handles init)
  React.useEffect(() => {
    if (!isReplayMode) {
      reset();
      return () => reset();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Replay mode: populate store from API once data is ready
  React.useEffect(() => {
    if (isReplayMode && testCases.length > 0 && runDetail) {
      loadPastRun(testCases, runDetail);
      // Auto-select first test so the right panel is populated
      if (runDetail.results.length > 0) {
        setSelectedTestId(runDetail.results[0].test_case_id);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReplayMode, testCases.length, runDetail]);

  // Live mode: Pre-populate test list once test cases load (after reset, status is 'idle')
  React.useEffect(() => {
    if (!isReplayMode && testCases.length > 0 && status === 'idle') {
      setInitialTests(testCases);
    }
  }, [isReplayMode, testCases, status, setInitialTests]);

  // Live mode: Auto-start when params + tests are ready — never re-trigger after abort/error/complete
  React.useEffect(() => {
    if (
      !isReplayMode &&
      featureId &&
      windowTitle &&
      token &&
      status === 'idle' &&
      tests.length > 0
    ) {
      startExecution({
        featureId,
        featureName: featureName ?? '',
        windowTitle,
        provider: 'claude',
        token,
        userId: (user as { id?: string })?.id ?? '',
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReplayMode, tests.length, status]);

  // Scroll activity log to bottom on new entries (only when viewing live)
  React.useEffect(() => {
    if (!selectedTestId) {
      activityEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activityLog.length, selectedTestId]);

  const currentTest = tests.find((t) => t.id === currentTestId);
  const completedCount = tests.filter((t) => ['passed', 'failed', 'skipped'].includes(t.status)).length;
  const totalCount = tests.length;
  const progressPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const isRunning = status === 'running';
  const isDone = status === 'complete' || status === 'error' || status === 'aborted';

  // When run completes, auto-select the last test so right panel stays populated
  React.useEffect(() => {
    if (isDone && tests.length > 0 && !selectedTestId) {
      const lastRan = [...tests].reverse().find((t) => t.status !== 'pending');
      if (lastRan) setSelectedTestId(lastRan.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDone, tests.length]);

  // Which test's details + log to show in the right panel:
  // - While running with no selection: follow the live current test
  // - If user clicked a test row: show that test (historical browse mode)
  // - When done: default to the last test that ran (or whatever was selected)
  const displayedTestId = selectedTestId ?? currentTestId;
  const displayedTest = tests.find((t) => t.id === displayedTestId) ?? currentTest;

  // Log filtered to only the displayed test's entries
  const displayedLog = displayedTestId
    ? activityLog.filter((e) => e.testId === displayedTestId)
    : activityLog;

  // True when user is browsing a past test while a different test is actively running
  const isViewingHistory = isRunning && selectedTestId !== null && selectedTestId !== currentTestId;

  // Whether to show the guidance panel
  const showGuidance = isRunning && (!!guidanceNeeded || isPaused);

  const handleRunAgain = () => {
    setSelectedTestId(null);
    reset();
    if (testCases.length > 0) setInitialTests(testCases);
  };

  const backTo = isReplayMode && projectId && featureId
    ? `/app/projects/${projectId}/tests/${featureId}/runs`
    : projectId && featureId
    ? `/app/projects/${projectId}/tests/${featureId}`
    : projectId
    ? `/app/projects/${projectId}`
    : '/app';

  // ── No params state ───────────────────────────────────────────────────────
  if (!featureId || (!windowTitle && !isReplayMode)) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-6 text-center">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4">
          <Zap className="size-8" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Execution Engine</h2>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground leading-relaxed">
          Select a test suite and click "Run All Tests" to start automated test execution.
        </p>
        <Link
          to="/app"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90"
        >
          Browse Projects
        </Link>
      </div>
    );
  }

  // ── Status label helpers ──────────────────────────────────────────────────
  const statusDot = isReplayMode
    ? 'bg-primary/60'
    : isAbortPending
    ? 'bg-destructive animate-pulse'
    : isPausePending
    ? 'bg-orange-400 animate-pulse'
    : isPaused
    ? 'bg-orange-400'
    : isRunning
    ? 'bg-emerald-500 animate-pulse'
    : status === 'complete'
    ? 'bg-emerald-500'
    : status === 'aborted'
    ? 'bg-muted-foreground'
    : 'bg-red-500';

  const statusLabel = isReplayMode
    ? 'Replay'
    : isAbortPending
    ? 'Aborting…'
    : isPausePending
    ? 'Pausing after this step…'
    : isPaused
    ? 'Paused'
    : isRunning
    ? guidanceNeeded
      ? 'Waiting for guidance'
      : 'Running Tests'
    : status === 'complete'
    ? 'Run Complete'
    : status === 'aborted'
    ? 'Run Aborted'
    : 'Execution Error';

  return (
    <div className="flex min-h-0 flex-1 gap-5 overflow-hidden bg-[#fafafd] p-4">

      {/* ── Left panel: test list ── */}
      <aside className="flex w-64 shrink-0 flex-col overflow-hidden rounded-2xl border border-[#ececf1] bg-white shadow-[0_2px_8px_rgba(15,15,25,0.05)]">

        {/* Back nav */}
        <div className="px-4 pb-0 pt-4">
          <Link
            to={backTo}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            Back to test suite
          </Link>
        </div>

        {/* Header */}
        <div className="border-b border-[#ececf1] px-5 pb-4 pt-3">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn('size-2 rounded-full shrink-0', statusDot)} />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {statusLabel}
            </span>
          </div>
          <h2 className="text-base font-semibold leading-tight text-foreground line-clamp-2">
            {featureName || 'Test Suite'}
          </h2>
          {(windowTitle || isReplayMode) && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {isReplayMode ? `Run ID: ${runId?.slice(-8)}` : windowTitle}
            </p>
          )}

          {/* Progress */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-muted-foreground">Progress</span>
              <span className="text-xs font-semibold text-foreground tabular-nums">
                {completedCount} / {totalCount}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[#f5f5f8]">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  status === 'complete' && suiteResult?.failed === 0 ? 'bg-emerald-500' :
                  status === 'aborted' ? 'bg-muted-foreground' :
                  'bg-violet-500'
                )}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Suite complete banner */}
        {status === 'complete' && suiteResult && (
          <div className="mx-3 mt-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3">
            <p className="text-xs font-semibold text-emerald-600 mb-1">Run Complete</p>
            <div className="flex gap-3 text-xs">
              <span className="text-emerald-600 font-medium">{suiteResult.passed} passed</span>
              {suiteResult.failed > 0 && (
                <span className="text-red-500 font-medium">{suiteResult.failed} failed</span>
              )}
              {suiteResult.skipped > 0 && (
                <span className="text-muted-foreground">{suiteResult.skipped} skipped</span>
              )}
            </div>
          </div>
        )}

        {projectLearningStatus !== 'idle' && (
          <div className={cn(
            'mx-3 mt-3 rounded-xl border px-4 py-3 text-xs',
            projectLearningStatus === 'warning'
              ? 'border-amber-500/30 bg-amber-500/10 text-amber-700'
              : 'border-primary/20 bg-primary/5 text-primary'
          )}>
            {projectLearningStatus === 'learning'
              ? 'Updating project knowledge...'
              : projectLearningMessage}
          </div>
        )}

        {/* Aborted banner */}
        {status === 'aborted' && (
          <div className="mx-3 mt-3 rounded-xl bg-muted border border-border px-4 py-3 flex items-center gap-2">
            <Ban className="size-4 text-muted-foreground shrink-0" />
            <p className="text-xs text-muted-foreground">Run was aborted</p>
          </div>
        )}

        {/* Error banner */}
        {status === 'error' && error && (
          <div className="mx-3 mt-3 rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 flex items-start gap-2">
            <AlertCircle className="size-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-xs text-destructive leading-relaxed">{error}</p>
          </div>
        )}

        {/* Test rows */}
        <div className="flex-1 overflow-y-auto py-2">
          {tests.map((test) => {
            const isSelected = displayedTestId === test.id;
            const isClickable = test.status !== 'pending';
            return (
              <button
                key={test.id}
                disabled={!isClickable}
                onClick={() => {
                  if (!isClickable) return;
                  // Toggle: clicking the already-selected test while running snaps back to live
                  if (isSelected && isRunning) {
                    setSelectedTestId(null);
                  } else {
                    setSelectedTestId(test.id);
                  }
                }}
                className={cn(
                  'flex w-full items-center gap-3 border-l-2 px-5 py-2.5 text-left transition-colors',
                  isSelected
                    ? 'border-l-violet-500 bg-violet-500/10'
                    : test.status === 'running'
                    ? 'border-l-violet-500 bg-violet-500/5'
                    : test.status === 'failed'
                    ? 'border-l-red-500/60 hover:bg-[#fafafd]'
                    : test.status === 'passed'
                    ? 'border-l-emerald-500/40 hover:bg-[#fafafd]'
                    : 'border-l-transparent cursor-default',
                  isClickable && !isSelected && 'cursor-pointer'
                )}
              >
                <span className="font-mono text-[10px] font-semibold text-muted-foreground w-12 shrink-0">
                  {test.test_key}
                </span>
                <span className={cn(
                  'flex-1 text-xs truncate',
                  isSelected        ? 'text-primary font-semibold' :
                  test.status === 'running' ? 'text-primary font-semibold' :
                  test.status === 'passed'  ? 'text-foreground' :
                  test.status === 'failed'  ? 'text-red-500 font-medium' :
                  'text-muted-foreground'
                )}>
                  {test.title}
                </span>
                <StatusIcon status={test.status} />
              </button>
            );
          })}
        </div>

        {/* Actions footer */}
        <div className="space-y-2 border-t border-[#ececf1] p-4">
          {/* Replay mode — read-only, just a back link */}
          {isReplayMode && (
            <Link
              to={backTo}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#ececf1] px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-[#f5f5f8] hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" />
              Back to Test Suite
            </Link>
          )}

          {/* Running controls */}
          {!isReplayMode && isRunning && !isPaused && !guidanceNeeded && (
            isPausePending ? (
              /* Pending state — shown immediately on button press */
              <div className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-orange-400/40 bg-orange-500/10 px-4 py-2 text-sm font-semibold text-orange-500">
                <Loader2 className="size-4 animate-spin" />
                Pausing after this step…
              </div>
            ) : (
              <button
                onClick={() => pauseExecution()}
                className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-orange-400/40 text-orange-500 hover:bg-orange-500/10 px-4 py-2 text-sm font-semibold transition-colors"
              >
                <PauseCircle className="size-4" />
                Pause &amp; Guide
              </button>
            )
          )}
          {!isReplayMode && isRunning && (
            isAbortPending ? (
              /* Pending state — shown immediately on button press */
              <div className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm font-semibold text-destructive">
                <Loader2 className="size-4 animate-spin" />
                Aborting after this step…
              </div>
            ) : (
              <button
                onClick={() => abortExecution()}
                className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-destructive/40 text-destructive hover:bg-destructive/10 px-4 py-2 text-sm font-semibold transition-colors"
              >
                <StopCircle className="size-4" />
                Abort Run
              </button>
            )
          )}

          {/* Post-run controls (live mode only) */}
          {!isReplayMode && isDone && (
            <>
              <button
                onClick={handleRunAgain}
                className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-95"
              >
                <RotateCcw className="size-3.5" />
                Run Again
              </button>
              <Link
                to={backTo}
                className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 px-4 py-2 text-sm font-medium transition-colors"
              >
                <ArrowLeft className="size-3.5" />
                Back to Test Suite
              </Link>
            </>
          )}
        </div>
      </aside>

      {/* ── Right panel: current test + live log ── */}
      <main className="flex flex-1 flex-col overflow-hidden rounded-2xl bg-[#fafafd]">

        {/* "Back to live" banner when user is browsing history during an active run */}
        {isViewingHistory && (
          <div className="flex items-center justify-between px-8 py-2.5 bg-primary/5 border-b border-primary/20">
            <div className="flex items-center gap-2 text-xs text-primary font-medium">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
              A test is running — you're viewing history
            </div>
            <button
              onClick={() => setSelectedTestId(null)}
              className="inline-flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline"
            >
              <PlayCircle className="size-3.5" />
              Back to live
            </button>
          </div>
        )}

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto flex flex-col">

          {/* Test header */}
          {displayedTest ? (
            <div className="px-2 pb-5 pt-1">
              {/* Key + test number + status badge in one row */}
              <div className="flex items-center gap-2 mb-2.5 flex-wrap">
                <span className="font-mono text-xs font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                  {displayedTest.test_key}
                </span>
                <span className="text-xs text-muted-foreground/60">
                  Test {displayedTest.test_number ?? '—'} of {totalCount}
                </span>
                {displayedTest.status === 'passed' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 border border-emerald-500/20">
                    <CheckCircle2 className="size-3" /> Passed
                  </span>
                )}
                {displayedTest.status === 'failed' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-500 border border-red-500/20">
                    <XCircle className="size-3" /> Failed
                  </span>
                )}
                {displayedTest.status === 'skipped' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground border border-border">
                    <Minus className="size-3" /> Skipped
                  </span>
                )}
                {displayedTest.status === 'running' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary border border-primary/20">
                    <Loader2 className="size-3 animate-spin" /> Running
                  </span>
                )}
              </div>

              {/* Title */}
              <h1 className="mb-1.5 text-xl font-semibold leading-snug text-foreground">
                {displayedTest.title}
              </h1>
              {displayedTest.goal && (
                <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
                  {displayedTest.goal}
                </p>
              )}

              {/* Expected + Result — compact row cards */}
              <div className="w-full space-y-2">
                {displayedTest.expected_result && (
                  <div className="flex items-start gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/3 px-4 py-3">
                    <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600/70 mb-0.5">Expected</p>
                      <p className="text-xs text-foreground leading-relaxed">{displayedTest.expected_result}</p>
                    </div>
                  </div>
                )}
                {displayedTest.conclusion && (
                  <ConclusionBlock
                    conclusion={displayedTest.conclusion}
                    status={displayedTest.status}
                  />
                )}
              </div>
            </div>
          ) : status === 'complete' && suiteResult ? (
            <div className="px-8 pt-6 pb-5 border-b border-border">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Execution Complete
              </p>
              <h1 className="text-xl font-bold text-foreground mb-3">
                {suiteResult.failed === 0 ? 'All Tests Passed' : `${suiteResult.failed} Test${suiteResult.failed !== 1 ? 's' : ''} Failed`}
              </h1>
              <div className="flex gap-2">
                <span className="text-xs font-medium text-emerald-600 bg-emerald-500/10 rounded-full px-3 py-1">
                  {suiteResult.passed} passed
                </span>
                {suiteResult.failed > 0 && (
                  <span className="text-xs font-medium text-red-500 bg-red-500/10 rounded-full px-3 py-1">
                    {suiteResult.failed} failed
                  </span>
                )}
              </div>
            </div>
          ) : status === 'aborted' ? (
            <div className="px-8 pt-6 pb-5 border-b border-border">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Run Aborted</p>
              <h1 className="text-xl font-bold text-foreground mb-1">Execution stopped</h1>
              <p className="text-sm text-muted-foreground">
                {completedCount > 0
                  ? `Completed ${completedCount} of ${totalCount} tests before stopping.`
                  : 'No tests were completed.'}
              </p>
            </div>
          ) : status === 'error' ? (
            <div className="px-8 pt-6 pb-5 border-b border-border">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Execution Error</p>
              <h1 className="text-xl font-bold text-foreground mb-1">Something went wrong</h1>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-lg">{error}</p>
            </div>
          ) : (
            <div className="px-8 pt-6 pb-5 border-b border-border">
              <div className="flex items-center gap-2">
                <Loader2 className="size-4 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground">Initializing execution…</p>
              </div>
            </div>
          )}

          {/* Activity log */}
          <div className="flex min-h-0 flex-1 flex-col px-2 py-5">
            <div className="flex flex-col overflow-hidden rounded-2xl border border-[#ececf1] bg-white shadow-[0_2px_8px_rgba(15,15,25,0.05)]" style={{ minHeight: 260 }}>
              {/* Log header */}
              <div className="flex shrink-0 items-center justify-between border-b border-[#ececf1] px-5 py-3">
                <div className="flex items-center gap-2">
                  <ListChecks className="size-3.5 text-muted-foreground" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Activity Log
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {isReplayMode && (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-violet-600">
                      <span className="inline-block size-1.5 rounded-full bg-violet-500" />
                      Replay
                    </span>
                  )}
                  {!isReplayMode && isRunning && !isViewingHistory && !isPaused && !guidanceNeeded && (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-600">
                      <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                      Live
                    </span>
                  )}
                  {(isPaused || !!guidanceNeeded) && !isViewingHistory && (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-orange-500">
                      <PauseCircle className="size-3" />
                      Waiting for you
                    </span>
                  )}
                  {displayedLog.length > 0 && (
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      {displayedLog.length} action{displayedLog.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>

              {/* Log entries */}
              <div className="overflow-y-auto px-5 py-3">
                {displayedLog.length === 0 && isRunning && !isViewingHistory && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
                    <Loader2 className="size-3 animate-spin" />
                    Waiting for first action…
                  </div>
                )}
                {displayedLog.length === 0 && (isDone || isViewingHistory || isReplayMode) && (
                  <p className="text-xs text-muted-foreground py-4">No actions recorded for this test.</p>
                )}
                <div className="space-y-0.5">
                  {displayedLog.map((entry, i) => (
                    <div key={entry.id} className="flex items-start gap-3 py-2 rounded-lg hover:bg-muted/30 transition-colors group">
                      {/* Action icon */}
                      <ActivityIcon type={entry.type} success={entry.success} />
                      {/* Description */}
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          'text-xs leading-relaxed',
                          entry.success ? 'text-foreground' : 'text-muted-foreground'
                        )}>
                          {entry.description}
                        </p>
                        {entry.confidence === 'low' && entry.type !== 'guidance' && (
                          <span className="mt-1 inline-flex items-center rounded-full bg-yellow-400/15 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-600 border border-yellow-400/30">
                            low confidence
                          </span>
                        )}
                      </div>
                      {/* Step number + timestamp on hover */}
                      <span className="font-mono text-[9px] text-muted-foreground/40 shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity tabular-nums select-none">
                        step {i + 1}
                      </span>
                    </div>
                  ))}
                </div>
                <div ref={activityEndRef} />
              </div>
            </div>
          </div>

          {/* Guidance panel — shown when stuck or manually paused (live mode only) */}
          {!isReplayMode && showGuidance && (
            <GuidancePanel
              question={guidanceNeeded?.question}
              currentState={guidanceNeeded?.currentState}
              isPaused={isPaused}
              onSubmit={(guidance) => {
                if (isPaused) {
                  resumeExecution(guidance);
                } else {
                  submitGuidance(guidance);
                }
              }}
            />
          )}

          {/* Skip guidance / resume */}
          {!isReplayMode && isRunning && (isPaused || !!guidanceNeeded) && (
            <div className="px-8 pb-5 flex items-center justify-end gap-3">
              <span className="text-xs text-muted-foreground">Don't need to guide?</span>
              <button
                onClick={() => {
                  if (isPaused) {
                    resumeExecution();
                  } else {
                    submitGuidance('Continue on your own best judgement.');
                  }
                }}
                className="inline-flex items-center gap-2 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 px-4 py-1.5 text-sm font-medium transition-colors"
              >
                <PlayCircle className="size-4" />
                Skip &amp; Resume
              </button>
            </div>
          )}

          {/* AI Reasoning (thinking) — live mode only */}
          {!isReplayMode && (thinking || (isRunning && activityLog.length > 0)) && (
            <div className="px-8 pb-5">
              <div className="rounded-2xl border border-border bg-card overflow-hidden">
                <button
                  onClick={() => setThinkingExpanded((p) => !p)}
                  className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-muted/20 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex size-5 items-center justify-center rounded-full bg-primary/10">
                      <Zap className="size-3 text-primary" />
                    </div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {thinking ? 'Thinking…' : 'AI Reasoning'}
                    </span>
                    {thinking && (
                      <span className="flex gap-0.5">
                        {[0, 1, 2].map((i) => (
                          <span
                            key={i}
                            className="size-1 rounded-full bg-primary animate-bounce"
                            style={{ animationDelay: `${i * 0.15}s` }}
                          />
                        ))}
                      </span>
                    )}
                  </div>
                  {thinkingExpanded ? (
                    <ChevronUp className="size-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="size-4 text-muted-foreground" />
                  )}
                </button>
                {thinkingExpanded && thinking && (
                  <div className="px-5 pb-4 border-t border-border">
                    <p className="text-xs text-muted-foreground italic leading-relaxed mt-3">
                      {thinking}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>{/* end scrollable content */}
      </main>
    </div>
  );
}
