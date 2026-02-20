import { create } from 'zustand';
import { StepResult, executeAutoStream, SSECompleteEvent } from '../api/client';

export type ExecutionStatus = 'idle' | 'running' | 'success' | 'failed';

interface ExecutionState {
  status: ExecutionStatus;
  steps: StepResult[];
  statusMessage: string;
  error: string | null;
  finalState: string;
  goal: string;
  
  // Actions
  execute: (instruction: string, windowTitle: string, maxSteps?: number) => Promise<void>;
  reset: () => void;
}

export const useExecutionStore = create<ExecutionState>((set, get) => ({
  status: 'idle',
  steps: [],
  statusMessage: '',
  error: null,
  finalState: '',
  goal: '',

  execute: async (instruction, windowTitle, maxSteps = 15) => {
    set({
      status: 'running',
      steps: [],
      statusMessage: 'Initializing...',
      error: null,
      finalState: '',
      goal: instruction,
    });

    try {
      await executeAutoStream(
        { instruction, window_title: windowTitle, max_steps: maxSteps },
        {
          onStart: (data) => {
            set({ statusMessage: `Executing on ${data.window}...` });
          },
          onStatus: (message) => {
            set({ statusMessage: message });
          },
          onStep: (step) => {
            set((state) => ({
              steps: [...state.steps, step],
              statusMessage: `Step ${step.step_number}: ${step.action}${step.target ? ` → ${step.target}` : ''}`,
            }));
          },
          onComplete: (data: SSECompleteEvent) => {
            set({
              status: data.success ? 'success' : 'failed',
              finalState: data.final_state,
              statusMessage: '',
            });
          },
          onError: (message) => {
            set({
              status: 'failed',
              error: message,
              statusMessage: '',
            });
          },
        }
      );
    } catch (err) {
      set({
        status: 'failed',
        error: err instanceof Error ? err.message : 'Execution failed',
        statusMessage: '',
      });
    }
  },

  reset: () => {
    set({
      status: 'idle',
      steps: [],
      statusMessage: '',
      error: null,
      finalState: '',
      goal: '',
    });
  },
}));
