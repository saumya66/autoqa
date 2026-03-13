import React from 'react';
import { createRootRoute, Link, Outlet, useRouterState } from '@tanstack/react-router';
import { Play, FlaskConical } from 'lucide-react';
import { StatusBar } from '../components/StatusBar';
import { useBackendStatus } from '../hooks';

function RootLayout() {
  const { isConnected } = useBackendStatus();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isAppRoute = pathname === '/app' || pathname.startsWith('/app/');
  const isLoginRoute = pathname === '/login';

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Full-screen login: no header */}
      {isLoginRoute ? (
        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
      ) : (
        <>
      {/* Header: title bar on /app, nav bar on other routes */}
      {isAppRoute ? (
        <header className="drag-region flex h-12 shrink-0 items-center justify-center border-b border-border bg-card">
          <div className="absolute left-0 top-0 h-12 w-20" aria-hidden />
          <span className="text-sm font-medium text-foreground">AutoQA</span>
        </header>
      ) : (
        <header className="drag-region h-12 flex items-center justify-between px-4 bg-card border-b border-border">
          <div className="w-20" />
          <nav className="flex items-center gap-1">
            <Link
              to="/app"
              className="no-drag flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors text-muted-foreground hover:text-foreground hover:bg-accent [&.active]:bg-primary/20 [&.active]:text-primary"
            >
              <FlaskConical className="w-4 h-4" />
              Home
            </Link>
            <Link
              to="/create"
              className="no-drag flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors text-muted-foreground hover:text-foreground hover:bg-accent [&.active]:bg-primary/20 [&.active]:text-primary"
            >
              <FlaskConical className="w-4 h-4" />
              Create Test
            </Link>
            <Link
              to="/execute"
              className="no-drag flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors text-muted-foreground hover:text-foreground hover:bg-accent [&.active]:bg-primary/20 [&.active]:text-primary"
            >
              <Play className="w-4 h-4" />
              Execute
            </Link>
          </nav>
          <StatusBar isConnected={isConnected} />
        </header>
      )}

      {/* Main Content - sidebar + content render below header */}
      <main className="flex-1 flex overflow-hidden">
        <Outlet />
      </main>
        </>
      )}
    </div>
  );
}

export const Route = createRootRoute({
  component: RootLayout,
});
