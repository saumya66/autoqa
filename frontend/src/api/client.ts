// API Client for AutoQA Backend
// Per frontend_architecture_guide: Axios with interceptors

import axios from 'axios';
import { getBaseUrl } from './config';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request: Set baseURL from getBaseUrl (supports Electron runtime config)
apiClient.interceptors.request.use(
  async (config) => {
    const baseUrl = await getBaseUrl();
    config.baseURL = baseUrl;
    return config;
  },
  (error) => Promise.reject(error)
);

// Response: Pass through, 401 handling can be added when auth exists
apiClient.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error)
);

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
