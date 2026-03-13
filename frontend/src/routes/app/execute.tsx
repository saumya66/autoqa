import { createFileRoute } from '@tanstack/react-router';
import { ExecutePage } from '@/routes/execute';

export const Route = createFileRoute('/app/execute')({
  component: ExecutePage,
});
