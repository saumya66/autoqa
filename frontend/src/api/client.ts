// API Client for AutoQA Backend

const BASE_URL = 'http://localhost:8000';

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
  const response = await fetch(`${BASE_URL}/windows`);
  if (!response.ok) {
    throw new Error(`Failed to fetch windows: ${response.statusText}`);
  }
  return response.json();
}

// Check backend health
export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/windows`, { 
      method: 'GET',
      signal: AbortSignal.timeout(3000) 
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Execute autonomous task
export async function executeAuto(request: ExecutionRequest): Promise<AutoResponse> {
  const response = await fetch(`${BASE_URL}/auto`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      instruction: request.instruction,
      window_title: request.window_title,
      max_steps: request.max_steps || 15,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || 'Execution failed');
  }
  
  return response.json();
}

// Get screenshot of a window (we'll add this endpoint to backend)
export async function getWindowScreenshot(windowTitle: string): Promise<string> {
  const response = await fetch(`${BASE_URL}/screenshot?window_title=${encodeURIComponent(windowTitle)}`);
  if (!response.ok) {
    throw new Error('Failed to get screenshot');
  }
  const data = await response.json();
  return data.screenshot; // base64 encoded
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

// =============================================================================
// SSE Streaming Execution
// =============================================================================

export interface StreamCallbacks {
  onStart?: (data: SSEStartEvent) => void;
  onStatus?: (message: string) => void;
  onStep?: (step: StepResult) => void;
  onComplete?: (data: SSECompleteEvent) => void;
  onError?: (message: string) => void;
}

// =============================================================================
// Feature Context Types (for Test Generation)
// =============================================================================

export interface ContextItem {
  id: string;
  type: 'image' | 'document' | 'video' | 'text';
  source_name: string;
  extracted: Record<string, any>;
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
  const response = await fetch(`${BASE_URL}/feature/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || 'Failed to create context');
  }
  
  const data = await response.json();
  return data;
}

export async function listFeatureContexts(): Promise<FeatureContext[]> {
  const response = await fetch(`${BASE_URL}/feature/list`);
  if (!response.ok) {
    throw new Error('Failed to fetch contexts');
  }
  const data = await response.json();
  return data.contexts;
}

export async function getFeatureContext(contextId: string): Promise<FeatureContext> {
  const response = await fetch(`${BASE_URL}/feature/${contextId}`);
  if (!response.ok) {
    throw new Error('Context not found');
  }
  const data = await response.json();
  return data.context;
}

export async function deleteFeatureContext(contextId: string): Promise<void> {
  const response = await fetch(`${BASE_URL}/feature/${contextId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete context');
  }
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
  
  const response = await fetch(`${BASE_URL}/feature/${contextId}/image`, {
    method: 'POST',
    body: formData,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || 'Failed to add image');
  }
  
  return response.json();
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
  
  const response = await fetch(`${BASE_URL}/feature/${contextId}/document`, {
    method: 'POST',
    body: formData,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || 'Failed to add document');
  }
  
  return response.json();
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
  
  const response = await fetch(`${BASE_URL}/feature/${contextId}/video`, {
    method: 'POST',
    body: formData,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || 'Failed to add video');
  }
  
  return response.json();
}

export async function addTextToContext(
  contextId: string,
  text: string,
  sourceName?: string
): Promise<ContextItem> {
  const response = await fetch(`${BASE_URL}/feature/${contextId}/text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, source_name: sourceName || 'user_notes' }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || 'Failed to add text');
  }
  
  return response.json();
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
  screens_detected: Array<{name: string; source: string; description: string}>;
  ui_elements: Array<{type: string; label: string; location: string}>;
  requirements: Array<{text: string; priority: string}>;
  user_flows: Array<{name: string; steps: string[]}>;
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
}

/**
 * Build context - uploads and processes all items, returns summary
 * @param userFeedback Optional feedback/corrections to improve context understanding
 */
export async function buildContext(contextId: string, userFeedback?: string): Promise<BuildContextResponse> {
  const response = await fetch(`${BASE_URL}/feature/${contextId}/build-context`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_feedback: userFeedback || '' }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || 'Failed to build context');
  }
  
  return response.json();
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
  executable_tests: ExecutableTest[];
  status: string;
  message: string;
}

