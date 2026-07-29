import { create } from 'zustand';
import {
  executeTestsStream,
  provideGuidance,
  pauseExecution as apiPauseExecution,
  resumeExecution as apiResumeExecution,
  abortExecution as apiAbortExecution,
  CUProvider,
  type CloudTestCase,
  type TestStartEvent,
  type StepEvent,
  type NeedHelpEvent,
  type PausedEvent,
  type TestCompleteEvent,
  type SuiteCompleteEvent,
  type ContextLearnedEvent,
  type ContextLearningWarningEvent,
  type StepRecord,
  type CloudTestRunDetail,
} from '../api/client';
import { useKeyStore } from './keyStore';

export type TestRunStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
export type SuiteRunStatus = 'idle' | 'running' | 'complete' | 'error' | 'aborted';

export interface TestRun {
  id: string;
  test_key: string;
  title: string;
  goal: string;
  expected_result?: string | null;
  status: TestRunStatus;
  conclusion?: string;
  steps_executed?: number;
  test_number?: number;
}

export interface ActivityEntry extends Partial<StepRecord> {
  id: string;
  time: string;
  testId: string;
  action: string;
  description: string;
  type: 'click' | 'type' | 'scroll' | 'observe' | 'navigate' | 'wait' | 'guidance' | 'other';
  success: boolean;
  confidence?: 'high' | 'medium' | 'low' | null;
}

export interface GuidanceNeeded {
  testId: string;
  question: string;
  currentState: string;
  confidence?: 'high' | 'medium' | 'low';
}

