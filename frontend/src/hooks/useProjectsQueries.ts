import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  listProjects,
  createProject,
  updateProject,
  deleteProject,
  type Project,
  type ProjectCreateInput,
  type ProjectUpdateInput,
} from '@/api/client';
import { useAuthStore } from '@/store/authStore';

export const projectsQueryKey = ['projects'] as const;

export function useProjects() {
  const token = useAuthStore((s) => s.token);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: projectsQueryKey,
    queryFn: listProjects,
    enabled: !!token,
  });

  return {
    projects: (data ?? []) as Project[],
    loading: isLoading,
    error: error?.message ?? null,
    refetch,
    isAuthenticated: !!token,
  };
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ProjectCreateInput) => createProject(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectsQueryKey });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      input,
    }: {
      projectId: string;
      input: ProjectUpdateInput;
    }) => updateProject(projectId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectsQueryKey });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => deleteProject(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectsQueryKey });
    },
  });
}
