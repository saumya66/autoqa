import * as React from 'react';
import {
  Search,
  LayoutGrid,
  List,
  Plus,
  Image,
  MessageSquare,
  Trash2,
  Loader,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ProjectCard } from './ProjectCard';
import { cn } from '@/lib/utils';
import {
  useProjects,
  useCreateProjectWithContext,
  useUpdateProject,
  useDeleteProject,
} from '@/hooks/useProjectsQueries';
import type { Project } from '@/api/client';
import { useAuthStore } from '@/store/authStore';
import { Link } from '@tanstack/react-router';

type ViewMode = 'grid' | 'list';

export function ProjectsSection() {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [viewMode, setViewMode] = React.useState<ViewMode>('grid');
  const [createOpen, setCreateOpen] = React.useState(false);
  const [createProgress, setCreateProgress] = React.useState<string | null>(null);
  const [editProject, setEditProject] = React.useState<Project | null>(null);

  const { projects, loading, error, refetch, isAuthenticated } = useProjects();
  const createProject = useCreateProjectWithContext();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();

  const filteredProjects = React.useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const q = searchQuery.toLowerCase();
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description?.toLowerCase().includes(q) ?? false)
    );
  }, [projects, searchQuery]);

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-6">
        <h1 className="text-2xl font-bold text-foreground">Projects</h1>
        <p className="mt-4 text-center text-muted-foreground">
          Sign in to view and manage your projects.
        </p>
        <Button asChild className="mt-4">
          <Link to="/login">Sign in</Link>
        </Button>
      </div>
    );
  }

  const clearAuth = useAuthStore((s) => s.clearAuth);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto bg-[#fafafd] p-5 sm:p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-light tracking-tight text-foreground">Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            All your projects in one place. Stay organized and ship with confidence.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => clearAuth()}
          className="text-xs font-medium text-foreground hover:bg-muted"
        >
          Sign out
        </Button>
      </div>

      {/* Top bar: search, filters, view toggles, new project */}
      <div className="mt-8 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative min-w-50 max-w-54">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search for a project"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 rounded-lg border-[#e7e7ed] bg-white pl-9 text-xs shadow-sm placeholder:text-muted-foreground"
          />
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* View toggles */}
        <div className="flex items-center rounded-lg border border-[#e7e7ed] bg-white p-0.5 shadow-sm">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={cn(
              'rounded-md p-1.5 transition-colors',
              viewMode === 'grid'
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
            aria-label="Grid view"
          >
            <LayoutGrid className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={cn(
              'rounded-md p-1.5 transition-colors',
              viewMode === 'list'
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
            aria-label="List view"
          >
            <List className="size-3.5" />
          </button>
        </div>

        {/* New project button */}
        <Button size="sm" className="h-9 gap-1.5 rounded-lg bg-[#111114] px-4 text-xs hover:bg-[#29292f]" onClick={() => setCreateOpen(true)}>
          <Plus className="size-3.5" />
          New project
        </Button>
      </div>

      {/* Loading / Error */}
      {loading && (
        <p className="mt-6 text-muted-foreground">Loading projects...</p>
      )}
      {error && (
        <p className="mt-6 text-destructive">
          {error}
          <Button variant="link" size="sm" onClick={() => refetch()} className="ml-2">
            Retry
          </Button>
        </p>
      )}

      {/* Project cards grid */}
      {!loading && !error && (
        <div
          className={cn(
            'mt-6 gap-4',
            viewMode === 'grid'
              ? 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4'
              : 'flex flex-col'
          )}
        >
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              viewMode={viewMode}
              onEdit={(p) => setEditProject(p)}
              onDuplicate={(p) => {
                createProject.mutate({
                  input: { name: `${p.name} (copy)`, description: p.description ?? undefined, images: [], texts: [] },
                });
              }}
              onDelete={(p) => {
                if (window.confirm(`Delete project "${p.name}"?`)) {
                  deleteProject.mutate(p.id);
                }
              }}
            />
          ))}
        </div>
      )}

      {!loading && !error && filteredProjects.length === 0 && (
        <p className="mt-8 text-center text-muted-foreground">
          No projects found. Try a different search or create a new project.
        </p>
      )}

      {!loading && !error && (
        <section className="mt-6 flex flex-col items-center px-4 pb-2 pt-4 text-center sm:mt-8 sm:pt-6">
          <img
            src="/projects-footer.png"
            alt=""
            className="w-56 max-w-full object-contain sm:w-64"
          />
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-foreground">
            Start your next project!
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            "The best way to predict the future is to invent it." - Alan Kay
          </p>
          <Button
            size="sm"
            className="mt-4 h-9 gap-1.5 rounded-lg bg-[#111114] px-4 text-xs hover:bg-[#29292f]"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="size-3.5" />
            New project
          </Button>
        </section>
      )}

      {/* Create project dialog */}
      <CreateProjectDialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setCreateProgress(null);
        }}
        onSubmit={(name, description, images, texts, sourceMemory) => {
          setCreateProgress(null);
          createProject.mutate(
            {
              input: { name, description, images, texts, sourceMemory },
              callbacks: {
                onProgress: (msg) => setCreateProgress(msg),
                onError: (msg) => setCreateProgress(`Error: ${msg}`),
              },
            },
            { onSuccess: () => { setCreateOpen(false); setCreateProgress(null); } }
          );
        }}
        isLoading={createProject.isPending}
        isPending={createProject.isPending}
        progressMessage={createProgress}
      />

      {/* Edit project dialog */}
      <EditProjectDialog
        project={editProject}
        onOpenChange={(open) => !open && setEditProject(null)}
        onSubmit={(name, description) => {
          if (!editProject) return;
          updateProject.mutate(
            { projectId: editProject.id, input: { name, description } },
            { onSuccess: () => setEditProject(null) }
          );
        }}
        isLoading={updateProject.isPending}
      />
    </div>
  );
}