function getActivityType(action: string): ActivityEntry['type'] {
  const a = action.toLowerCase();
  if (a.includes('click')) return 'click';
  if (a.includes('type') || a.includes('text') || a.includes('key')) return 'type';
  if (a.includes('scroll')) return 'scroll';
  if (a.includes('navigate') || a.includes('url') || a.includes('open') || a.includes('go')) return 'navigate';
  if (a.includes('wait')) return 'wait';
  if (a.includes('screenshot') || a.includes('observe') || a.includes('scan') || a.includes('search')) return 'observe';
  return 'other';
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

interface TestSuiteExecutionState {
  status: SuiteRunStatus;
  featureId: string | null;
  featureName: string | null;
  windowTitle: string | null;
  tests: TestRun[];
  currentTestId: string | null;
  activityLog: ActivityEntry[];
  thinking: string;
  suiteResult: { passed: number; failed: number; skipped: number; total: number } | null;
  error: string | null;

  // Guidance / pause state
  guidanceNeeded: GuidanceNeeded | null;
  isPaused: boolean;

  // Pending acknowledgement — true from the moment button is pressed until backend confirms
  isPausePending: boolean;
  isAbortPending: boolean;
  projectLearningStatus: 'idle' | 'learning' | 'updated' | 'warning';
  projectLearningMessage: string | null;

  setInitialTests: (tests: CloudTestCase[]) => void;
  startExecution: (params: {
    featureId: string;
    featureName: string;
    windowTitle: string;
    provider: CUProvider;
    token: string;
    userId: string;
  }) => Promise<void>;

  /** Submit guidance when the agent is stuck or paused */
  submitGuidance: (guidance: string) => Promise<void>;
  /** Manually pause execution after the current step */
  pauseExecution: () => Promise<void>;
  /** Resume execution after a manual pause, optionally with guidance */
  resumeExecution: (guidance?: string) => Promise<void>;
  /** Abort the entire run immediately */
  abortExecution: () => Promise<void>;
  /** Load a completed past run for replay — merges testCases metadata with run results */
  loadPastRun: (testCases: CloudTestCase[], runDetail: CloudTestRunDetail) => void;

  reset: () => void;
}

// AbortController lives outside Zustand state (non-serialisable)
let _abortController: AbortController | null = null;
let _executionId: string | null = null;

export const useTestSuiteExecutionStore = create<TestSuiteExecutionState>((set, get) => ({
  status: 'idle',
  featureId: null,
  featureName: null,
  windowTitle: null,
  tests: [],
  currentTestId: null,
  activityLog: [],
  thinking: '',
  suiteResult: null,
  error: null,
  guidanceNeeded: null,
  isPaused: false,
  isPausePending: false,
  isAbortPending: false,
  projectLearningStatus: 'idle',
  projectLearningMessage: null,

  setInitialTests: (testCases: CloudTestCase[]) => {
    set({
      tests: testCases.map((tc, i) => ({
        id: tc.id ?? `tc-${i}`,
        test_key: tc.test_key ?? `TC-${String(i + 1).padStart(3, '0')}`,
        title: tc.title,
        goal: tc.goal,
        expected_result: tc.expected_result,
        status: 'pending',
      })),
    });
  },

  startExecution: async ({ featureId, featureName, windowTitle, provider, token, userId }) => {
    const existingTests = get().tests;
    const executionId = globalThis.crypto.randomUUID();

    // Stop reading callbacks from any superseded stream. The backend separately
    // marks the previous execution as superseded when this run registers.
    _abortController?.abort();
    // Create a fresh AbortController for this run
    _abortController = new AbortController();
    _executionId = executionId;

    set({
      status: 'running',
      featureId,
      featureName,
      windowTitle,
      tests: existingTests.map((t) => ({ ...t, status: 'pending' })),
      currentTestId: null,
      activityLog: [],
      thinking: '',
      suiteResult: null,
      error: null,
      guidanceNeeded: null,
      isPaused: false,
      projectLearningStatus: 'idle',
      projectLearningMessage: null,
    });

    try {
      await executeTestsStream(
        featureId,
        {
          window_title: windowTitle,
          execution_id: executionId,
          provider,
          cloud_feature_id: featureId,
          cloud_user_id: userId,
          cloud_token: token,
          anthropic_api_key: useKeyStore.getState().anthropicKey,
        },
        {
          onSuiteStart: () => {},

          onTestStart: (data: TestStartEvent) => {
            set((state) => ({
              tests: state.tests.map((t) =>
                t.id === data.test_id
                  ? { ...t, status: 'running', test_number: data.test_number }
                  : t.status === 'running'
                  ? { ...t, status: 'pending' }
                  : t
              ),
              currentTestId: data.test_id,
              // NOTE: Do NOT reset activityLog here — logs accumulate across all
              // tests so the user can browse previous test logs while a new one runs.
              thinking: '',
              guidanceNeeded: null,
              isPaused: false,
            }));
          },

          onStep: (data: StepEvent) => {
            const description =
              data.description?.trim() ||
              data.reasoning?.trim() ||
              `${data.action}${data.target ? ` → ${data.target}` : ''}${data.value ? ` at ${data.value}` : ''}`;

            const time = data.timestamp
              ? formatTime(new Date(data.timestamp))
              : formatTime(new Date());

            const entry: ActivityEntry = {
              id: `${data.test_id}-${data.step_number}-${Date.now()}`,
              time,
              testId: data.test_id,
              step_number: data.step_number,
              action: data.action,
              type: (data.type as ActivityEntry['type']) || getActivityType(data.action),
              description,
              target: data.target,
              value: data.value,
              reasoning: data.reasoning ?? undefined,
              success: data.success,
              coordinates: data.coordinates,
              confidence: data.confidence,
              error: data.error,
              timestamp: data.timestamp ?? undefined,
            };

            set((state) => ({
              activityLog: [...state.activityLog, entry],
              thinking: '',
            }));
          },

          onNeedHelp: (data: NeedHelpEvent) => {
            // Add a guidance-request entry to the activity log
            const entry: ActivityEntry = {
              id: `${data.test_id}-help-${Date.now()}`,
              time: formatTime(new Date()),
              testId: data.test_id,
              action: 'stuck',
              description: data.question,
              type: 'guidance',
              success: false,
              confidence: data.confidence,
            };
            set((state) => ({
              activityLog: [...state.activityLog, entry],
              guidanceNeeded: {
                testId: data.test_id,
                question: data.question,
                currentState: data.current_state,
                confidence: data.confidence,
              },
            }));
          },

          onPaused: (data: PausedEvent) => {
            // Backend confirmed pause — clear pending and set paused
            set({ isPaused: true, isPausePending: false, guidanceNeeded: null });
            const entry: ActivityEntry = {
              id: `${data.test_id}-paused-${Date.now()}`,
              time: formatTime(new Date()),
              testId: data.test_id,
              action: 'paused',
              description: 'Execution paused — waiting for your guidance',
              type: 'guidance',
              success: true,
            };
            set((state) => ({ activityLog: [...state.activityLog, entry] }));
          },

          onTestComplete: (data: TestCompleteEvent) => {
            set((state) => ({
              tests: state.tests.map((t) =>
                t.id === data.test_id
                  ? {
                      ...t,
                      status: data.status,
                      conclusion: data.conclusion,
                      steps_executed: data.steps_executed,
                    }
                  : t
              ),
              guidanceNeeded: null,
              isPaused: false,
            }));
          },

          onSuiteComplete: (data: SuiteCompleteEvent) => {
            set({
              status: 'complete',
              suiteResult: {
                passed: data.passed,
                failed: data.failed,
                skipped: data.skipped,
                total: data.total,
              },
              currentTestId: null,
              thinking: '',
              guidanceNeeded: null,
              isPaused: false,
            });
          },

          onTestSkip: (data) => {
            set((state) => ({
              tests: state.tests.map((t) =>
                t.id === data.test_id ? { ...t, status: 'skipped' } : t
              ),
            }));
          },

          onContextLearning: () => {
            set({ projectLearningStatus: 'learning', projectLearningMessage: 'Updating project knowledge...' });
          },

          onContextLearned: (data: ContextLearnedEvent) => {
            set({
              projectLearningStatus: 'updated',
              projectLearningMessage: data.change_summary || 'Project knowledge updated.',
            });
          },

          onContextLearningWarning: (data: ContextLearningWarningEvent) => {
            set({ projectLearningStatus: 'warning', projectLearningMessage: data.message });
          },

          onAborted: () => {
            set({ status: 'aborted', isAbortPending: false, currentTestId: null, thinking: '', guidanceNeeded: null, isPaused: false });
          },

          onError: (message) => {
            set({ status: 'error', error: message, thinking: '', guidanceNeeded: null, isPaused: false });
          },
        },
        _abortController?.signal
      );
    } catch (err) {
      // AbortError is swallowed in executeTestsStream — any re-throw here is a real error
      set({
        status: 'error',
        error: err instanceof Error ? err.message : 'Execution failed',
        thinking: '',
        guidanceNeeded: null,
        isPaused: false,
      });
    } finally {
      // An older stream must never clear the controller/ID of a newer run.
      if (_executionId === executionId) {
        _abortController = null;
        _executionId = null;
      }
    }
  },

  submitGuidance: async (guidance: string) => {
    const { featureId, guidanceNeeded } = get();
    if (!featureId || !guidanceNeeded) return;
    try {
      await provideGuidance(featureId, guidanceNeeded.testId, guidance);
      set({ guidanceNeeded: null });
    } catch (err) {
      console.error('Failed to submit guidance:', err);
    }
  },

  pauseExecution: async () => {
    const { featureId } = get();
    if (!featureId) return;
    // Immediately acknowledge — UI updates right away, backend confirms later via onPaused
    set({ isPausePending: true });
    try {
      await apiPauseExecution(featureId);
    } catch (err) {
      set({ isPausePending: false });
      console.error('Failed to pause execution:', err);
    }
  },

  resumeExecution: async (guidance?: string) => {
    const { featureId } = get();
    if (!featureId) return;
    try {
      await apiResumeExecution(featureId, guidance);
      set({ isPaused: false, guidanceNeeded: null });
    } catch (err) {
      console.error('Failed to resume execution:', err);
    }
  },

  abortExecution: async () => {
    const { featureId } = get();
    const executionId = _executionId;
    // Immediately acknowledge — UI updates right away
    set({ isAbortPending: true });
    // Cancel the SSE fetch immediately so the frontend stops reading
    _abortController?.abort();
    _abortController = null;
    // Tell the backend to stop the loop
    if (featureId && executionId) {
      try {
        await apiAbortExecution(featureId, executionId);
      } catch (err) {
        console.error('Failed to send abort signal to backend:', err);
      }
    } else {
      console.warn('No active execution ID; abort request was not sent');
    }
    // Immediately mark the in-progress test as skipped so its loader stops
    set((state) => ({
      tests: state.tests.map((t) =>
        t.status === 'running' ? { ...t, status: 'skipped' as const } : t
      ),
    }));
    // Fallback: if no onAborted SSE event arrives (e.g. stream already closed), settle state
    set((state) =>
      state.isAbortPending
        ? { status: 'aborted', isAbortPending: false, currentTestId: null, thinking: '', guidanceNeeded: null, isPaused: false }
        : {}
    );
  },

  loadPastRun: (testCases: CloudTestCase[], runDetail: CloudTestRunDetail) => {
    const tcMap = new Map(testCases.map((tc) => [tc.id!, tc]));

    const tests: TestRun[] = runDetail.results.map((result, i) => {
      const tc = tcMap.get(result.test_case_id);
      return {
        id: result.test_case_id,
        test_key: tc?.test_key ?? `TC-${String(i + 1).padStart(3, '0')}`,
        title: tc?.title ?? 'Unknown Test',
        goal: tc?.goal ?? '',
        expected_result: tc?.expected_result,
        status: result.status as TestRunStatus,
        conclusion: result.conclusion ?? undefined,
        steps_executed: result.steps_executed,
        test_number: i + 1,
      };
    });

    const activityLog: ActivityEntry[] = runDetail.results.flatMap((result) =>
      (result.steps as StepRecord[]).map((step, j) => ({
        id: `${result.test_case_id}-${step.step_number}-${j}`,
        time: step.timestamp
          ? formatTime(new Date(step.timestamp))
          : `step ${step.step_number}`,
        testId: result.test_case_id,
        step_number: step.step_number,
        action: step.action,
        type: (step.type as ActivityEntry['type']) || getActivityType(step.action),
        description:
          step.description?.trim() ||
          step.reasoning?.trim() ||
          `${step.action}${step.target ? ` → ${step.target}` : ''}`,
        target: step.target ?? undefined,
        value: step.value ?? undefined,
        reasoning: step.reasoning ?? undefined,
        success: step.success,
        coordinates: step.coordinates ?? undefined,
        confidence: step.confidence,
        error: step.error ?? undefined,
        timestamp: step.timestamp ?? undefined,
      }))
    );

    set({
      status: 'complete',
      tests,
      activityLog,
      currentTestId: tests.length > 0 ? tests[0].id : null,
      suiteResult: {
        passed: runDetail.passed,
        failed: runDetail.failed,
        skipped: runDetail.skipped,
        total: runDetail.total_tests,
      },
      thinking: '',
      error: null,
      guidanceNeeded: null,
      isPaused: false,
      isPausePending: false,
      isAbortPending: false,
      projectLearningStatus: 'idle',
      projectLearningMessage: null,
    });
  },

  reset: () =>
    set({
      status: 'idle',
      featureId: null,
      featureName: null,
      windowTitle: null,
      tests: [],
      currentTestId: null,
      activityLog: [],
      thinking: '',
      suiteResult: null,
      error: null,
      guidanceNeeded: null,
      isPaused: false,
      isPausePending: false,
      isAbortPending: false,
      projectLearningStatus: 'idle',
      projectLearningMessage: null,
    }),
}));
