import React from 'react';
import { Wifi, WifiOff } from 'lucide-react';

interface StatusBarProps {
  isConnected: boolean;
}

export function StatusBar({ isConnected }: StatusBarProps) {
  return (
    <div className="no-drag flex items-center gap-2">
      <div className={`
        flex items-center gap-1.5 px-2 py-1 rounded-full text-xs
        ${isConnected 
          ? 'bg-green-500/10 text-neon-green' 
          : 'bg-red-500/10 text-neon-red'
        }
      `}>
        {isConnected ? (
          <>
            <Wifi className="w-3 h-3" />
            <span>Connected</span>
          </>
        ) : (
          <>
            <WifiOff className="w-3 h-3" />
            <span>Disconnected</span>
          </>
        )}
      </div>
    </div>
  );
}
