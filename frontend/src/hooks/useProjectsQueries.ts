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
  createCloudFeature,
  listFeaturesByProject,
  listProjectContextItems,
  listTestCasesByFeature,
  buildFeatureContext,
  generateFeatureTests,
  saveFeatureTests,
  updateProjectContext,
  listTestRunsByFeature,
  getTestRunDetail,
  type CloudContextUpdateCallbacks,
  type Project,
  type Feature,
  type CloudContextItem,
  type CloudTestCase,
  type ProjectCreateInput,
  type ProjectUpdateInput,
  type CloudProjectCallbacks,
  type CloudContextCallbacks,
  type CloudTestsCallbacks,
  type CloudTestRun,
  type CloudTestRunDetail,
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
  sourceMemory?: string;
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
      const hasContext = input.images.length > 0 || input.texts.length > 0 || !!input.sourceMemory?.trim();

      if (!hasContext) {
        // No assets — skip AI, go straight to cloud
        return createProject({
          name: input.name,
          description: input.description,
          source_memory: input.sourceMemory,
        }).then(
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
          input.sourceMemory,
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
    onSuccess: (_project, variables) => {
      queryClient.invalidateQueries({ queryKey: projectsQueryKey });
      queryClient.invalidateQueries({ queryKey: projectQueryKey(variables.projectId) });
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

export function testCasesQueryKey(featureId: string) {
  return ['features', featureId, 'test-cases'] as const;
}

export function useFeatureTestCases(featureId: string | undefined) {
  const token = useAuthStore((s) => s.token);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: testCasesQueryKey(featureId ?? ''),
    queryFn: () => listTestCasesByFeature(featureId!),
    enabled: !!token && !!featureId,
  });

  return {
    testCases: (data ?? []) as CloudTestCase[],
    loading: isLoading,
    error: error?.message ?? null,
    refetch,
  };
}

export function useCreateFeature(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, description }: { name: string; description?: string }) =>
      createCloudFeature(projectId, name, description),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: featuresQueryKey(projectId) });
    },
  });
}

export function useBuildFeatureContext() {
  return useMutation({
    mutationFn: ({
      featureId,
      projectId,
      userFeedback,
      callbacks,
      images,
      texts,
    }: {
      featureId: string;
      projectId: string;
      userFeedback?: string;
      callbacks: CloudContextCallbacks;
      images?: File[];
      texts?: string[];
    }) => buildFeatureContext(featureId, projectId, userFeedback, callbacks, images, texts),
  });
}

export function useGenerateFeatureTests() {
  return useMutation({
    mutationFn: ({
      featureId,
      projectId,
      callbacks,
      provider,
      userFeedback,
    }: {
      featureId: string;
      projectId: string;
      callbacks: CloudTestsCallbacks;
      provider?: string;
      userFeedback?: string;
    }) => generateFeatureTests(featureId, projectId, callbacks, provider, userFeedback),
  });
}

export function useSaveFeatureTests(featureId: string | null, projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (testCases: CloudTestCase[]) => saveFeatureTests(featureId!, testCases),
    onSuccess: () => {
      if (featureId) queryClient.invalidateQueries({ queryKey: testCasesQueryKey(featureId) });
      if (projectId) queryClient.invalidateQueries({ queryKey: featuresQueryKey(projectId) });
    },
  });
}

export function testRunsQueryKey(featureId: string) {
  return ['features', featureId, 'test-runs'] as const;
}

export function useFeatureTestRuns(featureId: string | undefined) {
  const token = useAuthStore((s) => s.token);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: testRunsQueryKey(featureId ?? ''),
    queryFn: () => listTestRunsByFeature(featureId!),
    enabled: !!token && !!featureId,
  });

  return {
    runs: (data ?? []) as CloudTestRun[],
    loading: isLoading,
    error: error?.message ?? null,
    refetch,
  };
}

export function testRunDetailQueryKey(runId: string) {
  return ['test-runs', runId, 'detail'] as const;
}

export function useTestRunDetail(runId: string | undefined) {
  const token = useAuthStore((s) => s.token);

  const { data, isLoading, error } = useQuery({
    queryKey: testRunDetailQueryKey(runId ?? ''),
    queryFn: () => getTestRunDetail(runId!),
    enabled: !!token && !!runId,
  });

  return {
    runDetail: (data ?? null) as CloudTestRunDetail | null,
    loading: isLoading,
    error: error?.message ?? null,
  };
}

export function useUpdateProjectContext(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      images,
      texts,
      callbacks,
    }: {
      images: File[];
      texts: string[];
      callbacks: CloudContextUpdateCallbacks;
    }) => updateProjectContext(projectId, images, texts, callbacks),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectQueryKey(projectId) });
      queryClient.invalidateQueries({ queryKey: contextItemsQueryKey(projectId) });
    },
  });
}
