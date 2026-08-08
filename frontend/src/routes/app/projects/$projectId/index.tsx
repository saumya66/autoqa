import * as React from 'react';
import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import {
  FlaskConical,
  Plus,
  ArrowUpRight,
  Sparkles,
  CheckCircle2,
  Circle,
  ChevronRight,
  Pencil,
  RefreshCw,
  BookText,
  ImageIcon,
  FileText,
  Clock3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { CreateTestFlow } from '@/components/CreateTestFlow';
import {
  useProject,
  useProjectContextItems,
  useProjectFeatures,
  useUpdateProject,
} from '@/hooks/useProjectsQueries';
import { ProjectContextModal } from './context';
import { cn } from '@/lib/utils';
import type { Feature } from '@/api/client';

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

function FeatureStatusDot({ status }: { status?: string }) {
  const isReady = status === 'context_ready' || status === 'tests_generated';
  return isReady
    ? <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
    : <Circle className="size-3.5 text-muted-foreground/40 shrink-0" />;
}

function ProjectBentoPage() {
  const { projectId } = Route.useParams();
  const router = useRouter();
  const { project } = useProject(projectId);
  const { features, loading: featuresLoading } = useProjectFeatures(projectId);
  const { contextItems } = useProjectContextItems(projectId);
  const updateProjectMutation = useUpdateProject();
  const [createTestOpen, setCreateTestOpen] = React.useState(false);
  const [contextModalOpen, setContextModalOpen] = React.useState(false);
  const [fullContextOpen, setFullContextOpen] = React.useState(false);
  const [fullMemoryOpen, setFullMemoryOpen] = React.useState(false);
  const [memoryModalOpen, setMemoryModalOpen] = React.useState(false);
  const [projectModalOpen, setProjectModalOpen] = React.useState(false);
  const [memory, setMemory] = React.useState('');
  const [projectName, setProjectName] = React.useState('');
  const [projectDescription, setProjectDescription] = React.useState('');

  if (!project) return null;

  const hasContext = !!project.context_summary;
  const existingImages = contextItems.filter((item) => item.type === 'image');
  const existingTexts = contextItems.filter((item) => item.type === 'text');

  function openMemoryEditor() {
    if (!project) return;
    setMemory(project.source_memory ?? '');
    setMemoryModalOpen(true);
  }

  function openProjectEditor() {
    if (!project) return;
    setProjectName(project.name);
    setProjectDescription(project.description ?? '');
    setProjectModalOpen(true);
  }

  async function saveMemory() {
    await updateProjectMutation.mutateAsync({
      projectId,
      input: { source_memory: memory.trim() || null },
    });
    setMemoryModalOpen(false);
  }

  async function saveProjectDetails() {
    await updateProjectMutation.mutateAsync({
      projectId,
      input: {
        name: projectName.trim(),
        description: projectDescription.trim() || undefined,
      },
    });
    setProjectModalOpen(false);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/app" className="text-muted-foreground hover:text-foreground">Projects</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{project.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <Button size="sm" className="bg-[#111114] hover:bg-[#29292f]" onClick={openProjectEditor}>
          <Pencil className="size-3.5" />
          Edit project
        </Button>
      </div>

      {/* Bento grid */}
      <div className="grid auto-rows-auto grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">

        {/* ── Hero card ── */}
        <div className="relative col-span-1 flex flex-col overflow-hidden rounded-2xl bg-violet-600 p-6 shadow-[0_8px_24px_rgba(91,33,182,0.2)] sm:col-span-2 lg:col-span-2">
          {/* Decorative blobs */}
          <div className="pointer-events-none absolute -right-8 -top-8 size-48 rounded-full border border-violet-400/30" />
          <div className="pointer-events-none absolute -bottom-12 -right-4 size-64 rounded-full border border-violet-300/20" />

          {/* Badge */}
          <div className="mb-4 w-fit rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-white/80">
            Active Project
          </div>

          {/* Title */}
          <h1 className="font-serif text-3xl font-light tracking-tight text-white">{project.name}</h1>
          {project.description && (
            <p className="mt-2 max-w-md text-sm leading-relaxed text-violet-200">
              {project.description}
            </p>
          )}

          {/* Stats row */}
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-violet-300">
                Test Suites
              </span>
              <span className="text-xl font-bold text-white">
                {featuresLoading ? '—' : features.length}
              </span>
            </div>
            <div className="h-8 w-px bg-white/20" />
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-violet-300">
                Context
              </span>
              <span className={cn(
                'text-sm font-semibold',
                hasContext ? 'text-emerald-300' : 'text-violet-200'
              )}>
                {hasContext ? '● Ready' : '○ Not set'}
              </span>
            </div>
            <div className="h-8 w-px bg-white/20" />
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-violet-300">
                Created
              </span>
              <span className="text-sm font-medium text-white">
                {formatDate(project.created_at)}
              </span>
            </div>
          </div>

          {/* CTA */}
          <div className="mt-6 flex items-center gap-3">
            <Button
              size="sm"
              className="bg-white text-violet-700 hover:bg-violet-50"
              onClick={() => setCreateTestOpen(true)}
            >
              <Plus className="size-3.5" />
              New Test Suite
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white"
              onClick={() => setContextModalOpen(true)}
            >
              <RefreshCw className="size-3.5" />
              Update context
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-white/80 hover:bg-white/10 hover:text-white"
              onClick={() => router.navigate({ to: '/app/projects/$projectId/tests', params: { projectId } })}
            >
              View all suites
              <ArrowUpRight className="size-3.5" />
            </Button>
          </div>
        </div>

        {/* ── Test Suites card ── */}
        <button
          onClick={() => router.navigate({ to: '/app/projects/$projectId/tests', params: { projectId } })}
          className="group col-span-1 flex flex-col rounded-2xl border border-border bg-card p-5 text-left transition-all hover:border-primary/30 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-auto">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
                <FlaskConical className="size-4 text-primary" />
              </div>
              <h2 className="text-sm font-semibold text-foreground">Test Suites</h2>
            </div>
            <ChevronRight className="size-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
          </div>

          {featuresLoading ? (
            <div className="flex flex-1 items-center justify-center py-8">
              <div className="h-12 w-20 animate-pulse rounded-lg bg-muted" />
            </div>
          ) : features.length > 0 ? (
            <>
              {/* Big number — right-aligned decorative stat */}
              <div className="flex flex-col items-end flex-1 py-4 pt-8" style={{ textAlign: 'right' }}>
                <span className="text-8xl font-black text-foreground/90 tabular-nums leading-none tracking-tighter">
                  {features.length}
                </span>
                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mt-1">
                  suite{features.length !== 1 ? 's' : ''}
                </span>
              </div>
              {/* Status breakdown */}
              {(() => {
                const ready = features.filter((f: Feature) => f.status === 'context_ready' || f.status === 'tests_generated').length;
                const pending = features.length - ready;
                return (
                  <div className="flex items-center justify-end gap-2 flex-wrap mt-1">
                    {ready > 0 && (
                      <span className="text-[11px] font-medium text-emerald-600 bg-emerald-500/10 rounded-full px-2.5 py-0.5">
                        {ready} ready
                      </span>
                    )}
                    {pending > 0 && (
                      <span className="text-[11px] font-medium text-muted-foreground bg-muted rounded-full px-2.5 py-0.5">
                        {pending} pending
                      </span>
                    )}
                  </div>
                );
              })()}
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 py-8 text-center">
              <div className="flex size-10 items-center justify-center rounded-xl bg-muted">
                <FlaskConical className="size-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">No suites yet</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Create your first to get started.</p>
              </div>
              <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setCreateTestOpen(true); }}>
                <Plus className="size-3.5" />
                New Suite
              </Button>
            </div>
          )}
        </button>

        {/* ── Project understanding and owner guidance ── */}
        <section className="col-span-1 rounded-2xl border border-[#ececf1] bg-white p-5 shadow-[0_2px_8px_rgba(15,15,25,0.05)] sm:col-span-2">
          <div className="mb-4 flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-violet-500/10">
              <Sparkles className="size-4 text-violet-600" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-violet-600">AI Insight</p>
              <h2 className="text-sm font-semibold text-foreground">Project Context Summary</h2>
            </div>
          </div>
          {hasContext ? (
            <>
              <div className="relative max-h-56 overflow-hidden">
                <p className="text-sm leading-relaxed text-muted-foreground">{project.context_summary}</p>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-linear-to-t from-white to-transparent" />
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="mt-3 h-auto px-0 text-xs font-medium text-violet-600 hover:bg-transparent hover:text-violet-700"
                onClick={() => setFullContextOpen(true)}
              >
                View full context
                <ArrowUpRight className="size-3" />
              </Button>
            </>
          ) : (
            <p className="text-sm leading-relaxed text-muted-foreground">
              Add screenshots or text context so Clariti can build a shared understanding of your product.
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-4 border-t border-[#ececf1] pt-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><BookText className="size-3.5" />AI generated</span>
            <span className="inline-flex items-center gap-1.5"><FileText className="size-3.5" />{existingImages.length + existingTexts.length} context asset{existingImages.length + existingTexts.length !== 1 ? 's' : ''}</span>
            <span className="inline-flex items-center gap-1.5"><Clock3 className="size-3.5" />Updated {formatDate(project.updated_at)}</span>
          </div>
        </section>

        <section className="col-span-1 flex flex-col rounded-2xl border border-[#ececf1] bg-white p-5 shadow-[0_2px_8px_rgba(15,15,25,0.05)]">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-violet-500/10">
                <BookText className="size-4 text-violet-600" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Memory</h2>
                <p className="text-[11px] text-muted-foreground">Navigation, rules, and known quirks.</p>
              </div>
            </div>
            <Button size="sm" className="h-8 bg-[#111114] hover:bg-[#29292f]" onClick={openMemoryEditor}>
              <Pencil className="size-3" />
              Edit
            </Button>
          </div>
          {project.source_memory ? (
            <>
              <div className="relative max-h-56 overflow-hidden">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {project.source_memory}
                </p>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-linear-to-t from-white to-transparent" />
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="mt-auto pt-3 h-auto px-0 text-xs font-medium text-violet-600 hover:bg-transparent hover:text-violet-700"
                onClick={() => setFullMemoryOpen(true)}
              >
                View full memory
                <ArrowUpRight className="size-3" />
              </Button>
            </>
          ) : (
            <p className="text-sm leading-relaxed text-muted-foreground">
              Add durable guidance Clariti should use while executing tests.
            </p>
          )}
        </section>

        <section className="col-span-1 rounded-2xl border border-[#ececf1] bg-white p-5 shadow-[0_2px_8px_rgba(15,15,25,0.05)] sm:col-span-2 lg:col-span-3">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Context assets</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">These assets help Clariti understand your project better.</p>
            </div>
            <Button size="sm" className="bg-[#111114] hover:bg-[#29292f]" onClick={() => setContextModalOpen(true)}>
              <RefreshCw className="size-3.5" />
              Update context
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {existingImages.slice(0, 3).map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-xl border border-[#ececf1] p-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-violet-500/10">
                  <ImageIcon className="size-4 text-violet-600" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-foreground">{item.filename ?? 'Screenshot'}</p>
                  <p className="text-[11px] text-muted-foreground">Image</p>
                </div>
              </div>
            ))}
            {existingTexts.slice(0, Math.max(0, 3 - existingImages.length)).map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-xl border border-[#ececf1] p-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-violet-500/10">
                  <FileText className="size-4 text-violet-600" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-foreground">{item.content || 'Text context'}</p>
                  <p className="text-[11px] text-muted-foreground">Text context</p>
                </div>
              </div>
            ))}
            {existingImages.length + existingTexts.length === 0 && (
              <p className="col-span-full rounded-xl border border-dashed border-[#d9d9e1] px-4 py-5 text-sm text-muted-foreground">
                No context assets yet. Use Update context to add screenshots or text.
              </p>
            )}
          </div>
        </section>

      </div>

      {/* New Test Suite Dialog */}
      <Dialog open={createTestOpen} onOpenChange={setCreateTestOpen}>
        <DialogContent className="h-[min(88vh,540px)] max-w-4xl w-[95vw] overflow-hidden p-0">
          <div className="flex flex-1 min-h-0 overflow-hidden">
            <CreateTestFlow onClose={() => setCreateTestOpen(false)} projectId={projectId} />
          </div>
        </DialogContent>
      </Dialog>

      <ProjectContextModal
        open={contextModalOpen}
        onOpenChange={setContextModalOpen}
        projectId={projectId}
        existingImages={existingImages}
        existingTexts={existingTexts}
        onSuccess={() => setContextModalOpen(false)}
      />

      <Dialog open={fullContextOpen} onOpenChange={setFullContextOpen}>
        <DialogContent className="max-h-[80vh] max-w-2xl p-0">
          <DialogHeader className="shrink-0 border-b border-[#ececf1] px-6 py-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-violet-600">AI generated</p>
            <DialogTitle className="font-serif text-2xl font-light">Project Context Summary</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto px-6 py-5">
            <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
              {project.context_summary}
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={fullMemoryOpen} onOpenChange={setFullMemoryOpen}>
        <DialogContent className="max-h-[80vh] max-w-2xl p-0">
          <DialogHeader className="shrink-0 border-b border-[#ececf1] px-6 py-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-violet-600">Project owner guidance</p>
            <DialogTitle className="font-serif text-2xl font-light">App Memory</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto px-6 py-5">
            <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
              {project.source_memory}
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={memoryModalOpen} onOpenChange={setMemoryModalOpen}>
        <DialogContent className="max-w-lg gap-0 p-0">
          <DialogHeader className="border-b border-[#ececf1] px-6 py-5">
            <DialogTitle className="font-serif text-2xl font-light">Edit app memory</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Add durable product knowledge Clariti should use while executing tests.
            </p>
          </DialogHeader>
          <div className="px-6 py-5">
            <textarea
              value={memory}
              onChange={(event) => setMemory(event.target.value)}
              rows={9}
              placeholder="Add navigation rules, business constraints, or known product quirks…"
              className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <DialogFooter className="border-t border-[#ececf1] px-6 py-4">
            <Button variant="outline" onClick={() => setMemoryModalOpen(false)}>Cancel</Button>
            <Button className="bg-[#111114] hover:bg-[#29292f]" onClick={saveMemory} disabled={updateProjectMutation.isPending}>
              Save memory
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={projectModalOpen} onOpenChange={setProjectModalOpen}>
        <DialogContent className="max-w-lg gap-0 p-0">
          <DialogHeader className="border-b border-[#ececf1] px-6 py-5">
            <DialogTitle className="font-serif text-2xl font-light">Edit project</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 px-6 py-5">
            <label className="block space-y-1.5 text-sm font-medium text-foreground">
              Project name
              <Input
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
                className="mt-1.5"
              />
            </label>
            <label className="block space-y-1.5 text-sm font-medium text-foreground">
              Description
              <textarea
                value={projectDescription}
                onChange={(event) => setProjectDescription(event.target.value)}
                rows={4}
                className="mt-1.5 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm font-normal text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
          </div>
          <DialogFooter className="border-t border-[#ececf1] px-6 py-4">
            <Button variant="outline" onClick={() => setProjectModalOpen(false)}>Cancel</Button>
            <Button
              className="bg-[#111114] hover:bg-[#29292f]"
              onClick={saveProjectDetails}
              disabled={!projectName.trim() || updateProjectMutation.isPending}
            >
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
