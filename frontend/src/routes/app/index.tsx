import * as React from 'react';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { ProjectsSection } from '@/components/ProjectsSection';
import { useAuthStore } from '@/store/authStore';

export const Route = createFileRoute('/app/')({
  beforeLoad: () => {
    const { token, skipped } = useAuthStore.getState();
    if (skipped) {
      throw redirect({ to: '/app/create' });
    }
  },
  component: AppHomePage,
});

function AppHomePage() {
  const skipped = useAuthStore((s) => s.skipped);
  const navigate = useNavigate();

  // Redirect skipped users to Create (handles hydration delay)
  React.useEffect(() => {
    if (skipped) navigate({ to: '/app/create' });
  }, [skipped, navigate]);

  return <ProjectsSection />;
}
