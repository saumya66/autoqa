import * as React from 'react';
import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import {
  FlaskConical,
  BookText,
  Info,
  ChevronRight,
  Plus,
  CalendarDays,
  FileText,
} from 'lucide-react';
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

export const Route = createFileRoute('/app/projects/$projectId/')({
  component: ProjectBentoPage,
});

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function ProjectBentoPage() {
  const { projectId } = Route.useParams();
  const router = useRouter();
  const { project } = useProject(projectId);
  const { features, loading: featuresLoading } = useProjectFeatures(projectId);
  const [createTestOpen, setCreateTestOpen] = React.useState(false);

  if (!project) return null;

  const previewFeatures = features.slice(0, 3);

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
            <BreadcrumbPage>{project.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Page header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{project.name}</h1>
          {project.description && (
            <p className="mt-1 text-sm text-muted-foreground">{project.description}</p>
          )}
        </div>
        <Button
          className="shrink-0"
          onClick={() => setCreateTestOpen(true)}
        >
          <Plus className="size-4" />
          New Test Suite
        </Button>
      </div>

      {/* Bento grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Card 1 — Test Suites (clickable) */}
        <button
          onClick={() => router.navigate({ to: '/app/projects/$projectId/tests', params: { projectId } })}
          className={cn(
            'group relative flex flex-col rounded-xl border border-border bg-card p-5 text-left',
            'transition-all duration-200 hover:border-primary/40 hover:shadow-md',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'sm:col-span-1'
          )}
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FlaskConical className="size-5" />
            </div>
            <ChevronRight className="size-4 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary" />
          </div>
          <h2 className="text-base font-semibold text-foreground">Test Suites</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {featuresLoading ? (
              <span className="animate-pulse">Loading…</span>
            ) : (
              <>
                {features.length} suite{features.length !== 1 ? 's' : ''}
              </>
            )}
          </p>
          {previewFeatures.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {previewFeatures.map((f) => (
                <span
                  key={f.id}
                  className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                >
                  {f.name}
                </span>
              ))}
              {features.length > 3 && (
                <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  +{features.length - 3} more
                </span>
              )}
            </div>
          )}
        </button>

        {/* Card 2 — Project Context (navigable) */}
        <button
          onClick={() => router.navigate({ to: '/app/projects/$projectId/context', params: { projectId } })}
          className={cn(
            'group relative flex flex-col rounded-xl border border-border bg-card p-5 text-left',
            'transition-all duration-200 hover:border-violet-500/40 hover:shadow-md',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'sm:col-span-1 lg:col-span-2'
          )}
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="flex size-10 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
              <BookText className="size-5" />
            </div>
            <ChevronRight className="size-4 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-violet-500" />
          </div>
          <h2 className="text-base font-semibold text-foreground">Project Context</h2>
          {project.context_summary ? (
            <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
              {project.context_summary}
            </p>
          ) : (
            <div className="mt-1 flex flex-col items-start gap-2">
              <p className="text-sm text-muted-foreground">No context added yet.</p>
              <p className="flex items-start gap-1.5 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                Click to add images or text to generate a rich context summary.
              </p>
            </div>
          )}
        </button>

        {/* Card 3 — Quick Info */}
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 sm:col-span-2 lg:col-span-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Info className="size-5" />
            </div>
            <h2 className="text-base font-semibold text-foreground">Quick Info</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarDays className="size-4 shrink-0" />
              <span>
                Created <span className="text-foreground font-medium">{formatDate(project.created_at)}</span>
              </span>
            </div>
            {project.description ? (
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <FileText className="mt-0.5 size-4 shrink-0" />
                <span className="line-clamp-2">{project.description}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="size-4 shrink-0" />
                <span className="italic">No description</span>
              </div>
            )}
          </div>
        </div>
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
