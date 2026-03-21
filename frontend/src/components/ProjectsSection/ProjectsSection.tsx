import * as React from 'react';
import {
  Search,
  ChevronDown,
  LayoutGrid,
  List,
  Plus,
  ArrowDownUp,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
    <div className="flex min-h-0 flex-1 flex-col overflow-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Projects</h1>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => clearAuth()}
          className="text-muted-foreground"
        >
          Sign out
        </Button>
      </div>

      {/* Top bar: search, filters, view toggles, new project */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative min-w-50 max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search for a project"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Sort button */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <ArrowDownUp className="size-4" />
              Sorted by name
              <ChevronDown className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem>Name</DropdownMenuItem>
            <DropdownMenuItem>Date created</DropdownMenuItem>
            <DropdownMenuItem>Last updated</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Spacer */}
        <div className="flex-1" />

        {/* View toggles */}
        <div className="flex items-center rounded-md border border-border p-0.5">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={cn(
              'rounded p-1.5 transition-colors',
              viewMode === 'grid'
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
            aria-label="Grid view"
          >
            <LayoutGrid className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={cn(
              'rounded p-1.5 transition-colors',
              viewMode === 'list'
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
            aria-label="List view"
          >
            <List className="size-4" />
          </button>
        </div>

        {/* New project button */}
        <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
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
              ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
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

      {/* Create project dialog */}
      <CreateProjectDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={(name, description, images, texts) => {
          createProject.mutate(
            { input: { name, description, images, texts } },
            { onSuccess: () => setCreateOpen(false) }
          );
        }}
        isLoading={createProject.isPending}
        isPending={createProject.isPending}
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

// ─── Create Project Dialog ──────────────────────────────────────────────────
interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string, description: string | undefined, images: File[], texts: string[]) => void;
  isLoading: boolean;
  isPending: boolean;
}

interface StagedImage {
  id: string;
  file: File;
}

function CreateProjectDialog({ open, onOpenChange, onSubmit, isLoading }: CreateProjectDialogProps) {
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [stagedImages, setStagedImages] = React.useState<StagedImage[]>([]);
  const [textNotes, setTextNotes] = React.useState<string[]>([]);
  const [currentNote, setCurrentNote] = React.useState('');
  const [sizeError, setSizeError] = React.useState<string | null>(null);

  const reset = () => {
    setName('');
    setDescription('');
    setStagedImages([]);
    setTextNotes([]);
    setCurrentNote('');
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
    if (skipped) setSizeError(`${skipped} file(s) skipped — max 10 MB each.`);
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
    onSubmit(name.trim(), description.trim() || undefined, stagedImages.map((s) => s.file), textNotes);
  };

  const hasContext = stagedImages.length > 0 || textNotes.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name */}
          <div>
            <Label htmlFor="cp-name">Name *</Label>
            <Input
              id="cp-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project name"
              className="mt-1"
              disabled={isLoading}
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="cp-desc">Description (optional)</Label>
            <Input
              id="cp-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description"
              className="mt-1"
              disabled={isLoading}
            />
          </div>

          {/* Context (optional) */}
          <div className="space-y-3">
            <Label className="flex items-center gap-1.5">
              Context Assets
              <span className="text-xs font-normal text-muted-foreground">(optional — used by AI to understand your project)</span>
            </Label>

            <div className="grid grid-cols-2 gap-3">
              {/* Image upload */}
              <label className={cn(
                'group flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-4 text-center cursor-pointer transition-colors',
                isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary/50 hover:bg-muted/50'
              )}>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handleImageSelect(e.target.files)}
                  disabled={isLoading}
                />
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Image className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Images</p>
                  <p className="text-xs text-muted-foreground">Screenshots, mockups</p>
                </div>
              </label>

              {/* Text note */}
              <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                    <MessageSquare className="w-3 h-3 text-amber-400" />
                  </div>
                  <p className="text-sm font-medium text-foreground">Text notes</p>
                </div>
                <textarea
                  value={currentNote}
                  onChange={(e) => setCurrentNote(e.target.value)}
                  placeholder="Product description, key flows..."
                  rows={2}
                  disabled={isLoading}
                  className="w-full px-2 py-1.5 bg-background border border-input rounded text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-ring resize-none"
                />
                <button
                  type="button"
                  onClick={handleAddNote}
                  disabled={!currentNote.trim() || isLoading}
                  className="flex items-center justify-center gap-1 px-2 py-1 bg-muted hover:bg-muted/80 disabled:opacity-50 text-xs text-foreground rounded transition-colors"
                >
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>
            </div>

            {/* Staged assets list */}
            {hasContext && (
              <div className="rounded-lg border border-border divide-y divide-border">
                {stagedImages.map((img) => (
                  <div key={img.id} className="flex items-center gap-3 px-3 py-2">
                    <Image className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="flex-1 text-sm text-foreground truncate">{img.file.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {(img.file.size / 1024 / 1024).toFixed(1)} MB
                    </span>
                    {!isLoading && (
                      <button
                        type="button"
                        onClick={() => setStagedImages((p) => p.filter((i) => i.id !== img.id))}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                {textNotes.map((note, idx) => (
                  <div key={idx} className="flex items-center gap-3 px-3 py-2">
                    <MessageSquare className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="flex-1 text-sm text-foreground truncate">{note}</span>
                    {!isLoading && (
                      <button
                        type="button"
                        onClick={() => setTextNotes((p) => p.filter((_, i) => i !== idx))}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {sizeError && (
              <p className="flex items-center gap-1.5 text-xs text-destructive">
                <AlertCircle className="w-3.5 h-3.5" /> {sizeError}
              </p>
            )}

            {hasContext && !isLoading && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                AI will analyse these assets and build a project context summary.
              </p>
            )}
          </div>

          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center gap-2 rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 text-sm text-primary">
              <Loader className="w-4 h-4 animate-spin shrink-0" />
              {hasContext ? 'Processing assets and creating project...' : 'Creating project...'}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleClose(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || isLoading}>
              {isLoading ? 'Creating...' : 'Create project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit Project Dialog ─────────────────────────────────────────────────────
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
