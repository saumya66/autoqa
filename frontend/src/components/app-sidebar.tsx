import * as React from 'react';
import { Folder, FlaskConical, Play, PanelLeft } from 'lucide-react';
import { Link, useRouterState } from '@tanstack/react-router';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store/useAppStore';
import { useAuthStore } from '@/store/authStore';

const menuItems = [
  { title: 'Projects', section: 'projects' as const, icon: Folder, to: '/app', requireAuth: true },
  { title: 'Create Test', section: 'create' as const, icon: FlaskConical, to: '/app/create', requireAuth: false },
  { title: 'Execute', section: 'execute' as const, icon: Play, to: '/app/execute', requireAuth: false },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { activeSection, setActiveSection } = useAppStore();
  const { toggleSidebar, state } = useSidebar();
  const routerState = useRouterState();
  const pathname = routerState.location.pathname;
  const isAuthenticated = !!useAuthStore((s) => s.token);
  const skipped = useAuthStore((s) => s.skipped);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const handleSidebarClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (state === 'collapsed' && !target.closest('a, button, [role="menuitem"]')) {
      toggleSidebar();
    }
  };

  return (
    <Sidebar
      collapsible="icon"
      className="group-data-[collapsible=icon]:cursor-pointer"
      onClick={handleSidebarClick}
      {...props}
    >
      <SidebarHeader>
        <div className="flex items-center justify-between gap-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild tooltip="AutoQA">
                <Link to={isAuthenticated ? '/app' : '/app/create'}>
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <FlaskConical className="size-4" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">AutoQA</span>
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="h-7 w-7 group-data-[collapsible=icon]:hidden"
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive =
                  item.to === '/app'
                    ? pathname === '/app' || pathname === '/app/'
                    : pathname === item.to || pathname.startsWith(item.to + '/');
                const showItem = !item.requireAuth || isAuthenticated;
                if (!showItem) return null;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      isActive={isActive}
                      tooltip={item.title}
                      asChild
                    >
                      <Link to={item.to} onClick={() => setActiveSection(item.section)}>
                        <item.icon className="size-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {(isAuthenticated || skipped) && (
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Back to login"
                asChild
              >
                <Link
                  to="/login"
                  onClick={() => {
                    clearAuth();
                  }}
                >
                  <span className="text-muted-foreground">Sign out</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      )}

      <SidebarRail />
    </Sidebar>
  );
}
