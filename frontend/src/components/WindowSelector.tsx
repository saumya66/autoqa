import React from 'react';
import { Monitor, Smartphone, AppWindow } from 'lucide-react';
import { WindowInfo } from '../api/client';

interface WindowSelectorProps {
  windows: WindowInfo[];
  selectedWindow: WindowInfo | null;
  onSelect: (window: WindowInfo) => void;
  loading: boolean;
}

export function WindowSelector({ windows, selectedWindow, onSelect, loading }: WindowSelectorProps) {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-void-300">
          <div className="w-8 h-8 border-2 border-void-600 border-t-plasma-400 rounded-full animate-spin" />
          <span className="text-sm">Loading windows...</span>
        </div>
      </div>
    );
  }

  if (windows.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center text-void-300">
          <Monitor className="w-12 h-12 mx-auto mb-3 opacity-60" />
          <p className="text-sm">No windows found</p>
          <p className="text-xs mt-1 text-void-400">Make sure the backend is running</p>
        </div>
      </div>
    );
  }

  const getWindowIcon = (appName: string) => {
    const lower = appName.toLowerCase();
    if (lower.includes('vysor') || lower.includes('android') || lower.includes('ios')) {
      return <Smartphone className="w-4 h-4" />;
    }
    return <AppWindow className="w-4 h-4" />;
  };

  return (
    <div className="flex-1 overflow-y-auto p-2 space-y-1">
      {windows.map((window) => {
        const isSelected = selectedWindow?.id === window.id;
        return (
          <button
            key={window.id}
            onClick={() => onSelect(window)}
            className={`
              no-drag w-full text-left p-3 rounded-lg transition-all
              ${isSelected 
                ? 'bg-plasma-600/20 border border-plasma-500/50 shadow-lg shadow-plasma-500/10' 
                : 'hover:bg-void-700/50 border border-transparent'
              }
            `}
          >
            <div className="flex items-start gap-3">
              <div className={`
                p-2 rounded-lg 
                ${isSelected ? 'bg-plasma-500/20 text-plasma-400' : 'bg-void-700 text-void-300'}
              `}>
                {getWindowIcon(window.app_name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${isSelected ? 'text-white' : 'text-void-100'}`}>
                  {window.title || 'Untitled'}
                </p>
                <p className="text-xs text-void-300 mt-0.5">
                  {window.app_name}
                </p>
                <p className="text-xs text-void-400 mt-1">
                  {window.bounds.width} × {window.bounds.height}
                </p>
              </div>
              {isSelected && (
                <div className="w-2 h-2 rounded-full bg-plasma-400 animate-pulse" />
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
