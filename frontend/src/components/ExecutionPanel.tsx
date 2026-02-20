import React, { useEffect, useRef } from 'react';
import { CheckCircle2, XCircle, AlertCircle, RotateCcw, Zap, MousePointer2, Type, ArrowDown, Clock, Loader2 } from 'lucide-react';
import { StepResult, WindowInfo } from '../api/client';
import { ExecutionStatus } from '../store/executionStore';

interface ExecutionPanelProps {
  status: ExecutionStatus;
  steps: StepResult[];
  error: string | null;
  finalState: string;
  onReset: () => void;
  selectedWindow: WindowInfo | null;
  statusMessage?: string;
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  click: <MousePointer2 className="w-4 h-4" />,
  type: <Type className="w-4 h-4" />,
  scroll: <ArrowDown className="w-4 h-4" />,
  wait: <Clock className="w-4 h-4" />,
  done: <CheckCircle2 className="w-4 h-4" />,
  stuck: <AlertCircle className="w-4 h-4" />,
};

export function ExecutionPanel({ status, steps, error, finalState, onReset, selectedWindow, statusMessage = '' }: ExecutionPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom when new steps arrive
  useEffect(() => {
    if (scrollRef.current && steps.length > 0) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [steps]);

  // Idle state
  if (status === 'idle') {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-void-800 flex items-center justify-center">
            <Zap className="w-10 h-10 text-void-500" />
          </div>
          <div>
            <h3 className="text-lg font-medium text-void-200">Ready to automate</h3>
            <p className="text-sm text-void-400 mt-1">
              {selectedWindow 
                ? 'Enter an instruction and hit Execute'
                : 'Select a target window to get started'
              }
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Running state - now shows live steps!
  if (status === 'running') {
    return (
      <div className="h-full flex flex-col">
        {/* Running Header */}
        <div className="p-4 border-b border-void-700 bg-plasma-500/5">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-plasma-500/20 flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-plasma-400 animate-spin" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-void-50">Executing...</h3>
              <p className="text-sm text-void-300 truncate">
                {statusMessage || 'Working on your request'}
              </p>
            </div>
            <div className="text-xs text-void-400 font-mono">
              Step {steps.length}
            </div>
          </div>
        </div>

        {/* Live Steps List */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2">
          {steps.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-void-400">Waiting for first step...</p>
            </div>
          ) : (
            steps.map((step, index) => (
              <StepCard key={index} step={step} isLive={index === steps.length - 1} />
            ))
          )}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-red-500/20 flex items-center justify-center">
            <XCircle className="w-8 h-8 text-neon-red" />
          </div>
          <div>
            <h3 className="text-lg font-medium text-neon-red">Execution Failed</h3>
            <p className="text-sm text-void-300 mt-2">{error}</p>
          </div>
          <button
            onClick={onReset}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-void-700 text-void-100 hover:bg-void-600 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Result state (success or failed with steps)
  if ((status === 'success' || status === 'failed') && steps.length > 0) {
    const isSuccess = status === 'success';
    
    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className={`
          p-4 border-b border-void-700 flex items-center justify-between
          ${isSuccess ? 'bg-green-500/5' : 'bg-yellow-500/5'}
        `}>
          <div className="flex items-center gap-3">
            <div className={`
              w-10 h-10 rounded-xl flex items-center justify-center
              ${isSuccess ? 'bg-green-500/20' : 'bg-yellow-500/20'}
            `}>
              {isSuccess 
                ? <CheckCircle2 className="w-5 h-5 text-neon-green" />
                : <AlertCircle className="w-5 h-5 text-neon-yellow" />
              }
            </div>
            <div>
              <h3 className={`font-medium ${isSuccess ? 'text-neon-green' : 'text-neon-yellow'}`}>
                {isSuccess ? 'Goal Completed!' : 'Execution Stopped'}
              </h3>
              <p className="text-sm text-void-300">
                {steps.length} steps
              </p>
            </div>
          </div>
          <button
            onClick={onReset}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-void-700 text-void-200 hover:bg-void-600 text-sm transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            New Task
          </button>
        </div>

        {/* Steps List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {steps.map((step, index) => (
            <StepCard key={index} step={step} />
          ))}
        </div>

        {/* Final State */}
        {finalState && (
          <div className="p-4 border-t border-void-700 bg-void-800/50">
            <p className="text-xs text-void-400 mb-1">Final State</p>
            <p className="text-sm text-void-100">{finalState}</p>
          </div>
        )}
      </div>
    );
  }

  return null;
}

function StepCard({ step, isLive = false }: { step: StepResult; isLive?: boolean }) {
  const isSuccess = step.success;
  const icon = ACTION_ICONS[step.action] || <Zap className="w-4 h-4" />;
  
  return (
    <div className={`
      p-3 rounded-lg border transition-all
      ${isLive 
        ? 'bg-plasma-500/10 border-plasma-500/30 ring-1 ring-plasma-500/20' 
        : isSuccess 
          ? 'bg-void-800/50 border-void-700 hover:border-void-600' 
          : 'bg-red-500/5 border-red-500/20'
      }
    `}>
      <div className="flex items-start gap-3">
        {/* Step Number */}
        <div className={`
          w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono
          ${isLive 
            ? 'bg-plasma-500/20 text-plasma-300' 
            : isSuccess 
              ? 'bg-void-700 text-void-200' 
              : 'bg-red-500/20 text-neon-red'
          }
        `}>
          {step.step_number}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`${isLive ? 'text-plasma-300' : isSuccess ? 'text-plasma-400' : 'text-neon-red'}`}>
              {icon}
            </span>
            <span className="text-sm font-medium text-void-100 capitalize">
              {step.action}
            </span>
            {step.target && (
              <span className="text-sm text-void-300 truncate">
                → {step.target}
              </span>
            )}
          </div>
          
          {step.reasoning && (
            <p className="text-xs text-void-400 mt-1 line-clamp-2">
              {step.reasoning}
            </p>
          )}
          
          {step.error && (
            <p className="text-xs text-neon-red mt-1">
              ⚠ {step.error}
            </p>
          )}
        </div>

        {/* Status */}
        <div className="flex-shrink-0">
          {isLive ? (
            <Loader2 className="w-4 h-4 text-plasma-400 animate-spin" />
          ) : isSuccess ? (
            <CheckCircle2 className="w-4 h-4 text-neon-green" />
          ) : (
            <XCircle className="w-4 h-4 text-neon-red" />
          )}
        </div>
      </div>
    </div>
  );
}
