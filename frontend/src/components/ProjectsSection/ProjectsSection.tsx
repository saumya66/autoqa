import * as React from 'react';
import {
  Search,
  ChevronDown,
  LayoutGrid,
  List,
  Plus,
  ArrowDownUp,
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
  useCreateProject,
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
  const createProject = useCreateProject();
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
                  name: `${p.name} (copy)`,
                  description: p.description ?? undefined,
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
        onSubmit={(name, description) => {
          createProject.mutate({ name, description }, {
            onSuccess: () => setCreateOpen(false),
          });
        }}
        isLoading={createProject.isPending}
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
  onSubmit: (name: string, description?: string) => void;
  isLoading: boolean;
}

function CreateProjectDialog({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
}: CreateProjectDialogProps) {
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit(name.trim(), description.trim() || undefined);
    setName('');
    setDescription('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="create-name">Name</Label>
            <Input
              id="create-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project name"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="create-desc">Description (optional)</Label>
            <Input
              id="create-desc"
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
              {isLoading ? 'Creating...' : 'Create'}
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
