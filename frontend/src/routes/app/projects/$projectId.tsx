import * as React from 'react';
import { createFileRoute, redirect, Link } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useProject } from '@/hooks/useProjectsQueries';
import { useAuthStore } from '@/store/authStore';

export const Route = createFileRoute('/app/projects/$projectId')({
  beforeLoad: () => {
    const { token, skipped } = useAuthStore.getState();
    if (skipped) {
      throw redirect({ to: '/app/create' });
    }
  },
  component: ProjectDetailsPage,
});

function ProjectDetailsPage() {
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

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto p-6">
      {/* Header: project name + New Test Suite button */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{project.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {project.description || 'No description'}
          </p>
        </div>
        <Button className="shrink-0">
          <Plus className="size-4" />
          New Test Suite
        </Button>
      </div>

      {/* Tabbed view */}
      <Tabs defaultValue="tests" className="mt-6 flex-1">
        <TabsList variant="line">
          <TabsTrigger value="tests">Test Suites</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="tests" className="mt-4">
          <TestSuitesList />
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <div className="rounded-lg border border-border bg-card p-6">
            <p className="text-sm text-muted-foreground">
              Project settings will be available here.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Hardcoded test suites for now - will be dynamic later
const HARDCODED_TEST_SUITES = [
  {
    id: '1',
    name: 'Login & Authentication Flow',
    description: 'Integration level tests for OAuth and direct login',
    totalTests: 24,
    lastRun: '12 mins ago',
  },
  {
    id: '2',
    name: 'User Profile Redesign',
    description: 'Avatar upload and settings sync tests',
    totalTests: 18,
    lastRun: '2 hours ago',
  },
  {
    id: '3',
    name: 'Checkout Funnel V2',
    description: 'End-to-end purchasing workflow validation',
    totalTests: 42,
    lastRun: 'In progress...',
  },
  {
    id: '4',
    name: 'Search & Filtering Optimization',
    description: 'Catalog searching with elasticsearch hooks',
    totalTests: 12,
    lastRun: 'Yesterday, 14:32',
  },
];

function TestSuitesList() {
  const totalSuites = HARDCODED_TEST_SUITES.length;
  const [page, setPage] = React.useState(0);
  const pageSize = 4;
  const totalPages = Math.ceil(totalSuites / pageSize);
  const start = page * pageSize;
  const suites = HARDCODED_TEST_SUITES.slice(start, start + pageSize);

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border-[#E2E8F0] border bg-white">
        <Table className="border-collapse [&_th]:border-r-0 [&_td]:border-r-0">
          <TableHeader>
            <TableRow className="border-[#E2E8F0] border-b bg-[#F9FAFC] hover:bg-[#F9FAFC]">
              <TableHead className="w-[50%] px-4 py-3">Suite Name</TableHead>
              <TableHead className="w-[25%] px-4 py-3">Total Tests</TableHead>
              <TableHead className="w-[25%] px-4 py-3">Last Run</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suites.map((suite) => (
              <TableRow
                key={suite.id}
                className="cursor-pointer border-[#E2E8F0] border-b bg-white last:border-b-0 hover:bg-muted/50"
              >
                <TableCell className="px-4 py-3">
                  <div>
                    <p className="font-medium text-foreground">{suite.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {suite.description}
                    </p>
                  </div>
                </TableCell>
                <TableCell className="px-4 py-3">
                  <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-sm">
                    <span className="font-medium text-foreground">
                      {suite.totalTests}
                    </span>
                    <span className="ml-1 text-muted-foreground">Tests</span>
                  </span>
                </TableCell>
                <TableCell className="px-4 py-3 text-muted-foreground">
                  {suite.lastRun}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {start + 1}-{Math.min(start + pageSize, totalSuites)} of{' '}
          {totalSuites} test suites
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
