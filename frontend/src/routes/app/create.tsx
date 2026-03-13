import { createFileRoute } from '@tanstack/react-router';
import { CreateTestPage } from '@/routes/create';

export const Route = createFileRoute('/app/create')({
  component: CreateTestPage,
});