// ??? Create Project Dialog ??????????????????????????????????????????????????
interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (
    name: string,
    description: string | undefined,
    images: File[],
    texts: string[],
    sourceMemory: string | undefined,
  ) => void;
  isLoading: boolean;
  isPending: boolean;
  progressMessage?: string | null;
}

interface StagedImage {
  id: string;
  file: File;
}

function CreateProjectDialog({ open, onOpenChange, onSubmit, isLoading, progressMessage }: CreateProjectDialogProps) {
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [stagedImages, setStagedImages] = React.useState<StagedImage[]>([]);
  const [textNotes, setTextNotes] = React.useState<string[]>([]);
  const [currentNote, setCurrentNote] = React.useState('');
  const [sourceMemory, setSourceMemory] = React.useState('');
  const [sizeError, setSizeError] = React.useState<string | null>(null);

  const reset = () => {
    setName('');
    setDescription('');
    setStagedImages([]);
    setTextNotes([]);
    setCurrentNote('');
    setSourceMemory('');
    setSizeError(null);
  };

  const handleClose = (open: boolean) => {
    if (!open) reset();
    onOpenChange(open);
  };

  const handleImageSelect = (files: FileList | null) => {
    if (!files) return;
    const MAX = 10 * 1024 * 1024;
    const valid: StagedImage[] = [];
    let skipped = 0;
    for (const f of Array.from(files)) {
      if (f.size > MAX) { skipped++; continue; }
      valid.push({ id: `${Date.now()}-${f.name}`, file: f });
    }
    if (skipped) setSizeError(`${skipped} file(s) skipped � max 10 MB each.`);
    else setSizeError(null);
    setStagedImages((prev) => [...prev, ...valid]);
  };

  const handleAddNote = () => {
    if (!currentNote.trim()) return;
    setTextNotes((prev) => [...prev, currentNote.trim()]);
    setCurrentNote('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit(
      name.trim(),
      description.trim() || undefined,
      stagedImages.map((s) => s.file),
      textNotes,
      sourceMemory || undefined,
    );
  };

  const hasContext = stagedImages.length > 0 || textNotes.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="project-create-dialog max-h-[90vh] max-w-2xl overflow-hidden rounded-2xl border-[#ececf1] bg-white p-0 shadow-2xl [&>div:first-child]:overflow-y-auto">
        <DialogHeader className="border-b border-[#ececf1] px-7 pb-5 pt-6">
          <DialogTitle className="font-serif text-3xl font-light tracking-tight text-foreground">Create new project</DialogTitle>
          <p className="text-xs leading-5 text-muted-foreground">
            Provide a few details so Clariti can understand your product.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 px-7 py-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="cp-name" className="text-xs font-medium text-[#25252c]">Project name <span className="text-destructive">*</span></Label>
              <Input
                id="cp-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter project name"
                className="mt-2 h-10 border-[#dcd8f4] bg-white px-3 text-xs shadow-sm placeholder:text-[10px] placeholder:text-slate-400 focus-visible:ring-violet-400"
                disabled={isLoading}
              />
            </div>
            <div>
              <Label htmlFor="cp-desc" className="text-xs font-medium text-[#25252c]">Description <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Input
                id="cp-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of your project"
                className="mt-2 h-10 border-[#e7e7ed] bg-white px-3 text-xs shadow-sm placeholder:text-[10px] placeholder:text-slate-400 focus-visible:ring-violet-400"
                disabled={isLoading}
              />
            </div>
          </div>

          <section>
            <Label className="text-xs font-medium text-[#25252c]">Context assets</Label>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Add information that will help Clariti understand your project better.
            </p>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className={cn(
                'group flex min-h-36 flex-col items-center justify-center rounded-xl border border-dashed border-[#dfe0e9] bg-white p-4 text-center transition-colors sm:order-2',
                isLoading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-violet-300 hover:bg-violet-50/30'
              )}>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handleImageSelect(e.target.files)}
                  disabled={isLoading}
                />
                <div className="flex size-9 items-center justify-center rounded-full bg-violet-100 text-violet-500">
                  <Image className="size-4" />
                </div>
                <p className="mt-3 text-xs font-semibold text-foreground">Upload images</p>
                <p className="mt-1 text-[10px] text-muted-foreground">Common, show Clariti your app too!</p>
                <p className="mt-2 text-[10px] text-muted-foreground">Drag & drop or click to upload</p>
              </label>

              <div className="flex min-h-36 flex-col rounded-xl border border-[#e7e7ed] bg-white p-3 sm:order-1">
                <div className="flex items-center gap-2">
                  <div className="flex size-6 items-center justify-center rounded-md bg-amber-100 text-amber-500">
                    <MessageSquare className="size-3" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">Text context</p>
                    <p className="text-[10px] text-muted-foreground">Help Clariti understand your product, flows, what it does and how it works.</p>
                  </div>
                </div>
                <textarea
                  value={currentNote}
                  onChange={(e) => setCurrentNote(e.target.value)}
                  placeholder="Write here..."
                  rows={3}
                  disabled={isLoading}
                  className="mt-3 min-h-15 w-full resize-none rounded-lg border border-[#e7e7ed] bg-[#fafafd] px-2.5 py-2 text-xs text-foreground placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:cursor-not-allowed"
                />
                <button
                  type="button"
                  onClick={handleAddNote}
                  disabled={!currentNote.trim() || isLoading}
                  className="mt-2 flex h-8 w-full items-center justify-center gap-1.5 rounded-md bg-[#111114] text-[10px] font-medium text-white hover:bg-[#29292f] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus className="size-3" />
                  Add context
                </button>
              </div>
            </div>

            {hasContext && (
              <div className="mt-3 overflow-hidden rounded-xl border border-[#e7e7ed] bg-white">
                {stagedImages.map((img) => (
                  <div key={img.id} className="flex items-center gap-3 border-b border-[#ececf1] px-3 py-2 last:border-0">
                    <Image className="size-3.5 shrink-0 text-violet-500" />
                    <span className="flex-1 truncate text-[11px] text-foreground">{img.file.name}</span>
                    <span className="text-[10px] text-muted-foreground">{(img.file.size / 1024 / 1024).toFixed(1)} MB</span>
                    {!isLoading && (
                      <button type="button" onClick={() => setStagedImages((p) => p.filter((i) => i.id !== img.id))} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                {textNotes.map((note, idx) => (
                  <div key={`${note}-${idx}`} className="flex items-center gap-3 border-b border-[#ececf1] px-3 py-2 last:border-0">
                    <MessageSquare className="size-3.5 shrink-0 text-amber-500" />
                    <span className="flex-1 truncate text-[11px] text-foreground">{note}</span>
                    {!isLoading && (
                      <button type="button" onClick={() => setTextNotes((p) => p.filter((_, i) => i !== idx))} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {sizeError && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
                <AlertCircle className="size-3.5" /> {sizeError}
              </p>
            )}

            {hasContext && !isLoading && (
              <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <CheckCircle className="size-3.5 text-emerald-500" />
                Clariti will analyze these assets and build a project context summary.
              </p>
            )}
          </section>

          <div>
            <Label htmlFor="cp-memory" className="text-xs font-medium text-[#25252c]">Memory <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Add app-wide structure, navigation, business rules, safety constraints, or known quirks.
            </p>
            <textarea
              id="cp-memory"
              value={sourceMemory}
              onChange={(e) => setSourceMemory(e.target.value)}
              placeholder={'Examples:\n- Cart bill details are below recommendations\n- Cart state persists between runs\n- Never place an order during tests'}
              rows={4}
              disabled={isLoading}
              className="mt-3 w-full resize-y rounded-xl border-0 bg-[#f5f5f8] px-3 py-2.5 text-xs leading-5 text-foreground placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {isLoading && (
            <div className={cn(
              'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs',
              progressMessage?.startsWith('Error:')
                ? 'border-destructive/20 bg-destructive/5 text-destructive'
                : 'border-violet-200 bg-violet-50 text-violet-700'
            )}>
              {progressMessage?.startsWith('Error:') ? <AlertCircle className="size-4 shrink-0" /> : <Loader className="size-4 shrink-0 animate-spin" />}
              {progressMessage ?? (hasContext ? 'Processing assets...' : 'Creating project...')}
            </div>
          )}

          <DialogFooter className="border-t border-[#ececf1] pt-5">
            <Button type="button" variant="outline" className="h-9 border-[#e7e7ed] bg-white text-xs hover:bg-muted" onClick={() => handleClose(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" className="h-9 bg-[#111114] text-xs hover:bg-[#29292f]" disabled={!name.trim() || isLoading}>
              {isLoading ? 'Creating...' : 'Create project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ??? Edit Project Dialog ?????????????????????????????????????????????????????
interface EditProjectDialogProps {
  project: Project | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string, description?: string) => void;
  isLoading: boolean;
}

function EditProjectDialog({
  project,
  onOpenChange,
  onSubmit,
  isLoading,
}: EditProjectDialogProps) {
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');

  React.useEffect(() => {
    if (project) {
      setName(project.name);
      setDescription(project.description ?? '');
    }
  }, [project]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !name.trim()) return;
    onSubmit(name.trim(), description.trim() || undefined);
  };

  if (!project) return null;

  return (
    <Dialog open={!!project} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="edit-name">Name</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project name"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="edit-desc">Description (optional)</Label>
            <Input
              id="edit-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description"
              className="mt-1"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || isLoading}>
              {isLoading ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
