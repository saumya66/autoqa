// API Client for AutoQA Backend
// Per frontend_architecture_guide: Axios with interceptors

import axios from 'axios';
import { getBaseUrl, getCloudBaseUrl } from './config';
import { useAuthStore } from '@/store/authStore';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Cloud API client (auth, projects) - calls cloud backend directly
const cloudApiClient = axios.create({
  baseURL: getCloudBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Local: Set baseURL from getBaseUrl, add auth token when available
apiClient.interceptors.request.use(
  async (config) => {
    config.baseURL = await getBaseUrl();
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Cloud: Add auth token when available
cloudApiClient.interceptors.request.use(
  (config) => {
    config.baseURL = getCloudBaseUrl();
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response: Clear auth on 401 (invalid/expired token)
const clearAuthOn401 = (error: unknown) => {
  if ((error as { response?: { status?: number } })?.response?.status === 401) {
    useAuthStore.getState().clearAuth();
  }
  return Promise.reject(error);
};
apiClient.interceptors.response.use((r) => r, clearAuthOn401);
cloudApiClient.interceptors.response.use((r) => r, clearAuthOn401);

export default apiClient;

// Re-export for streaming (fetch required - Axios doesn't support SSE in browser)
export { getBaseUrl } from './config';

export interface WindowInfo {
  id: string;
  title: string;
  app_name: string;
  bounds: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
}

export interface StepResult {
  step_number: number;
  current_state: string;
  action: string;
  target?: string;
  value?: string;
  reasoning: string;
  success: boolean;
  coordinates?: [number, number];
  error?: string;
}

export interface AutoResponse {
  status: 'success' | 'partial' | 'failed' | 'max_steps_reached';
  goal: string;
  success: boolean;
  steps_taken: number;
  max_steps: number;
  final_state: string;
  steps: StepResult[];
}

export interface ExecutionRequest {
  instruction: string;
  window_title: string;
  max_steps?: number;
}

// Fetch available windows
export async function getWindows(): Promise<WindowInfo[]> {
  const response = await apiClient.get<WindowInfo[]>('/windows');
  return response.data;
}

// Check backend health
export async function checkHealth(): Promise<boolean> {
  try {
    const response = await apiClient.get('/windows', {
      timeout: 3000,
    });
    return response.status === 200;
  } catch {
    return false;
  }
}

// =============================================================================
// Auth (proxy to cloud)
// =============================================================================

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const response = await cloudApiClient.post<AuthResponse>('/api/v1/auth/login', {
    email,
    password,
  });
  return response.data;
}

export async function register(
  email: string,
  password: string,
  name?: string
): Promise<AuthResponse> {
  const response = await cloudApiClient.post<AuthResponse>('/api/v1/auth/register', {
    email,
    password,
    name,
  });
  return response.data;
}

export async function getMe(): Promise<AuthUser> {
  const response = await cloudApiClient.get<AuthUser>('/api/v1/auth/me');
  return response.data;
}

// =============================================================================
// Projects (requires auth; proxied to cloud)
// =============================================================================

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description?: string | null;
  context_summary?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectCreateInput {
  name: string;
  description?: string;
  context_summary?: string;
}

export interface ProjectUpdateInput {
  name?: string;
  description?: string;
  context_summary?: string;
}

// =============================================================================
// Features (cloud direct)
// =============================================================================

export interface Feature {
  id: string;
  project_id: string;
  name: string;
  description?: string | null;
  context_summary?: string | null;
  status: string;
  provider: string;
  created_at: string;
  updated_at: string;
}

export async function createCloudFeature(
  projectId: string,
  name: string,
  description?: string
): Promise<Feature> {
  const response = await cloudApiClient.post<Feature>('/api/v1/features/', {
    project_id: projectId,
    name,
    description,
  });
  return response.data;
}

export async function listFeaturesByProject(projectId: string): Promise<Feature[]> {
  const response = await cloudApiClient.get<Feature[]>(
    `/api/v1/features/by-project/${projectId}`
  );
  return response.data;
}

// =============================================================================
// Project Context Items (cloud direct)
// =============================================================================

export interface CloudContextItem {
  id: string;
  level: 'project' | 'feature';
  level_id: string;
  type: 'image' | 'text';
  filename?: string | null;
  /** base64 string for images; raw text content for text items */
  content?: string | null;
  file_size?: number | null;
  created_at: string;
}

export async function listProjectContextItems(projectId: string): Promise<CloudContextItem[]> {
  const response = await cloudApiClient.get<CloudContextItem[]>('/api/v1/context-items/', {
    params: { level: 'project', level_id: projectId },
  });
  return response.data;
}

export interface CloudContextUpdateCallbacks {
  onProgress?: (message: string) => void;
  onDone?: (contextSummary: string) => void;
  onError?: (message: string) => void;
}

export async function updateProjectContext(
  projectId: string,
  images: File[],
  texts: string[],
  callbacks: CloudContextUpdateCallbacks
): Promise<void> {
  const token = useAuthStore.getState().token;
  const imagePayloads = images.length > 0
    ? await Promise.all(images.map(async (f) => ({
        filename: f.name,
        content_b64: await fileToBase64(f),
        file_size: f.size,
      })))
    : [];

  const response = await streamLocalFetch(`/cloud/project/${projectId}/update-context`, {
    images: imagePayloads,
    texts,
    token,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error((err as { detail?: string }).detail || 'Request failed');
  }

  await readSSEStream(response, (event) => {
    const e = event as { event: string; message?: string; context_summary?: string };
    switch (e.event) {
      case 'progress':
        callbacks.onProgress?.(e.message ?? '');
        break;
      case 'done':
        callbacks.onDone?.(e.context_summary ?? '');
        break;
      case 'error':
        callbacks.onError?.(e.message ?? 'Unknown error');
        break;
    }
  });
}

export async function listProjects(): Promise<Project[]> {
  const response = await cloudApiClient.get<Project[]>('/api/v1/projects/');
  return response.data;
}

export async function createProject(input: ProjectCreateInput): Promise<Project> {
  const response = await cloudApiClient.post<Project>('/api/v1/projects/', input);
  return response.data;
}

export async function getProject(projectId: string): Promise<Project> {
  const response = await cloudApiClient.get<Project>(`/api/v1/projects/${projectId}`);
  return response.data;
}

export async function updateProject(
  projectId: string,
  input: ProjectUpdateInput
): Promise<Project> {
  const response = await cloudApiClient.patch<Project>(
    `/api/v1/projects/${projectId}`,
    input
  );
  return response.data;
}

export async function deleteProject(projectId: string): Promise<void> {
  await cloudApiClient.delete(`/api/v1/projects/${projectId}`);
}

// Execute autonomous task
export async function executeAuto(request: ExecutionRequest): Promise<AutoResponse> {
  const response = await apiClient.post<AutoResponse>('/auto', {
    instruction: request.instruction,
    window_title: request.window_title,
    max_steps: request.max_steps || 15,
  });
  return response.data;
}

// Get screenshot of a window
export async function getWindowScreenshot(windowTitle: string): Promise<string> {
  const response = await apiClient.get<{ screenshot: string }>(
    `/screenshot?window_title=${encodeURIComponent(windowTitle)}`
  );
  return response.data.screenshot;
}

// =============================================================================
// SSE Streaming Types
// =============================================================================

export interface SSEStartEvent {
  event: 'start';
  goal: string;
  window: string;
  max_steps: number;
}

export interface SSEStatusEvent {
  event: 'status';
  message: string;
}

export interface SSEStepEvent {
  event: 'step';
  step: StepResult;
}

export interface SSECompleteEvent {
  event: 'complete';
  status: string;
  success: boolean;
  steps_taken: number;
  final_state: string;
}

export interface SSEErrorEvent {
  event: 'error';
  message: string;
}

export type SSEEvent = SSEStartEvent | SSEStatusEvent | SSEStepEvent | SSECompleteEvent | SSEErrorEvent;

export interface StreamCallbacks {
  onStart?: (data: SSEStartEvent) => void;
  onStatus?: (message: string) => void;
  onStep?: (step: StepResult) => void;
  onComplete?: (data: SSECompleteEvent) => void;
  onError?: (message: string) => void;
}

// =============================================================================
// Feature Context Types
// =============================================================================

export interface ContextItem {
  id: string;
  type: 'image' | 'document' | 'video' | 'text';
  source_name: string;
  extracted: Record<string, unknown>;
  created_at: string;
}

export interface FeatureContext {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'ready' | 'processing' | 'completed';
  created_at: string;
  items: ContextItem[];
  summary: {
    total_items: number;
    images: number;
    documents: number;
    videos: number;
    text_notes: number;
  };
}

export interface CreateContextRequest {
  name: string;
  description?: string;
}

// =============================================================================
// Feature Context API
// =============================================================================

export async function createFeatureContext(request: CreateContextRequest): Promise<{
  context_id: string;
  name: string;
  created_at: string;
}> {
  const response = await apiClient.post('/feature/create', request);
  return response.data;
}

export async function listFeatureContexts(): Promise<FeatureContext[]> {
  const response = await apiClient.get<{ contexts: FeatureContext[] }>('/feature/list');
  return response.data.contexts;
}

export async function getFeatureContext(contextId: string): Promise<FeatureContext> {
  const response = await apiClient.get<{ context: FeatureContext }>(`/feature/${contextId}`);
  return response.data.context;
}

export async function deleteFeatureContext(contextId: string): Promise<void> {
  await apiClient.delete(`/feature/${contextId}`);
}

export async function addImageToContext(
  contextId: string,
  file: File,
  additionalContext?: string
): Promise<ContextItem> {
  const formData = new FormData();
  formData.append('file', file);
  if (additionalContext) {
    formData.append('additional_context', additionalContext);
  }
  const response = await apiClient.post<ContextItem>(`/feature/${contextId}/image`, formData);
  return response.data;
}

export async function addDocumentToContext(
  contextId: string,
  file: File,
  additionalContext?: string
): Promise<ContextItem> {
  const formData = new FormData();
  formData.append('file', file);
  if (additionalContext) {
    formData.append('additional_context', additionalContext);
  }
  const response = await apiClient.post<ContextItem>(`/feature/${contextId}/document`, formData);
  return response.data;
}

export async function addVideoToContext(
  contextId: string,
  file: File,
  additionalContext?: string
): Promise<ContextItem> {
  const formData = new FormData();
  formData.append('file', file);
  if (additionalContext) {
    formData.append('additional_context', additionalContext);
  }
  const response = await apiClient.post<ContextItem>(`/feature/${contextId}/video`, formData);
  return response.data;
}

export async function addTextToContext(
  contextId: string,
  text: string,
  sourceName?: string
): Promise<ContextItem> {
  const response = await apiClient.post<ContextItem>(`/feature/${contextId}/text`, {
    text,
    source_name: sourceName || 'user_notes',
  });
  return response.data;
}

// =============================================================================
// Context Building Types
// =============================================================================

export interface ProcessedItemSummary {
  id: string;
  type: string;
  source_name: string;
  processed: boolean;
  extracted_summary: string;
}

export interface ContextSummary {
  screens_detected: Array<{ name: string; source: string; description: string }>;
  ui_elements: Array<{ type: string; label: string; location: string }>;
  requirements: Array<{ text: string; priority: string }>;
  user_flows: Array<{ name: string; steps: string[] }>;
  text_notes: string[];
}

export interface BuildContextResponse {
  success: boolean;
  context_id: string;
  feature_name: string;
  summary: ContextSummary;
  processed_items: ProcessedItemSummary[];
  status: string;
  message: string;
  has_feedback?: boolean;
}

export async function buildContext(
  contextId: string,
  userFeedback?: string
): Promise<BuildContextResponse> {
  const response = await apiClient.post<BuildContextResponse>(
    `/feature/${contextId}/build-context`,
    { user_feedback: userFeedback || '' }
  );
  return response.data;
}

// =============================================================================
// Test Generation Types
// =============================================================================

export interface TestCase {
  id: string;
  name: string;
  description: string;
  category: string;
  priority: 'must' | 'should' | 'could';
  steps: string[];
  expected_result: string;
  excluded?: boolean;
}

export interface TestPlanResponse {
  success: boolean;
  context_id: string;
  feature_name: string;
  feature_summary: string;
  test_count: number;
  test_cases: TestCase[];
  coverage_notes: string;
  status: string;
  message: string;
}

export interface ExecutableStep {
  step_number: number;
  action: 'click' | 'type' | 'scroll' | 'wait' | 'verify';
  target: string;
  value?: string;
  expected_state?: string;
}

export interface ExecutableTest {
  test_id: string;
  test_name: string;
  steps: ExecutableStep[];
}

export interface ApproveTestsResponse {
  success: boolean;
  context_id: string;
  feature_name: string;
  test_count: number;
  test_cases: TestCase[];
  status: string;
  message: string;
}

export async function generateTestPlan(contextId: string): Promise<TestPlanResponse> {
  const response = await apiClient.post<TestPlanResponse>(`/feature/${contextId}/generate-plan`);
  return response.data;
}

export async function getTestPlan(contextId: string): Promise<TestPlanResponse | null> {
  try {
    const response = await apiClient.get<TestPlanResponse>(`/feature/${contextId}/tests`);
    return response.data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      return null;
    }
    throw err;
  }
}

export async function approveAndGenerateTests(
  contextId: string,
  approvedTestIds?: string[]
): Promise<ApproveTestsResponse> {
  const response = await apiClient.post<ApproveTestsResponse>(
    `/feature/${contextId}/approve-tests`,
    { approved_test_ids: approvedTestIds }
  );
  return response.data;
}

export async function provideGuidance(
  contextId: string,
  testId: string,
  guidance: string
): Promise<{ success: boolean; message: string; guidance: string }> {
  const response = await apiClient.post(`/feature/${contextId}/execute/${testId}/guidance`, {
    guidance,
  });
  return response.data;
}

export async function updateTestCase(
  contextId: string,
  testId: string,
  updates: Partial<TestCase>
): Promise<void> {
  await apiClient.patch(`/feature/${contextId}/tests/${testId}`, updates);
}

// =============================================================================
// Test Execution Types & SSE (fetch required - Axios doesn't support SSE)
// =============================================================================

export interface ExecuteTestsRequest {
  window_title: string;
  test_ids?: string[];
  provider?: CUProvider;
  cloud_feature_id?: string;
  cloud_user_id?: string;
  cloud_token?: string;
}

export interface TestSuiteStartEvent {
  event: 'suite_start';
  context_id: string;
  window: string;
  total_tests: number;
}

export interface TestStartEvent {
  event: 'test_start';
  test_id: string;
  title: string;
  test_number: number;
  total_tests: number;
  goal: string;
}

export interface StepEvent {
  event: 'step';
  test_id: string;
  step_number: number;
  action: string;
  target?: string;
  value?: string;
  reasoning: string;
  current_state: string;
  success: boolean;
  coordinates?: [number, number];
  error?: string;
}

export interface NeedHelpEvent {
  event: 'need_help';
  test_id: string;
  step_number: number;
  current_state: string;
  reasoning: string;
  question: string;
}

export interface TestCompleteEvent {
  event: 'test_complete';
  test_id: string;
  status: 'passed' | 'failed';
  steps_executed: number;
  conclusion?: string;
}

export interface SuiteCompleteEvent {
  event: 'suite_complete';
  passed: number;
  failed: number;
  skipped: number;
  total: number;
}

export interface TestSkipEvent {
  event: 'test_skip';
  test_id: string;
  reason: string;
}

export type TestExecutionEvent =
  | TestSuiteStartEvent
  | TestStartEvent
  | StepEvent
  | NeedHelpEvent
  | TestCompleteEvent
  | SuiteCompleteEvent
  | TestSkipEvent;

export interface ExecutionCallbacks {
  onSuiteStart?: (data: TestSuiteStartEvent) => void;
  onTestStart?: (data: TestStartEvent) => void;
  onStep?: (data: StepEvent) => void;
  onNeedHelp?: (data: NeedHelpEvent) => void;
  onTestComplete?: (data: TestCompleteEvent) => void;
  onSuiteComplete?: (data: SuiteCompleteEvent) => void;
  onTestSkip?: (data: TestSkipEvent) => void;
  onError?: (message: string) => void;
}

async function streamFetch(
  url: string,
  init?: RequestInit
): Promise<Response> {
  const baseUrl = await getBaseUrl();
  return fetch(`${baseUrl}${url}`, init);
}

export async function executeTestsStream(
  contextId: string,
  request: ExecuteTestsRequest,
  callbacks: ExecutionCallbacks
): Promise<void> {
  const response = await streamFetch(`/feature/${contextId}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error((error as { detail?: string }).detail || 'Execution failed');
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6).trim();
          if (jsonStr) {
            try {
              const event = JSON.parse(jsonStr) as TestExecutionEvent;
              switch (event.event) {
                case 'suite_start':
                  callbacks.onSuiteStart?.(event);
                  break;
                case 'test_start':
                  callbacks.onTestStart?.(event);
                  break;
                case 'step':
                  callbacks.onStep?.(event);
                  break;
                case 'need_help':
                  callbacks.onNeedHelp?.(event);
                  break;
                case 'test_complete':
                  callbacks.onTestComplete?.(event);
                  break;
                case 'suite_complete':
                  callbacks.onSuiteComplete?.(event);
                  break;
                case 'test_skip':
                  callbacks.onTestSkip?.(event);
                  break;
              }
            } catch (e) {
              console.error('Failed to parse execution event:', jsonStr, e);
            }
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function executeAutoStream(
  request: ExecutionRequest,
  callbacks: StreamCallbacks
): Promise<void> {
  const response = await streamFetch('/auto/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instruction: request.instruction,
      window_title: request.window_title,
      max_steps: request.max_steps || 15,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error((error as { detail?: string }).detail || 'Execution failed');
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6).trim();
          if (jsonStr) {
            try {
              const event = JSON.parse(jsonStr) as SSEEvent;
              switch (event.event) {
                case 'start':
                  callbacks.onStart?.(event);
                  break;
                case 'status':
                  callbacks.onStatus?.(event.message);
                  break;
                case 'step':
                  callbacks.onStep?.(event.step);
                  break;
                case 'complete':
                  callbacks.onComplete?.(event);
                  break;
                case 'error':
                  callbacks.onError?.(event.message);
                  break;
              }
            } catch (e) {
              console.error('Failed to parse SSE event:', jsonStr, e);
            }
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// =============================================================================
// Computer Use SSE
// =============================================================================

export interface CUActionStep {
  step_number: number;
  action: string;
  args: Record<string, unknown>;
  success: boolean;
  result?: { coordinates?: [number, number] };
  error?: string;
  safety_warning?: string;
  reasoning?: string;
}

export interface CUStartEvent {
  event: 'start';
  goal: string;
  window: string;
  max_steps: number;
  model: string;
}

export interface CUActionEvent {
  event: 'action';
  step: CUActionStep;
}

export interface CUThinkingEvent {
  event: 'thinking';
  text: string;
}

export interface CUCompleteEvent {
  event: 'complete';
  status: string;
  success: boolean;
  steps_taken: number;
  final_message: string;
}

export interface CUSafetyEvent {
  event: 'safety';
  explanation: string;
  action: string;
}

export type CUEvent =
  | CUStartEvent
  | SSEStatusEvent
  | CUActionEvent
  | CUThinkingEvent
  | CUCompleteEvent
  | CUSafetyEvent
  | SSEErrorEvent;

export interface CUStreamCallbacks {
  onStart?: (data: CUStartEvent) => void;
  onStatus?: (message: string) => void;
  onThinking?: (text: string) => void;
  onAction?: (step: CUActionStep) => void;
  onSafety?: (data: CUSafetyEvent) => void;
  onComplete?: (data: CUCompleteEvent) => void;
  onError?: (message: string) => void;
}

export type CUProvider = 'gemini' | 'claude';

// =============================================================================
// Cloud-backed Project + Feature Context SSE
// =============================================================================

export interface CloudSSEProgressEvent {
  event: 'progress';
  message: string;
}
export interface CloudSSEDoneProjectEvent {
  event: 'done';
  project: Project;
}
export interface CloudSSEDoneContextEvent {
  event: 'done';
  summary: ContextSummary;
  context_summary: string;
}
export interface CloudSSEDoneTestsEvent {
  event: 'done';
  feature_summary: string;
  test_cases: TestCase[];
  coverage_notes: string;
}
export interface CloudSSEErrorEvent {
  event: 'error';
  message: string;
}

export interface CloudProjectCallbacks {
  onProgress?: (message: string) => void;
  onDone?: (project: Project) => void;
  onError?: (message: string) => void;
}

export interface CloudContextCallbacks {
  onProgress?: (message: string) => void;
  onDone?: (summary: ContextSummary, contextSummary: string) => void;
  onError?: (message: string) => void;
}

export interface CloudTestsCallbacks {
  onProgress?: (message: string) => void;
  onDone?: (featureSummary: string, testCases: TestCase[], coverageNotes: string) => void;
  onError?: (message: string) => void;
}

async function streamLocalFetch(url: string, body: unknown): Promise<Response> {
  const baseUrl = await getBaseUrl();
  const token = useAuthStore.getState().token;
  return fetch(`${baseUrl}${url}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function readSSEStream<T>(
  response: Response,
  onEvent: (event: T) => void
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6).trim();
          if (jsonStr) {
            try { onEvent(JSON.parse(jsonStr) as T); } catch { /* skip */ }
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/** Convert a File to base64 string (without data URL prefix). */
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function createProjectWithContext(
  name: string,
  description: string | undefined,
  images: File[],
  texts: string[],
  callbacks: CloudProjectCallbacks
): Promise<void> {
  const token = useAuthStore.getState().token;
  const imagePayloads = await Promise.all(
    images.map(async (f) => ({
      filename: f.name,
      content_b64: await fileToBase64(f),
      file_size: f.size,
    }))
  );
  const response = await streamLocalFetch('/cloud/project/create', {
    name,
    description,
    images: imagePayloads,
    texts,
    token,
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error((err as { detail?: string }).detail || 'Request failed');
  }
  await readSSEStream<CloudSSEProgressEvent | CloudSSEDoneProjectEvent | CloudSSEErrorEvent>(
    response,
    (ev) => {
      if (ev.event === 'progress') callbacks.onProgress?.(ev.message);
      else if (ev.event === 'done') callbacks.onDone?.((ev as CloudSSEDoneProjectEvent).project);
      else if (ev.event === 'error') callbacks.onError?.(ev.message);
    }
  );
}

export async function buildFeatureContext(
  featureId: string,
  projectId: string,
  userFeedback: string | undefined,
  callbacks: CloudContextCallbacks,
  images?: File[],
  texts?: string[]
): Promise<void> {
  const token = useAuthStore.getState().token;
  const imagePayloads = images && images.length > 0
    ? await Promise.all(images.map(async (f) => ({
        filename: f.name,
        content_b64: await fileToBase64(f),
        file_size: f.size,
      })))
    : [];
  const response = await streamLocalFetch(`/cloud/feature/${featureId}/build-context`, {
    feature_id: featureId,
    project_id: projectId,
    token,
    user_feedback: userFeedback,
    images: imagePayloads,
    texts: texts ?? [],
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error((err as { detail?: string }).detail || 'Request failed');
  }
  await readSSEStream<CloudSSEProgressEvent | CloudSSEDoneContextEvent | CloudSSEErrorEvent>(
    response,
    (ev) => {
      if (ev.event === 'progress') callbacks.onProgress?.(ev.message);
      else if (ev.event === 'done') callbacks.onDone?.((ev as CloudSSEDoneContextEvent).summary, (ev as CloudSSEDoneContextEvent).context_summary);
      else if (ev.event === 'error') callbacks.onError?.(ev.message);
    }
  );
}

export async function generateFeatureTests(
  featureId: string,
  projectId: string,
  callbacks: CloudTestsCallbacks,
  provider: string = 'claude'
): Promise<void> {
  const token = useAuthStore.getState().token;
  const response = await streamLocalFetch(`/cloud/feature/${featureId}/generate-tests`, {
    feature_id: featureId,
    project_id: projectId,
    token,
    provider,
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error((err as { detail?: string }).detail || 'Request failed');
  }
  await readSSEStream<CloudSSEProgressEvent | CloudSSEDoneTestsEvent | CloudSSEErrorEvent>(
    response,
    (ev) => {
      if (ev.event === 'progress') callbacks.onProgress?.(ev.message);
      else if (ev.event === 'done') {
        const d = ev as CloudSSEDoneTestsEvent;
        callbacks.onDone?.(d.feature_summary, d.test_cases, d.coverage_notes);
      }
      else if (ev.event === 'error') callbacks.onError?.(ev.message);
    }
  );
}

export async function saveFeatureTests(
  featureId: string,
  testCases: TestCase[]
): Promise<void> {
  const token = useAuthStore.getState().token;
  const baseUrl = await getBaseUrl();
  const response = await fetch(`${baseUrl}/cloud/feature/${featureId}/save-tests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ feature_id: featureId, token, test_cases: testCases }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error((err as { detail?: string }).detail || 'Failed to save tests');
  }
}

export async function executeCUStream(
  request: ExecutionRequest,
  callbacks: CUStreamCallbacks,
  provider: CUProvider = 'claude'
): Promise<void> {
  const endpoint = provider === 'claude' ? '/claude-cu/stream' : '/cu/stream';
  const response = await streamFetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instruction: request.instruction,
      window_title: request.window_title,
      max_steps: request.max_steps || 25,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error((error as { detail?: string }).detail || 'Execution failed');
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;
          try {
            const event = JSON.parse(jsonStr) as CUEvent;
            switch (event.event) {
              case 'start':
                callbacks.onStart?.(event);
                break;
              case 'status':
                callbacks.onStatus?.(event.message);
                break;
              case 'thinking':
                callbacks.onThinking?.(event.text);
                break;
              case 'action':
                callbacks.onAction?.(event.step);
                break;
              case 'safety':
                callbacks.onSafety?.(event);
                break;
              case 'complete':
                callbacks.onComplete?.(event);
                break;
              case 'error':
                callbacks.onError?.(event.message);
                break;
            }
          } catch (e) {
            console.error('Failed to parse CU event:', jsonStr, e);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
