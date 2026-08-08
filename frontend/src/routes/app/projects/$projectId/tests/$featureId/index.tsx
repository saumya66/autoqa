import * as React from 'react';
import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import {
  FlaskConical,
  Clock,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Play,
  Sparkles,
  AlertCircle,
  ListChecks,
  Zap,
  RefreshCw,
  Monitor,
  CheckCircle2,
  XCircle,
  X,
  History,
} from 'lucide-react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { useProject, useProjectFeatures, useFeatureTestCases, useFeatureTestRuns } from '@/hooks/useProjectsQueries';
import { useWindows } from '@/hooks';
import { cn } from '@/lib/utils';
import type { CloudTestCase, WindowInfo } from '@/api/client';

export const Route = createFileRoute('/app/projects/$projectId/tests/$featureId/')({
  component: FeatureDetailPage,
});

function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function priorityAccentBorder(priority: string | null | undefined) {
  switch (priority) {
    case 'critical': return 'border-l-red-500';
    case 'high':     return 'border-l-orange-400';
    case 'medium':   return 'border-l-amber-400';
    case 'low':      return 'border-l-green-500';
    default:         return 'border-l-border';
  }
}

function priorityBadge(priority: string | null | undefined) {
  switch (priority) {
    case 'critical': return 'bg-red-500/10 text-red-500';
    case 'high':     return 'bg-orange-500/10 text-orange-500';
    case 'medium':   return 'bg-amber-500/10 text-amber-500';
    case 'low':      return 'bg-green-500/10 text-green-600';
    default:         return 'bg-muted text-muted-foreground';
  }
}

function categoryBadge(category: string | null | undefined) {
  switch (category) {
    case 'functional':   return 'bg-primary/10 text-primary';
    case 'negative':     return 'bg-red-500/10 text-red-400';
    case 'ui':           return 'bg-purple-500/10 text-purple-500';
    case 'edge_case':    return 'bg-amber-500/10 text-amber-500';
    case 'accessibility':return 'bg-teal-500/10 text-teal-500';
    default:             return 'bg-muted text-muted-foreground';
  }
}

const PRIORITY_META: { key: string; label: string; dot: string }[] = [
  { key: 'critical', label: 'Critical Priority', dot: 'bg-red-500' },
  { key: 'high',     label: 'High Priority',     dot: 'bg-orange-400' },
  { key: 'medium',   label: 'Medium Priority',   dot: 'bg-amber-400' },
  { key: 'low',      label: 'Low Priority',      dot: 'bg-green-500' },
];

function TestCaseCard({ tc }: { tc: CloudTestCase }) {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-[#ececf1] border-l-4 bg-white shadow-[0_2px_8px_rgba(15,15,25,0.04)] transition-shadow hover:shadow-[0_4px_12px_rgba(15,15,25,0.08)]',
        priorityAccentBorder(tc.priority)
      )}
    >
      <button
        onClick={() => setExpanded((p) => !p)}
        className="flex w-full items-start gap-4 px-4 py-3.5 text-left transition-colors hover:bg-[#fafafd]"
      >
        <span className="shrink-0 font-mono text-[11px] font-semibold text-muted-foreground mt-0.5 w-12">
          {tc.test_key}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            {tc.category && (
              <span className={cn('px-2 py-0.5 text-[11px] font-medium rounded-full uppercase tracking-wide', categoryBadge(tc.category))}>
                {tc.category.replace('_', ' ')}
              </span>
            )}
            <span className={cn('px-2 py-0.5 text-[11px] font-medium rounded-full uppercase tracking-wide', priorityBadge(tc.priority))}>
              {tc.priority ?? 'medium'}
            </span>
          </div>
          <p className="text-sm font-semibold text-foreground leading-snug">{tc.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{tc.goal}</p>
        </div>
        <div className="shrink-0 text-muted-foreground mt-0.5">
          {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </div>
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-[#ececf1] px-4 pb-4 pt-3">
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Test Objective
            </p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{tc.goal}</p>
          </div>
          {tc.expected_result && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Expected Result
              </p>
              <p className="text-sm text-emerald-600 leading-relaxed">{tc.expected_result}</p>
            </div>
          )}
          {tc.created_at && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Clock className="size-3" />
              Added {relativeTime(tc.created_at)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function SidebarSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4 animate-pulse">
      <div className="h-4 w-32 rounded bg-muted" />
      <div className="h-10 w-16 rounded bg-muted" />
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => <div key={i} className="h-3 rounded bg-muted" />)}
      </div>
    </div>
  );
}

