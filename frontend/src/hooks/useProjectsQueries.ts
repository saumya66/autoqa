import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  createProjectWithContext,
  listFeaturesByProject,
  listProjectContextItems,
  type Project,
  type Feature,
  type CloudContextItem,
  type ProjectCreateInput,
  type ProjectUpdateInput,
  type CloudProjectCallbacks,
} from '@/api/client';
import { useAuthStore } from '@/store/authStore';

export const projectsQueryKey = ['projects'] as const;

export function projectQueryKey(projectId: string) {
  return ['projects', projectId] as const;
}

export function useProject(projectId: string | undefined) {
  const token = useAuthStore((s) => s.token);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: projectQueryKey(projectId ?? ''),
    queryFn: () => getProject(projectId!),
    enabled: !!token && !!projectId,
  });

  return {
    project: data ?? null,
    loading: isLoading,
    error: error?.message ?? null,
    refetch,
    isAuthenticated: !!token,
  };
}

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

/**
 * Simple project creation — no AI processing.
 * Use only when no images/text context is provided (e.g. bare name + description).
 */
export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ProjectCreateInput) => createProject(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectsQueryKey });
    },
  });
}

export interface CreateProjectWithContextInput {
  name: string;
  description?: string;
  images: File[];
  texts: string[];
}

/**
 * Full project creation with AI context.
 * Sends images + text to the local backend, which:
 *   1. Runs ImageContextRetrieverAgent on each image
 *   2. Synthesises a project-level context_summary
 *   3. Creates the project in the cloud with that summary
 *   4. Saves context items to the cloud
 *
 * Streams progress events via SSE callbacks.
 * Falls back to direct cloud creation if no images/texts are provided.
 */
export function useCreateProjectWithContext() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      input,
      callbacks,
    }: {
      input: CreateProjectWithContextInput;
      callbacks?: CloudProjectCallbacks;
    }) => {
      const hasContext = input.images.length > 0 || input.texts.length > 0;

      if (!hasContext) {
        // No assets — skip AI, go straight to cloud
        return createProject({ name: input.name, description: input.description }).then(
          (project) => {
            callbacks?.onDone?.(project);
            return project;
          }
        );
      }

      return new Promise<Project>((resolve, reject) => {
        createProjectWithContext(
          input.name,
          input.description,
          input.images,
          input.texts,
          {
            onProgress: callbacks?.onProgress,
            onDone: (project) => {
              callbacks?.onDone?.(project);
              resolve(project);
            },
            onError: (message) => {
              callbacks?.onError?.(message);
              reject(new Error(message));
            },
          }
        ).catch(reject);
      });
    },
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

export function featuresQueryKey(projectId: string) {
  return ['projects', projectId, 'features'] as const;
}

export function useProjectFeatures(projectId: string | undefined) {
  const token = useAuthStore((s) => s.token);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: featuresQueryKey(projectId ?? ''),
    queryFn: () => listFeaturesByProject(projectId!),
    enabled: !!token && !!projectId,
  });

  return {
    features: (data ?? []) as Feature[],
    loading: isLoading,
    error: error?.message ?? null,
    refetch,
  };
}

export function contextItemsQueryKey(projectId: string) {
  return ['projects', projectId, 'context-items'] as const;
}

export function useProjectContextItems(projectId: string | undefined) {
  const token = useAuthStore((s) => s.token);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: contextItemsQueryKey(projectId ?? ''),
    queryFn: () => listProjectContextItems(projectId!),
    enabled: !!token && !!projectId,
  });

  return {
    contextItems: (data ?? []) as CloudContextItem[],
    loading: isLoading,
    error: error?.message ?? null,
    refetch,
  };
}