// =============================================================================
// Test Generation API
// =============================================================================

/**
 * Step 1: Generate text-based test cases for user review
 */
export async function generateTestPlan(contextId: string): Promise<TestPlanResponse> {
  const response = await fetch(`${BASE_URL}/feature/${contextId}/generate-plan`, {
    method: 'POST',
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || 'Failed to generate test plan');
  }
  
  return response.json();
}

/**
 * Get existing test plan (if already generated)
 */
export async function getTestPlan(contextId: string): Promise<TestPlanResponse | null> {
  const response = await fetch(`${BASE_URL}/feature/${contextId}/tests`);
  
  if (response.status === 404) {
    return null;
  }
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || 'Failed to fetch test plan');
  }
  
  return response.json();
}

/**
 * Step 2: Approve tests and generate executable JSON
 */
export async function approveAndGenerateTests(
  contextId: string,
  approvedTestIds?: string[]
): Promise<ApproveTestsResponse> {
  const response = await fetch(`${BASE_URL}/feature/${contextId}/approve-tests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approved_test_ids: approvedTestIds }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || 'Failed to approve tests');
  }
  
  return response.json();
}

/**
 * Update a specific test case
 */
export async function updateTestCase(
  contextId: string,
  testId: string,
  updates: Partial<TestCase>
): Promise<void> {
  const response = await fetch(`${BASE_URL}/feature/${contextId}/tests/${testId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || 'Failed to update test case');
  }
}

// =============================================================================
// Test Execution Types
// =============================================================================

export interface ExecuteTestsRequest {
  window_title: string;
  test_ids?: string[];
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
  starting_state: string;
  ending_state: string;
}

export interface StepStartEvent {
  event: 'step_start';
  test_id: string;
  step_number: number;
  phase: 'setup' | 'test' | 'cleanup';
  action: string;
  target: string;
}

export interface StepCompleteEvent {
  event: 'step_complete';
  test_id: string;
  step_number: number;
  phase: string;
  action: string;
  target: string;
  success: boolean;
  coordinates?: [number, number];
  error?: string;
}

export interface TestCompleteEvent {
  event: 'test_complete';
  test_id: string;
  status: 'passed' | 'failed';
  steps_executed: number;
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
  | StepStartEvent 
  | StepCompleteEvent 
  | TestCompleteEvent 
  | SuiteCompleteEvent
  | TestSkipEvent;

export interface ExecutionCallbacks {
  onSuiteStart?: (data: TestSuiteStartEvent) => void;
  onTestStart?: (data: TestStartEvent) => void;
  onStepStart?: (data: StepStartEvent) => void;
  onStepComplete?: (data: StepCompleteEvent) => void;
  onTestComplete?: (data: TestCompleteEvent) => void;
  onSuiteComplete?: (data: SuiteCompleteEvent) => void;
  onTestSkip?: (data: TestSkipEvent) => void;
  onError?: (message: string) => void;
}

/**
 * Execute tests with SSE streaming
 */
export async function executeTestsStream(
  contextId: string,
  request: ExecuteTestsRequest,
  callbacks: ExecutionCallbacks
): Promise<void> {
  const response = await fetch(`${BASE_URL}/feature/${contextId}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || 'Execution failed');
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

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
                case 'step_start':
                  callbacks.onStepStart?.(event);
                  break;
                case 'step_complete':
                  callbacks.onStepComplete?.(event);
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

// =============================================================================
// SSE Streaming Execution
// =============================================================================

export async function executeAutoStream(
  request: ExecutionRequest,
  callbacks: StreamCallbacks
): Promise<void> {
  const response = await fetch(`${BASE_URL}/auto/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      instruction: request.instruction,
      window_title: request.window_title,
      max_steps: request.max_steps || 15,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || 'Execution failed');
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      
      // Process complete SSE messages
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6).trim();
          if (jsonStr) {
            try {
              const event: SSEEvent = JSON.parse(jsonStr);
              
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
