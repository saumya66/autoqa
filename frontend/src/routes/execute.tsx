import React, { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { WindowSelector } from '../components/WindowSelector';
import { InstructionInput } from '../components/InstructionInput';
import { ExecutionPanel } from '../components/ExecutionPanel';
import { useWindows } from '../hooks';
import { useExecutionStore } from '../store/executionStore';
import { WindowInfo, CUProvider } from '../api/client';

function ExecutePage() {
  const [selectedWindow, setSelectedWindow] = useState<WindowInfo | null>(null);
  const [maxSteps, setMaxSteps] = useState(25);
  
  const { windows, loading: loadingWindows, refetch: refetchWindows } = useWindows();
  
  const { status, steps, statusMessage, thinking, model, error, finalState, provider, setProvider, execute, reset } = useExecutionStore();
  const isRunning = status === 'running';

  const handleExecute = async (instruction: string) => {
    if (!selectedWindow) return;
    await execute(instruction, selectedWindow.title, maxSteps);
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left Panel - Window Selection */}
      <aside className="w-80 border-r border-void-700 flex flex-col bg-void-800/50">
        <div className="p-4 border-b border-void-700">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-void-50">Target Window</h2>
            <button
              onClick={refetchWindows}
              disabled={loadingWindows}
              className="no-drag text-xs text-plasma-400 hover:text-plasma-300 disabled:opacity-50"
            >
              {loadingWindows ? 'Loading...' : 'Refresh'}
            </button>
          </div>
          <p className="text-xs text-void-300">Select a window to automate</p>
        </div>
        
        <WindowSelector
          windows={windows}
          selectedWindow={selectedWindow}
          onSelect={setSelectedWindow}
          loading={loadingWindows}
        />

        {/* Provider Toggle */}
        <div className="mt-auto p-4 border-t border-void-700">
          <p className="text-[10px] uppercase tracking-wider text-void-500 mb-2">AI Provider</p>
          <div className="flex gap-1 bg-void-900 rounded-lg p-1">
            {(['claude', 'gemini'] as CUProvider[]).map((p) => (
              <button
                key={p}
                onClick={() => setProvider(p)}
                disabled={isRunning}
                className={`
                  flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all
                  ${provider === p
                    ? 'bg-plasma-500/20 text-plasma-300 shadow-sm'
                    : 'text-void-400 hover:text-void-200'
                  }
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
              >
                {p === 'gemini' ? 'Gemini' : 'Claude'}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-void-500 mt-1.5">
            {provider === 'gemini' ? 'Browser-optimized • Normalized coords' : 'Any app • Pixel-accurate coords'}
          </p>
        </div>
      </aside>

      {/* Center Panel - Instruction & Execution */}
      <div className="flex-1 flex flex-col bg-void-900">
        {/* Instruction Input */}
        <div className="p-6 border-b border-void-700">
          <InstructionInput
            onExecute={handleExecute}
            disabled={!selectedWindow || isRunning}
            isRunning={isRunning}
            selectedWindowTitle={selectedWindow?.title}
            maxSteps={maxSteps}
            onMaxStepsChange={setMaxSteps}
          />
        </div>

        {/* Execution Panel */}
        <div className="flex-1 overflow-hidden">
          <ExecutionPanel
            status={status}
            steps={steps}
            error={error}
            finalState={finalState}
            onReset={reset}
            selectedWindow={selectedWindow}
            statusMessage={statusMessage}
            thinking={thinking}
            model={model}
          />
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute('/execute')({
  component: ExecutePage,
});
