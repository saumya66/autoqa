import React, { useState, KeyboardEvent } from 'react';
import { Play, Loader2, Sparkles } from 'lucide-react';

interface InstructionInputProps {
  onExecute: (instruction: string) => void;
  disabled: boolean;
  isRunning: boolean;
  selectedWindowTitle?: string;
  maxSteps: number;
  onMaxStepsChange: (steps: number) => void;
}

const EXAMPLE_PROMPTS = [
  "Click the search bar and type 'hello world'",
  "Navigate to settings and find the logout button",
  "Scroll down to find a product and add it to cart",
  "Go to profile page and update the username",
];

export function InstructionInput({ 
  onExecute, 
  disabled, 
  isRunning,
  selectedWindowTitle,
  maxSteps,
  onMaxStepsChange
}: InstructionInputProps) {
  const [instruction, setInstruction] = useState('');

  const handleSubmit = () => {
    if (instruction.trim() && !disabled) {
      onExecute(instruction.trim());
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-void-50 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-plasma-400" />
            What do you want to automate?
          </h2>
          {selectedWindowTitle && (
            <p className="text-sm text-void-300 mt-1">
              Target: <span className="text-plasma-400 font-medium">{selectedWindowTitle}</span>
            </p>
          )}
        </div>
        
        {/* Max Steps - Always Visible */}
        <div className="flex items-center gap-3 bg-void-800 border border-void-700 rounded-lg px-3 py-2">
          <label className="text-xs text-void-300">Max Steps</label>
          <input
            type="range"
            min={5}
            max={50}
            value={maxSteps}
            onChange={(e) => onMaxStepsChange(Number(e.target.value))}
            className="w-24 accent-plasma-500"
          />
          <span className="text-sm text-plasma-400 font-mono w-6 text-center">{maxSteps}</span>
        </div>
      </div>

      {/* Input Area */}
      <div className="relative">
        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={disabled && !selectedWindowTitle 
            ? "Select a target window first..." 
            : "Describe what you want the agent to do..."}
          className={`
            w-full h-32 p-4 pr-20 rounded-xl resize-none
            bg-void-800 border border-void-600
            text-void-50 placeholder-void-500
            focus:outline-none focus:border-plasma-500 focus:ring-1 focus:ring-plasma-500/50
            disabled:opacity-50 disabled:cursor-not-allowed
            font-mono text-sm
          `}
        />
        
        {/* Execute Button */}
        <button
          onClick={handleSubmit}
          disabled={disabled || !instruction.trim() || isRunning}
          className={`
            absolute bottom-4 right-4
            flex items-center gap-2 px-4 py-2 rounded-lg
            font-medium text-sm transition-all
            ${isRunning 
              ? 'bg-void-700 text-void-300 cursor-wait'
              : disabled || !instruction.trim()
                ? 'bg-void-700 text-void-500 cursor-not-allowed'
                : 'bg-plasma-500 text-white hover:bg-plasma-600 glow-purple'
            }
          `}
        >
          {isRunning ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Execute
            </>
          )}
        </button>
      </div>

      {/* Keyboard Shortcut Hint */}
      <p className="text-xs text-void-400 text-right">
        Press <kbd className="px-1.5 py-0.5 rounded bg-void-700 text-void-300 font-mono">⌘</kbd> + <kbd className="px-1.5 py-0.5 rounded bg-void-700 text-void-300 font-mono">Enter</kbd> to execute
      </p>

      {/* Example Prompts */}
      {!instruction && !isRunning && (
        <div className="space-y-2">
          <p className="text-xs text-void-400">Try an example:</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_PROMPTS.map((prompt, i) => (
              <button
                key={i}
                onClick={() => setInstruction(prompt)}
                disabled={disabled}
                className="text-xs px-3 py-1.5 rounded-full bg-void-700/50 text-void-200 hover:bg-void-600 hover:text-void-50 transition-colors disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