// ─── Window Picker Modal ──────────────────────────────────────────────────────

function WindowRow({
  window: w,
  selected,
  onSelect,
}: {
  window: WindowInfo;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-3 text-left border-l-2 transition-all',
        selected
          ? 'border-l-primary bg-primary/5'
          : 'border-l-transparent hover:bg-muted/40'
      )}
    >
      <div className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-lg',
        selected ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
      )}>
        <Monitor className="size-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-semibold truncate', selected ? 'text-primary' : 'text-foreground')}>
          {w.app_name} — {w.title}
        </p>
        <p className="text-xs text-muted-foreground truncate mt-0.5">{w.title}</p>
      </div>
      {selected && (
        <div className="shrink-0 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <CheckCircle2 className="size-3.5" />
        </div>
      )}
    </button>
  );
}

function RunAllTestsModal({
  open,
  onClose,
  featureName,
  testCount,
  onStart,
}: {
  open: boolean;
  onClose: () => void;
  featureName: string;
  testCount: number;
  onStart: (windowTitle: string) => void;
}) {
  const { windows, loading, refetch } = useWindows();
  const [selected, setSelected] = React.useState<WindowInfo | null>(null);

  React.useEffect(() => {
    if (!open) setSelected(null);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden gap-0">
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4">
          <div>
            <h2 className="text-lg font-bold text-foreground">Run All Tests</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {featureName} · {testCount} test{testCount !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Target Window section */}
        <div className="px-6 pb-3">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Target Window
            </span>
            <button
              onClick={() => refetch()}
              disabled={loading}
              className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={cn('size-3', loading && 'animate-spin')} />
              Refresh
            </button>
          </div>
        </div>

        {/* Window list */}
        <div className="border-t border-b border-border max-h-52 overflow-y-auto">
          {loading ? (
            <div className="space-y-0">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 border-l-2 border-l-transparent">
                  <div className="size-8 rounded-lg bg-muted animate-pulse shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 w-40 rounded bg-muted animate-pulse" />
                    <div className="h-3 w-56 rounded bg-muted animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : windows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center px-4">
              <Monitor className="size-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">No open windows found</p>
              <button onClick={() => refetch()} className="mt-2 text-xs text-primary hover:underline">
                Try refreshing
              </button>
            </div>
          ) : (
            windows.map((w) => (
              <WindowRow
                key={w.id}
                window={w}
                selected={selected?.id === w.id}
                onSelect={() => setSelected(w)}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-muted/20">
          <button
            onClick={onClose}
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => selected && onStart(selected.title)}
            disabled={!selected}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
          >
            <Play className="size-3.5 fill-current" />
            Start Execution
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function FeatureDetailPage() {
  const { projectId, featureId } = Route.useParams();
  const router = useRouter();
  const { project } = useProject(projectId);
  const { features } = useProjectFeatures(projectId);
  const { testCases, loading, error } = useFeatureTestCases(featureId);
  const { runs } = useFeatureTestRuns(featureId);
  const [runModalOpen, setRunModalOpen] = React.useState(false);

  const feature = features.find((f) => f.id === featureId);
  const lastRun = runs[0] ?? null;

  const priorityCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const tc of testCases) {
      const p = tc.priority ?? 'medium';
      counts[p] = (counts[p] ?? 0) + 1;
    }
    return counts;
  }, [testCases]);

  const handleStartExecution = (windowTitle: string) => {
    setRunModalOpen(false);
    router.navigate({
      to: '/app/execute',
      search: {
        featureId,
        projectId,
        windowTitle,
        featureName: feature?.name ?? '',
      },
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto p-6">
      <div className="mx-auto w-full max-w-6xl">
        {/* Breadcrumb */}
        <Breadcrumb className="mb-6">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/app" className="text-muted-foreground hover:text-foreground">
                  Projects
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/app/projects/$projectId" params={{ projectId }} className="text-muted-foreground hover:text-foreground">
                  {project?.name ?? '…'}
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/app/projects/$projectId/tests" params={{ projectId }} className="text-muted-foreground hover:text-foreground">
                  Test Suites
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{feature?.name ?? '…'}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Page header */}
        <div className="mb-8 flex items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2">
              <div className="flex size-9 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600">
                <FlaskConical className="size-4" />
              </div>
              <h1 className="font-serif text-3xl font-light tracking-tight text-foreground leading-tight">
              {feature?.name ?? 'Test Suite'}
              </h1>
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700">Active</span>
            </div>
            {feature?.description && (
              <p className="mt-2 text-sm text-muted-foreground max-w-xl leading-relaxed">
                {feature.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/app/projects/$projectId/tests/$featureId/runs"
              params={{ projectId, featureId }}
              className="inline-flex items-center gap-2 rounded-lg border border-[#ececf1] bg-white px-4 py-2 text-sm font-medium text-muted-foreground transition-all hover:bg-[#f5f5f8] hover:text-foreground active:scale-95"
            >
              <History className="size-3.5" />
              Past Runs
            </Link>
            <button
              onClick={() => setRunModalOpen(true)}
              disabled={testCases.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-[#111114] px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-[#29292f] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40 active:scale-95"
            >
              <Play className="size-3.5 fill-current" />
              Run All Tests
            </button>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-x-7 gap-y-3">
          <div className="border-r border-[#ececf1] pr-7">
            <p className="text-2xl font-light tabular-nums text-foreground">{testCases.length}</p>
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Total tests</p>
          </div>
          {PRIORITY_META.map(({ key, label, dot }) => (
            <div key={key} className="border-r border-[#ececf1] pr-7 last:border-r-0 last:pr-0">
              <p className="text-2xl font-light tabular-nums text-foreground">{priorityCounts[key] ?? 0}</p>
              <p className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                <span className={cn('size-1.5 rounded-full', dot)} />
                {label.replace(' Priority', '')}
              </p>
            </div>
          ))}
        </div>

        {/* Two-column layout */}
        <div className="flex gap-6 items-start">

          {/* ── Left: test cases ── */}
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="rounded-xl border border-border border-l-4 border-l-muted bg-card px-4 py-3.5 animate-pulse space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-12 rounded bg-muted" />
                      <div className="h-4 w-24 rounded bg-muted" />
                    </div>
                    <div className="h-4 w-56 rounded bg-muted" />
                    <div className="h-3 w-80 rounded bg-muted" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 flex items-center gap-3">
                <AlertCircle className="size-5 text-destructive shrink-0" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            ) : testCases.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 p-16 text-center">
                <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <ListChecks className="size-8" />
                </div>
                <h2 className="mt-5 text-base font-semibold text-foreground">No test cases yet</h2>
                <p className="mt-2 max-w-xs text-sm text-muted-foreground leading-relaxed">
                  Use the test creation flow to generate AI-powered test cases for this suite.
                </p>
                <Link
                  to="/app/projects/$projectId/tests"
                  params={{ projectId }}
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90"
                >
                  <Sparkles className="size-4" />
                  Generate with AI
                </Link>
              </div>
            ) : (
              <div className="space-y-2.5">
                {testCases.map((tc) => (
                  <TestCaseCard key={tc.id ?? tc.test_key} tc={tc} />
                ))}
              </div>
            )}
          </div>

          {/* ── Right: sidebar ── */}
          <div className="sticky top-0 flex w-72 shrink-0 flex-col gap-4">

            {/* Suite Statistics card */}
            {loading ? (
              <SidebarSkeleton />
            ) : (
              <div className="rounded-2xl border border-[#ececf1] bg-white p-5 shadow-[0_2px_8px_rgba(15,15,25,0.05)]">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-semibold text-foreground">Suite Statistics</span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
                    <span className="size-1.5 rounded-full bg-emerald-500 inline-block" />
                    Live
                  </span>
                </div>

                <div className="mb-4">
                  <span className="text-5xl font-light text-foreground tabular-nums tracking-tighter leading-none">
                    {testCases.length}
                  </span>
                  <span className="ml-2 text-sm font-medium text-muted-foreground">Total Tests</span>
                </div>

                <div className="space-y-2.5">
                  {PRIORITY_META.map(({ key, label, dot }) => (
                    priorityCounts[key] ? (
                      <div key={key} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={cn('size-2 rounded-full shrink-0', dot)} />
                          <span className="text-xs text-muted-foreground">{label}</span>
                        </div>
                        <span className={cn(
                          'text-xs font-bold rounded-full px-2 py-0.5 tabular-nums',
                          key === 'critical' ? 'bg-red-500/10 text-red-500' :
                          key === 'high'     ? 'bg-orange-500/10 text-orange-500' :
                          key === 'medium'   ? 'bg-amber-500/10 text-amber-500' :
                                              'bg-green-500/10 text-green-600'
                        )}>
                          {priorityCounts[key]}
                        </span>
                      </div>
                    ) : null
                  ))}
                </div>

                {feature?.context_summary && (
                  <div className="mt-5 border-t border-[#ececf1] pt-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                      <Sparkles className="size-3" />
                      Context Summary
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-5">
                      {feature.context_summary}
                    </p>
                  </div>
                )}

                {feature?.updated_at && (
                  <div className="mt-4 flex items-center justify-between border-t border-[#ececf1] pt-3">
                    <span className="text-[11px] text-muted-foreground">
                      Updated {relativeTime(feature.updated_at)}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                      <span className="size-1.5 rounded-full bg-emerald-500 inline-block" />
                      Sync Active
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Past Runs card */}
            <div className="rounded-2xl border border-[#ececf1] bg-white p-5 shadow-[0_2px_8px_rgba(15,15,25,0.05)]">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold text-foreground">Past Runs</span>
                <div className="flex size-7 items-center justify-center rounded-lg bg-muted">
                  <History className="size-3.5 text-muted-foreground" />
                </div>
              </div>

              <div className="mb-4">
                <span className="text-5xl font-light text-foreground tabular-nums tracking-tighter leading-none">
                  {runs.length}
                </span>
                <span className="ml-2 text-sm font-medium text-muted-foreground">
                  {runs.length === 1 ? 'run' : 'runs'}
                </span>
              </div>

              {lastRun ? (
                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Last run</span>
                    <span className="font-medium text-foreground">{relativeTime(lastRun.created_at)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Result</span>
                    {lastRun.status === 'completed' ? (
                      lastRun.failed === 0 ? (
                        <span className="inline-flex items-center gap-1 font-medium text-emerald-600">
                          <CheckCircle2 className="size-3" /> All passed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-medium text-red-500">
                          <XCircle className="size-3" /> {lastRun.failed} failed
                        </span>
                      )
                    ) : (
                      <span className="text-muted-foreground capitalize">{lastRun.status}</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Tests</span>
                    <span className="font-medium text-foreground">{lastRun.total_tests} total</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                  No runs yet. Execute your test suite to see history here.
                </p>
              )}

              <Link
                to="/app/projects/$projectId/tests/$featureId/runs"
                params={{ projectId, featureId }}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#ececf1] py-2 text-xs font-semibold text-foreground transition-colors hover:bg-[#f5f5f8]"
              >
                View All Runs
                <ChevronRight className="size-3.5" />
              </Link>
            </div>

          </div>
        </div>
      </div>

      {/* Run All Tests Modal */}
      <RunAllTestsModal
        open={runModalOpen}
        onClose={() => setRunModalOpen(false)}
        featureName={feature?.name ?? 'Test Suite'}
        testCount={testCases.length}
        onStart={handleStartExecution}
      />
    </div>
  );
}
