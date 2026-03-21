import * as React from 'react';
import { createFileRoute, redirect, Outlet, Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { useProject } from '@/hooks/useProjectsQueries';
import { useAuthStore } from '@/store/authStore';

export const Route = createFileRoute('/app/projects/$projectId')({
  beforeLoad: () => {
    const { token, skipped } = useAuthStore.getState();
    if (skipped) {
      throw redirect({ to: '/app/create' });
    }
  },
  component: ProjectLayout,
});

function ProjectLayout() {
  const { projectId } = Route.useParams();
  const { project, loading, error, refetch, isAuthenticated } =
    useProject(projectId);

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-6">
        <h1 className="text-2xl font-bold text-foreground">Project Details</h1>
        <p className="mt-4 text-center text-muted-foreground">
          Sign in to view project details.
        </p>
        <Button asChild className="mt-4">
          <Link to="/login">Sign in</Link>
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-6">
        <p className="text-muted-foreground">Loading project...</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-6">
        <p className="text-destructive">{error ?? 'Project not found'}</p>
        <Button variant="outline" className="mt-4" onClick={() => refetch()}>
          Retry
        </Button>
        <Button asChild variant="link" className="mt-2">
          <Link to="/app">Back to Projects</Link>
        </Button>
      </div>
    );
  }

  return <Outlet />;
}
