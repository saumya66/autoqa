import React, { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { WindowSelector } from '../components/WindowSelector';
import { InstructionInput } from '../components/InstructionInput';
import { ExecutionPanel } from '../components/ExecutionPanel';
import { useWindows } from '../hooks';
import { useExecutionStore } from '../store/executionStore';
import { WindowInfo } from '../api/client';

function ExecutePage() {
  const [selectedWindow, setSelectedWindow] = useState<WindowInfo | null>(null);
  const [maxSteps, setMaxSteps] = useState(15);
  
  const { windows, loading: loadingWindows, refetch: refetchWindows } = useWindows();
  
  const { status, steps, statusMessage, error, finalState, execute, reset } = useExecutionStore();
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
          />
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute('/execute')({
  component: ExecutePage,
});
