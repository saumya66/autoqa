import { createFileRoute, redirect } from '@tanstack/react-router';
import { useAuthStore } from '@/store/authStore';
import { CreateTestFlow } from '@/components/CreateTestFlow';

export function CreateTestPage() {
  return <CreateTestFlow />;
}

export const Route = createFileRoute('/create')({
  beforeLoad: () => {
    const { token, skipped } = useAuthStore.getState();
    if (token || skipped) {
      throw redirect({ to: '/app/create' });
    }
  },
  component: CreateTestPage,
});
