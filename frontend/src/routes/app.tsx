import { createFileRoute, Outlet } from '@tanstack/react-router';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { useIsMobile } from '@/hooks/use-mobile';

export const Route = createFileRoute('/app')({
  component: AppLayout,
});

function AppLayout() {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="flex h-full items-center justify-center bg-background p-4">
        <h1 className="text-xl font-semibold text-foreground">
          Please use a desktop or tablet for the best experience
        </h1>
      </div>
    );
  }

  return (
    <SidebarProvider className="h-full min-h-0 flex-1 overflow-hidden bg-white" data-app-header>
      <AppSidebar />
      <SidebarInset className="min-h-0 overflow-hidden border-l border-[#ececf1] bg-[#fafafd] text-foreground">
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
