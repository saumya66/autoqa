import { create } from 'zustand';
import {
  StepResult,
  executeCUStream,
  CUCompleteEvent,
  CUActionStep,
  CUProvider,
} from '../api/client';

export type ExecutionStatus = 'idle' | 'running' | 'success' | 'failed';

function cuStepToStepResult(step: CUActionStep, thinking: string): StepResult {
  const friendlyName: Record<string, string> = {
    // Gemini actions
    click_at: 'click',
    type_text_at: 'type',
    scroll_document: 'scroll',
    scroll_at: 'scroll',
    hover_at: 'hover',
    navigate: 'navigate',
    key_combination: 'key press',
    wait_5_seconds: 'wait',
    go_back: 'go back',
    go_forward: 'go forward',
    drag_and_drop: 'drag',
    open_web_browser: 'open browser',
    search: 'search',
    // Claude actions
    left_click: 'click',
    right_click: 'right click',
    double_click: 'double click',
    triple_click: 'triple click',
    middle_click: 'middle click',
    type: 'type',
    key: 'key press',
    mouse_move: 'move',
    scroll: 'scroll',
    left_click_drag: 'drag',
    screenshot: 'screenshot',
    wait: 'wait',
    hold_key: 'hold key',
  };

  const args = step.args as Record<string, unknown>;
  let target: string | undefined;
  const text = args.text as string | undefined;
  const url = args.url as string | undefined;
  const direction = args.direction as string | undefined;
  const keys = args.keys as string | undefined;
  const coordinate = args.coordinate as [number, number] | undefined;
  if (text) target = `"${text}"`;
  else if (url) target = url;
  else if (keys) target = keys;
  else if (direction) target = direction;

  let value: string | undefined;
  if (coordinate) {
    value = `(${coordinate[0]}, ${coordinate[1]})`;
  } else if (args.x !== undefined && args.y !== undefined) {
    value = `(${args.x}, ${args.y})`;
  }

  return {
    step_number: step.step_number,
    action: friendlyName[step.action] || step.action,
    target,
    value,
    reasoning: step.reasoning || thinking,
    current_state: '',
    success: step.success,
    coordinates: step.result?.coordinates,
    error: step.error,
  };
}

interface ExecutionState {
  status: ExecutionStatus;
  steps: StepResult[];
  statusMessage: string;
  thinking: string;
  error: string | null;
  finalState: string;
  goal: string;
  model: string;
  provider: CUProvider;

  setProvider: (provider: CUProvider) => void;
  execute: (instruction: string, windowTitle: string, maxSteps?: number) => Promise<void>;
  reset: () => void;
}

export const useExecutionStore = create<ExecutionState>((set, get) => ({
  status: 'idle',
  steps: [],
  statusMessage: '',
  thinking: '',
  error: null,
  finalState: '',
  goal: '',
  model: '',
  provider: 'claude',

  setProvider: (provider) => set({ provider }),

  execute: async (instruction, windowTitle, maxSteps = 25) => {
    let latestThinking = '';
    const provider = get().provider;

    set({
      status: 'running',
      steps: [],
      statusMessage: 'Initializing...',
      thinking: '',
      error: null,
      finalState: '',
      goal: instruction,
      model: '',
    });

    try {
      await executeCUStream(
        { instruction, window_title: windowTitle, max_steps: maxSteps },
        {
          onStart: (data) => {
            set({
              statusMessage: `Executing on ${data.window}...`,
              model: data.model,
            });
          },
          onStatus: (message) => {
            set({ statusMessage: message });
          },
          onThinking: (text) => {
            latestThinking = text;
            set({ thinking: text });
          },
          onAction: (step) => {
            const mapped = cuStepToStepResult(step, latestThinking);
            latestThinking = '';
            set((state) => ({
              steps: [...state.steps, mapped],
              statusMessage: `Step ${step.step_number}: ${mapped.action}${mapped.target ? ` → ${mapped.target}` : ''}`,
              thinking: '',
            }));
          },
          onSafety: (data) => {
            set({ statusMessage: `Safety check: ${data.explanation}` });
          },
          onComplete: (data: CUCompleteEvent) => {
            set({
              status: data.success ? 'success' : 'failed',
              finalState: data.final_message,
              statusMessage: '',
              thinking: '',
            });
          },
          onError: (message) => {
            set({
              status: 'failed',
              error: message,
              statusMessage: '',
              thinking: '',
            });
          },
        },
        provider,
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
      thinking: '',
      error: null,
      finalState: '',
      goal: '',
      model: '',
    });
  },
}));
