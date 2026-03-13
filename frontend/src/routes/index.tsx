import { createFileRoute, redirect } from '@tanstack/react-router';
import { useAuthStore } from '@/store/authStore';

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    const { token, skipped } = useAuthStore.getState();
    if (token) {
      throw redirect({ to: '/app' });
    }
    if (skipped) {
      throw redirect({ to: '/app/create' });
    }
    throw redirect({ to: '/login' });
  },
});
