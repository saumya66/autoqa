import React from 'react';
import { createRootRoute, Link, Outlet } from '@tanstack/react-router';
import { Play, FlaskConical } from 'lucide-react';
import { StatusBar } from '../components/StatusBar';
import { useBackendStatus } from '../hooks';

function RootLayout() {
  const { isConnected } = useBackendStatus();

  return (
    <div className="h-screen flex flex-col bg-void-900 overflow-hidden">
      {/* Title Bar */}
      <header className="drag-region h-12 flex items-center justify-between px-4 bg-void-950 border-b border-void-700">
        {/* Spacer for native traffic lights */}
        <div className="w-20" />
        
        {/* Navigation */}
        <nav className="flex items-center gap-1">
          <Link
            to="/create"
            className="no-drag flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors text-void-300 hover:text-void-100 hover:bg-void-800 [&.active]:bg-plasma-500/20 [&.active]:text-plasma-400"
          >
            <FlaskConical className="w-4 h-4" />
            Create Test
          </Link>
          <Link
            to="/execute"
            className="no-drag flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors text-void-300 hover:text-void-100 hover:bg-void-800 [&.active]:bg-plasma-500/20 [&.active]:text-plasma-400"
          >
            <Play className="w-4 h-4" />
            Execute
          </Link>
        </nav>
        
        <StatusBar isConnected={isConnected} />
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}

export const Route = createRootRoute({
  component: RootLayout,
});
