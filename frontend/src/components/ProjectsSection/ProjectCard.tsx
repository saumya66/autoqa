import * as React from 'react';
import {
  MoreVertical,
  ShoppingBag,
  BarChart2,
  Users,
  Cloud,
  Layers,
  Globe,
  Cpu,
  Wallet,
  Package,
  Smartphone,
} from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { Project } from '@/api/client';

interface ProjectCardProps {
  project: Project;
  viewMode: 'grid' | 'list';
  onEdit?: (project: Project) => void;
  onDuplicate?: (project: Project) => void;
  onDelete?: (project: Project) => void;
}

// Deterministic icon + color per project based on id
const ICON_PALETTE = [
  { icon: ShoppingBag, bg: 'bg-pink-500/10',   text: 'text-pink-500' },
  { icon: Wallet,      bg: 'bg-violet-500/10',  text: 'text-violet-500' },
  { icon: Users,       bg: 'bg-blue-500/10',    text: 'text-blue-500' },
  { icon: BarChart2,   bg: 'bg-rose-500/10',    text: 'text-rose-500' },
  { icon: Cloud,       bg: 'bg-sky-500/10',     text: 'text-sky-500' },
  { icon: Layers,      bg: 'bg-amber-500/10',   text: 'text-amber-500' },
  { icon: Globe,       bg: 'bg-emerald-500/10', text: 'text-emerald-500' },
  { icon: Cpu,         bg: 'bg-indigo-500/10',  text: 'text-indigo-500' },
  { icon: Package,     bg: 'bg-orange-500/10',  text: 'text-orange-500' },
  { icon: Smartphone,  bg: 'bg-teal-500/10',    text: 'text-teal-500' },
];

function pickPalette(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return ICON_PALETTE[hash % ICON_PALETTE.length];
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export function ProjectCard({
  project,
  viewMode,
  onEdit,
  onDuplicate,
  onDelete,
}: ProjectCardProps) {
  const palette = pickPalette(project.id);
  const Icon = palette.icon;
  const hasContext = !!project.context_summary;

  if (viewMode === 'list') {
    return (
      <Link
        to="/app/projects/$projectId"
        params={{ projectId: project.id }}
        className="group flex items-center gap-4 rounded-xl border border-[#ececf1] bg-white px-4 py-3 transition-all hover:border-violet-200 hover:shadow-sm"
      >
        <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl', palette.bg)}>
          <Icon className={cn('size-4', palette.text)} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{project.name}</p>
          {project.description && (
            <p className="truncate text-xs text-muted-foreground">{project.description}</p>
          )}
        </div>
        <span className={cn(
          'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
          hasContext ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'
        )}>
          {hasContext ? 'Context ready' : 'No context'}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {relativeTime(project.created_at)}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
            >
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit?.(project)}>Edit</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDuplicate?.(project)}>Duplicate</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={() => onDelete?.(project)}>Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Link>
    );
  }

  return (
    <Link
      to="/app/projects/$projectId"
      params={{ projectId: project.id }}
      className="group block"
    >
      <div className="flex h-full min-h-47 flex-col rounded-2xl border border-[#ececf1] bg-white! p-4 shadow-[0_2px_8px_rgba(15,15,25,0.05)] transition-all hover:border-violet-200 hover:shadow-md">
        {/* Top row: icon + badge + menu */}
        <div className="mb-3 flex items-start justify-between">
          <div className={cn('flex size-10 items-center justify-center rounded-xl', palette.bg)}>
            <Icon className={cn('size-4.5', palette.text)} />
          </div>
          <div className="flex items-center gap-2">
            <span className={cn(
              'rounded-full px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
              hasContext ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground/70'
            )}>
              {hasContext ? 'Ready' : 'No context'}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                >
                  <MoreVertical className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit?.(project)}>Edit</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDuplicate?.(project)}>Duplicate</DropdownMenuItem>
                <DropdownMenuItem className="text-destructive" onClick={() => onDelete?.(project)}>Delete</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Title + description */}
        <h3 className="text-sm font-semibold text-foreground">{project.name}</h3>
        <p className="mt-1 line-clamp-2 flex-1 text-xs leading-5 text-muted-foreground">
          {project.description || <span className="italic opacity-60">No description</span>}
        </p>

        {/* Bottom row */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
            {project.name.charAt(0).toUpperCase()}
          </div>
          <span className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
            Created {relativeTime(project.created_at)}
          </span>
        </div>
      </div>
    </Link>
  );
}
