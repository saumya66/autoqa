interface IconProps {
  className?: string;
  strokeWidth?: number;
}

const base = (p: IconProps) => ({
  className: p.className,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: p.strokeWidth ?? 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  viewBox: '0 0 24 24',
});

export const EyeIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const SparkIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.5 2.5M15.2 15.2l2.5 2.5M17.7 6.3l-2.5 2.5M8.8 15.2l-2.5 2.5" />
    <circle cx="12" cy="12" r="2.5" />
  </svg>
);

export const QuestionIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" />
    <path d="M9.5 9.5a2.5 2.5 0 0 1 4.7 1.2c0 1.7-2.5 2.1-2.5 3.3" />
    <path d="M12 16.5h.01" />
  </svg>
);

export const EarIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M18 11.5a6 6 0 1 0-12 0c0 4 2.5 5.6 4.5 7.4.7.6 1 1.2 1 2.1v.5" />
    <path d="M11 16.5c0-1.8 3-2.3 3-5a2 2 0 0 0-4 0" />
  </svg>
);

export const MemoryIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 4.5A2.5 2.5 0 0 1 8.5 2H18v18l-4-2-4 2V4.5A2.5 2.5 0 0 0 7.5 2H6Z" />
    <path d="M13 7h2.5M13 10h2.5" />
  </svg>
);

export const GavelIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m9 11 6-6M6.5 8.5 2 13M13 15l-4.5 4.5M15.5 5.5l3 3M8.5 12.5l3 3M4 20h8" />
  </svg>
);

export const CheckIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export const PlayIcon = (p: IconProps) => (
  <svg className={p.className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.29-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14Z" />
  </svg>
);

export const ArrowUpRight = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M7 17 17 7M8 7h9v9" />
  </svg>
);

export const ArrowRight = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export const CloseIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

export const GlobeIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.7 3.8 5.8 3.8 9S14.5 18.3 12 21c-2.5-2.7-3.8-5.8-3.8-9S9.5 5.7 12 3Z" />
  </svg>
);

export const MonitorIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <path d="M8 21h8M12 17v4" />
  </svg>
);

export const PhoneIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="6" y="2" width="12" height="20" rx="2.5" />
    <path d="M11 18h2" />
  </svg>
);

export const LogoMark = ({ className }: { className?: string }) => (
  <img
    src="/favicon.png"
    alt="Clariti"
    className={`object-contain ${className ?? ''}`}
    draggable={false}
  />
);
