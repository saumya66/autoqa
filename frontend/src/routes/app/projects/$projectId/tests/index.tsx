import * as React from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Plus, FlaskConical, ChevronRight, CheckCircle2, Loader2, Circle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { CreateTestFlow } from '@/components/CreateTestFlow';
import { useProject, useProjectFeatures } from '@/hooks/useProjectsQueries';
import { cn } from '@/lib/utils';
import type { Feature } from '@/api/client';

export const Route = createFileRoute('/app/projects/$projectId/tests/')({
  component: TestSuitesPage,
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
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function StatusIndicator({ status }: { status: string }) {
  if (status === 'tests_generated') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700">
        <CheckCircle2 className="size-3" />
        Tests ready
      </span>
    );
  }
  if (status === 'context_ready') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-700">
        <CheckCircle2 className="size-3" />
        Context ready
      </span>
    );
  }
  if (status === 'processing') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700">
        <Loader2 className="size-3.5 animate-spin" />
        Processing
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f5f5f8] px-2.5 py-1 text-xs font-medium text-muted-foreground">
      <Circle className="size-3" />
      Pending
    </span>
  );
}

function FeatureRow({ feature, projectId, index }: { feature: Feature; projectId: string; index: number }) {
  return (
    <Link
      to="/app/projects/$projectId/tests/$featureId"
      params={{ projectId, featureId: feature.id }}
      className={cn(
        'group grid grid-cols-[1fr_auto_auto_auto] items-center gap-5 px-6 py-4 transition-colors hover:bg-[#fafafd]',
        index !== 0 && 'border-t border-[#ececf1]'
      )}
    >
      {/* Suite name + description */}
      <div className="flex items-center gap-4 min-w-0">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600">
          <FlaskConical className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground transition-colors group-hover:text-violet-700">
            {feature.name}
          </p>
          {feature.description && (
            <p className="truncate text-xs text-muted-foreground mt-0.5">{feature.description}</p>
          )}
        </div>
      </div>

      {/* Status */}
      <div className="shrink-0">
        <StatusIndicator status={feature.status} />
      </div>

      {/* Created */}
      <span className="min-w-14 text-right text-xs text-muted-foreground">{relativeTime(feature.created_at)}</span>

      {/* Chevron */}
      <ChevronRight className="size-4 shrink-0 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-violet-600" />
    </Link>
  );
}

function TestSuitesPage() {
  const { projectId } = Route.useParams();
  const { project } = useProject(projectId);
  const { features, loading, refetch } = useProjectFeatures(projectId);
  const [createTestOpen, setCreateTestOpen] = React.useState(false);

  if (!project) return null;

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col overflow-auto p-6">
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
              <Link
                to="/app/projects/$projectId"
                params={{ projectId }}
                className="text-muted-foreground hover:text-foreground"
              >
                {project.name}
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Test Suites</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Page header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-light tracking-tight text-foreground">Test Suites</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {loading ? (
              <span className="animate-pulse">Loading…</span>
            ) : (
              <>
                Manage and monitor automated test flows for{' '}
                <span className="font-medium text-foreground">{project.name}</span>
              </>
            )}
          </p>
        </div>
        <button
          onClick={() => setCreateTestOpen(true)}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[#111114] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-[#29292f] active:scale-95"
        >
          <Plus className="size-4" />
          New Test Suite
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="overflow-hidden rounded-2xl border border-[#ececf1] bg-white shadow-[0_2px_8px_rgba(15,15,25,0.05)]">
          {[...Array(3)].map((_, i) => (
            <div key={i} className={cn('flex items-center gap-4 px-6 py-4', i !== 0 && 'border-t border-[#ececf1]')}>
              <div className="size-9 shrink-0 animate-pulse rounded-xl bg-[#f5f5f8]" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-48 rounded bg-muted animate-pulse" />
                <div className="h-3 w-72 rounded bg-muted animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : features.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-[#d9d9e1] bg-white p-16 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-600">
            <FlaskConical className="size-8" />
          </div>
          <h2 className="mt-5 text-base font-semibold text-foreground">No test suites yet</h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground leading-relaxed">
            Create your first test suite and let AI generate test cases from your app's context.
          </p>
          <button
            onClick={() => setCreateTestOpen(true)}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#111114] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-[#29292f]"
          >
            <Plus className="size-4" />
            Create First Suite
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#ececf1] bg-white shadow-[0_2px_8px_rgba(15,15,25,0.05)]">
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-5 border-b border-[#ececf1] bg-[#fafafd] px-6 py-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Suite Name
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Status
            </span>
            <span className="min-w-14 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Created</span>
            <span className="w-4" />
          </div>

          {/* Rows */}
          {features.map((feature, i) => (
            <FeatureRow key={feature.id} feature={feature} projectId={projectId} index={i} />
          ))}
        </div>
      )}

      {/* New Test Suite Dialog */}
      <Dialog open={createTestOpen} onOpenChange={setCreateTestOpen}>
        <DialogContent className="h-[min(88vh,540px)] max-w-4xl w-[95vw] overflow-hidden p-0">
          <div className="flex flex-1 min-h-0 overflow-hidden">
            <CreateTestFlow onClose={() => { setCreateTestOpen(false); refetch(); }} projectId={projectId} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
