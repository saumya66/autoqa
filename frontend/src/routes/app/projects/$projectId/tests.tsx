import * as React from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Plus, FlaskConical, Clock, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

export const Route = createFileRoute('/app/projects/$projectId/tests')({
  component: TestSuitesPage,
});

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function statusBadgeClass(status: string) {
  switch (status) {
    case 'completed':
      return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
    case 'processing':
      return 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
    case 'ready':
      return 'bg-blue-500/10 text-blue-600 dark:text-blue-400';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function FeatureRow({ feature }: { feature: Feature }) {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/40">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <FlaskConical className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{feature.name}</p>
        {feature.description && (
          <p className="truncate text-xs text-muted-foreground">{feature.description}</p>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span
          className={cn(
            'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium capitalize',
            statusBadgeClass(feature.status)
          )}
        >
          {feature.status}
        </span>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="size-3" />
          {formatDate(feature.created_at)}
        </div>
      </div>
    </div>
  );
}

function TestSuitesPage() {
  const { projectId } = Route.useParams();
  const { project } = useProject(projectId);
  const { features, loading } = useProjectFeatures(projectId);
  const [createTestOpen, setCreateTestOpen] = React.useState(false);

  if (!project) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto p-6">
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
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Test Suites</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {loading ? (
              <span className="animate-pulse">Loading…</span>
            ) : (
              <>
                {features.length} suite{features.length !== 1 ? 's' : ''} in{' '}
                <span className="font-medium text-foreground">{project.name}</span>
              </>
            )}
          </p>
        </div>
        <Button className="shrink-0" onClick={() => setCreateTestOpen(true)}>
          <Plus className="size-4" />
          New Test Suite
        </Button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground animate-pulse">Loading test suites…</p>
        </div>
      ) : features.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 p-12 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <FlaskConical className="size-7" />
          </div>
          <h2 className="mt-4 text-base font-semibold text-foreground">No test suites yet</h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Create your first test suite and let AI generate test cases from your context.
          </p>
          <Button className="mt-6" onClick={() => setCreateTestOpen(true)}>
            <Plus className="size-4" />
            Create First Suite
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {features.map((feature) => (
            <FeatureRow key={feature.id} feature={feature} />
          ))}
        </div>
      )}

      {/* Back link */}
      <div className="mt-6">
        <Link
          to="/app/projects/$projectId"
          params={{ projectId }}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowRight className="size-3.5 rotate-180" />
          Back to overview
        </Link>
      </div>

      {/* New Test Suite Dialog */}
      <Dialog open={createTestOpen} onOpenChange={setCreateTestOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] w-[95vw] overflow-hidden flex flex-col p-0">
          <div className="flex-1 overflow-y-auto min-h-0">
            <CreateTestFlow onClose={() => setCreateTestOpen(false)} projectId={projectId} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
