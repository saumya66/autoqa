import type { ReactNode } from 'react';

interface AppWindowProps {
  breadcrumb?: string;
  live?: boolean;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

/** A faux macOS app window: traffic lights + mono breadcrumb + optional LIVE dot. */
export default function AppWindow({
  breadcrumb,
  live = false,
  children,
  className = '',
  bodyClassName = '',
}: AppWindowProps) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-white/10 bg-[#0e0e16] shadow-2xl shadow-black/60 ${className}`}
    >
      {/* Title bar */}
      <div className="flex shrink-0 items-center gap-3 border-b border-white/10 bg-white/[0.03] px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
          <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
          <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        </div>
        {breadcrumb && (
          <span className="truncate font-mono text-xs text-white/40">{breadcrumb}</span>
        )}
        {live && (
          <span className="ml-auto inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold text-violet-300">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse-soft" />
            LIVE
          </span>
        )}
      </div>
      {/* Body */}
      <div className={`flex min-h-0 flex-1 flex-col ${bodyClassName}`}>{children}</div>
    </div>
  );
}
