import { motion } from 'motion/react';
import { CheckIcon, EyeIcon, SparkIcon } from './Icons';

const TESTS = [
  'Add product to cart',
  'Apply SAVE20 coupon',
  'Continue to payment',
];

const PHASES = [
  { start: 0, end: 0.3 },
  { start: 0.34, end: 0.64 },
  { start: 0.68, end: 0.97 },
];

const CONNECTIONS = [
  'M205 105 C180 150 150 200 145 250',
  'M280 300 C350 285 420 250 455 210',
  'M483 266 C500 305 512 330 520 354',
];

export default function HeroVisual() {
  return (
    <div className="relative mx-auto h-105 w-full max-w-155 sm:aspect-4/3 sm:h-auto" aria-hidden="true">
      <div className="absolute inset-[12%] rounded-full bg-violet-500/16 blur-[75px]" />
      <div className="absolute left-[27%] top-[31%] h-40 w-40 rounded-full bg-fuchsia-400/8 blur-[55px]" />

      <svg
        className="absolute inset-0 hidden h-full w-full overflow-visible sm:block"
        viewBox="0 0 620 465"
        fill="none"
      >
        <defs>
          <linearGradient id="story-line" x1="180" y1="90" x2="530" y2="390">
            <stop stopColor="#C084FC" stopOpacity="0.16" />
            <stop offset="0.5" stopColor="#A855F7" stopOpacity="0.55" />
            <stop offset="1" stopColor="#6366F1" stopOpacity="0.12" />
          </linearGradient>
          <filter id="story-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>

        {CONNECTIONS.map((path, index) => (
          <g key={path}>
            <path d={path} stroke="url(#story-line)" strokeWidth="1.5" />
            <motion.path
              d={path}
              pathLength={1}
              stroke="#C084FC"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="0.025 0.975"
              filter="url(#story-glow)"
              initial={{ strokeDashoffset: 1 }}
              animate={{ strokeDashoffset: 0 }}
              transition={{
                duration: 2.4,
                delay: index * 1.1,
                repeat: Infinity,
                repeatDelay: 0.9,
                ease: 'linear',
              }}
            />
          </g>
        ))}
      </svg>

      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.96 }}
        animate={{ opacity: 1, y: [0, -5, 0], scale: 1 }}
        transition={{
          opacity: { duration: 0.55, delay: 0.15 },
          scale: { duration: 0.55, delay: 0.15 },
          y: { duration: 5.5, repeat: Infinity, ease: 'easeInOut' },
        }}
        className="absolute left-0 top-0 z-10 w-[52%] rounded-2xl border border-violet-300/20 bg-[#11111b]/92 p-3.5 shadow-2xl shadow-black/25 backdrop-blur-xl sm:left-[1%] sm:top-[4%] sm:w-[43%] sm:p-4"
      >
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-500 text-[8px] font-bold text-white">
            Y
          </span>
          <span className="font-mono text-[8px] tracking-[0.16em] text-violet-200/65">
            YOU · DESCRIBE
          </span>
        </div>
        <p className="mt-2.5 text-[10px] leading-relaxed text-white/75 sm:text-xs">
          Test checkout. Apply SAVE20 and confirm the total before payment.
        </p>
        <div className="mt-3 flex items-center gap-2 border-t border-white/8 pt-2.5">
          <SparkIcon className="h-3 w-3 text-violet-300" />
          <span className="text-[8px] text-white/35 sm:text-[9px]">Clariti understands the goal</span>
          <span className="ml-auto flex gap-0.5">
            {[0, 1, 2].map((dot) => (
              <motion.span
                key={dot}
                className="h-1 w-1 rounded-full bg-violet-300"
                animate={{ opacity: [0.25, 1, 0.25] }}
                transition={{ duration: 1.2, delay: dot * 0.2, repeat: Infinity }}
              />
            ))}
          </span>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.95 }}
        animate={{ opacity: 1, y: [0, 4, 0], scale: 1 }}
        transition={{
          opacity: { duration: 0.6, delay: 0.65 },
          scale: { duration: 0.6, delay: 0.65 },
          y: { duration: 6.2, repeat: Infinity, ease: 'easeInOut' },
        }}
        className="absolute left-0 top-[48%] z-20 w-[53%] sm:left-[2%] sm:top-[53%] sm:w-[44%]"
      >
        <div className="absolute inset-x-3 -top-2 h-full rounded-2xl border border-white/6 bg-[#0e0e17]/70" />
        <div className="absolute inset-x-1.5 -top-1 h-full rounded-2xl border border-white/8 bg-[#101019]/85" />
        <div className="relative rounded-2xl border border-white/10 bg-[#12121d]/95 p-3.5 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[8px] tracking-[0.16em] text-white/40">
              GENERATED TESTS
            </span>
            <span className="flex items-center gap-1 rounded-full border border-violet-300/15 bg-violet-400/8 px-1.5 py-0.5 font-mono text-[7px] text-violet-200/70">
              <span className="h-1 w-1 animate-pulse-soft rounded-full bg-violet-300" />
              RUNNING
            </span>
          </div>
          <div className="mt-2.5 space-y-1.5">
            {TESTS.map((test, index) => {
              const { start, end } = PHASES[index];
              return (
                <motion.div
                  key={test}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{
                    opacity: 1,
                    x: 0,
                    borderColor: [
                      'rgba(255,255,255,0.07)',
                      'rgba(167,139,250,0.38)',
                      'rgba(167,139,250,0.38)',
                      'rgba(255,255,255,0.07)',
                      'rgba(255,255,255,0.07)',
                    ],
                    backgroundColor: [
                      'rgba(255,255,255,0.025)',
                      'rgba(139,92,246,0.10)',
                      'rgba(139,92,246,0.10)',
                      'rgba(255,255,255,0.025)',
                      'rgba(255,255,255,0.025)',
                    ],
                  }}
                  transition={{
                    opacity: { duration: 0.4, delay: 0.95 + index * 0.14 },
                    x: { duration: 0.4, delay: 0.95 + index * 0.14 },
                    borderColor: {
                      duration: 12,
                      times: [0, start, end, Math.min(end + 0.02, 0.99), 1],
                      repeat: Infinity,
                    },
                    backgroundColor: {
                      duration: 12,
                      times: [0, start, end, Math.min(end + 0.02, 0.99), 1],
                      repeat: Infinity,
                    },
                  }}
                  className="flex items-center gap-2 rounded-lg border bg-white/2.5 px-2 py-1.5"
                >
                  <span className="font-mono text-[7px] text-violet-300">0{index + 1}</span>
                  <span className="truncate text-[8px] text-white/55 sm:text-[9px]">{test}</span>
                  <span className="relative ml-auto h-2.5 w-2.5 shrink-0">
                    <motion.span
                      className="absolute inset-0 rounded-full border border-violet-300/30 border-t-violet-200"
                      animate={{
                        opacity: [0, 1, 1, 0, 0],
                        rotate: [0, 720],
                      }}
                      transition={{
                        opacity: {
                          duration: 12,
                          times: [0, start, end, Math.min(end + 0.02, 0.99), 1],
                          repeat: Infinity,
                        },
                        rotate: { duration: 1.2, repeat: Infinity, ease: 'linear' },
                      }}
                    />
                    <motion.span
                      className="absolute inset-0"
                      animate={{ opacity: [0, 0, 1, 1, 0] }}
                      transition={{
                        duration: 12,
                        times: [0, Math.max(end - 0.01, 0), end, 0.98, 1],
                        repeat: Infinity,
                      }}
                    >
                      {index === TESTS.length - 1 ? (
                        <span className="flex h-2.5 w-2.5 items-center justify-center rounded-full bg-rose-400/15 font-mono text-[7px] font-bold text-rose-300">
                          !
                        </span>
                      ) : (
                        <CheckIcon className="h-2.5 w-2.5 text-emerald-300/80" />
                      )}
                    </motion.span>
                  </span>
                </motion.div>
              );
            })}
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.92 }}
        animate={{ opacity: 1, y: [0, -4, 0], scale: 1 }}
        transition={{
          opacity: { duration: 0.6, delay: 1.2 },
          scale: { duration: 0.6, delay: 1.2 },
          y: { duration: 5.8, repeat: Infinity, ease: 'easeInOut' },
        }}
        className="absolute right-0 top-[2%] z-30 w-[27%] sm:right-[14%] sm:top-[4%] sm:w-[20%]"
      >
        <div className="mb-2 flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-emerald-300/15 bg-emerald-400/8 px-2 py-1 font-mono text-[6px] tracking-widest text-emerald-300 sm:text-[7px]">
          <span className="h-1 w-1 animate-pulse-soft rounded-full bg-emerald-300" />
          ANDROID · PIXEL EMULATOR
        </div>
        <div className="aspect-9/17 rounded-3xl border border-white/15 bg-[#171722] p-1.5 shadow-[0_0_35px_rgba(124,58,237,0.24)]">
          <div className="flex h-full flex-col overflow-hidden rounded-[1.15rem] border border-white/8 bg-[#0d0d15]">
            <div className="flex h-5 shrink-0 items-center justify-center border-b border-white/8">
              <span className="h-1 w-7 rounded-full bg-white/15" />
            </div>
            <div className="flex flex-1 flex-col p-2">
              <div className="flex items-center justify-between border-b border-white/7 pb-2">
                <div>
                  <div className="font-mono text-[5px] text-white/25">CHECKOUT</div>
                  <div className="mt-1 h-1 w-7 rounded bg-white/12" />
                </div>
                <div className="relative h-4 w-4 rounded-full bg-violet-400/20">
                  <motion.span
                    className="absolute -right-1 -top-1 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-violet-400 font-mono text-[5px] text-white"
                    animate={{ opacity: [0, 0, 1, 1, 0], scale: [0.5, 0.5, 1, 1, 0.5] }}
                    transition={{ duration: 12, times: [0, 0.15, 0.2, 0.97, 1], repeat: Infinity }}
                  >
                    1
                  </motion.span>
                </div>
              </div>

              <div className="mt-2 rounded-md border border-white/8 bg-white/3 p-1.5">
                <div className="h-1.5 w-3/5 rounded bg-white/14" />
                <div className="mt-1.5 flex items-center justify-between">
                  <div className="h-1 w-2/5 rounded bg-white/7" />
                  <motion.span
                    className="rounded bg-violet-500/65 px-1 py-0.5 font-mono text-[5px] text-white"
                    animate={{
                      scale: [1, 0.86, 1, 1],
                      backgroundColor: [
                        'rgba(139,92,246,0.65)',
                        'rgba(196,181,253,0.9)',
                        'rgba(16,185,129,0.72)',
                        'rgba(16,185,129,0.72)',
                      ],
                    }}
                    transition={{
                      duration: 12,
                      times: [0, 0.11, 0.18, 1],
                      repeat: Infinity,
                    }}
                  >
                    ADD
                  </motion.span>
                </div>
              </div>

              <motion.div
                className="mt-2 flex h-5 items-center overflow-hidden rounded-md border bg-white/3 px-1.5"
                animate={{
                  borderColor: [
                    'rgba(255,255,255,0.08)',
                    'rgba(255,255,255,0.08)',
                    'rgba(167,139,250,0.5)',
                    'rgba(167,139,250,0.5)',
                    'rgba(255,255,255,0.08)',
                  ],
                }}
                transition={{ duration: 12, times: [0, 0.25, 0.3, 0.47, 1], repeat: Infinity }}
              >
                <motion.span
                  className="overflow-hidden whitespace-nowrap font-mono text-[6px] text-violet-200"
                  animate={{ width: ['0%', '0%', '100%', '100%', '0%'], opacity: [0, 0, 1, 1, 0] }}
                  transition={{ duration: 12, times: [0, 0.28, 0.42, 0.97, 1], repeat: Infinity }}
                >
                  SAVE20
                </motion.span>
              </motion.div>

              <div className="mt-auto flex items-center justify-between border-t border-white/7 pt-2">
                <span className="font-mono text-[5px] text-white/30">TOTAL</span>
                <span className="relative h-2 w-7 text-right font-mono text-[7px]">
                  <motion.span
                    className="absolute inset-0 text-white/45"
                    animate={{ opacity: [1, 1, 0, 0, 1] }}
                    transition={{ duration: 12, times: [0, 0.54, 0.6, 0.97, 1], repeat: Infinity }}
                  >
                    $100
                  </motion.span>
                  <motion.span
                    className="absolute inset-0 text-emerald-300"
                    animate={{ opacity: [0, 0, 1, 1, 0] }}
                    transition={{ duration: 12, times: [0, 0.56, 0.61, 0.97, 1], repeat: Infinity }}
                  >
                    $80
                  </motion.span>
                </span>
              </div>
              <motion.div
                className="relative mt-2 flex h-6 items-center justify-center rounded-md border bg-violet-500/55 font-mono text-[6px] text-white"
                animate={{
                  borderColor: [
                    'rgba(255,255,255,0.08)',
                    'rgba(255,255,255,0.08)',
                    'rgba(251,113,133,0.65)',
                    'rgba(251,113,133,0.65)',
                    'rgba(255,255,255,0.08)',
                  ],
                  boxShadow: [
                    '0 0 0 rgba(251,113,133,0)',
                    '0 0 0 rgba(251,113,133,0)',
                    '0 0 18px rgba(251,113,133,.34)',
                    '0 0 18px rgba(251,113,133,.34)',
                    '0 0 0 rgba(251,113,133,0)',
                  ],
                }}
                transition={{ duration: 12, times: [0, 0.75, 0.8, 0.97, 1], repeat: Infinity }}
              >
                PAY NOW
                <motion.span
                  className="absolute -right-1 -top-1 rounded bg-rose-400 px-1 py-0.5 font-mono text-[5px] text-white"
                  animate={{ opacity: [0, 0, 1, 1, 0], scale: [0.7, 0.7, 1, 1, 0.7] }}
                  transition={{ duration: 12, times: [0, 0.77, 0.8, 0.97, 1], repeat: Infinity }}
                >
                  OVERLAP
                </motion.span>
              </motion.div>
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.95 }}
        animate={{ opacity: 1, y: [0, 5, 0], scale: 1 }}
        transition={{
          opacity: { duration: 0.6, delay: 1.75 },
          scale: { duration: 0.6, delay: 1.75 },
          y: { duration: 6.5, repeat: Infinity, ease: 'easeInOut' },
        }}
        className="absolute bottom-0 right-0 z-40 w-[45%] rounded-2xl border border-rose-300/18 bg-[#11111b]/95 p-3.5 shadow-2xl shadow-black/30 backdrop-blur-xl sm:bottom-[1%] sm:w-[45%] sm:p-4"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[8px] tracking-[0.16em] text-white/40">RUN COMPLETE</span>
          <div className="flex gap-1 font-mono text-[6px] sm:text-[7px]">
            <span className="rounded-full bg-emerald-400/8 px-1.5 py-0.5 text-emerald-300">2 PASSED</span>
            <span className="rounded-full bg-rose-400/10 px-1.5 py-0.5 text-rose-300">1 ISSUE</span>
          </div>
        </div>
        <div className="mt-2.5 flex gap-2.5 rounded-xl border border-rose-300/18 bg-rose-400/5 p-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-rose-300/20 bg-rose-400/8">
            <EyeIcon className="h-3.5 w-3.5 text-rose-300" />
          </span>
          <div className="min-w-0">
            <p className="font-mono text-[6px] tracking-[0.14em] text-rose-300/75 sm:text-[7px]">
              VISUAL ISSUE
            </p>
            <p className="mt-1 text-[8px] leading-snug text-white/70 sm:text-[10px]">
              Checkout total overlaps the payment button.
            </p>
          </div>
        </div>
        <div className="mt-2.5 flex items-center justify-between text-[7px] sm:text-[8px]">
          <span className="text-white/30">Report ready to share</span>
          <span className="font-semibold text-violet-300">View replay →</span>
        </div>
      </motion.div>

      <div className="absolute bottom-[10%] left-[1%] hidden font-mono text-[7px] tracking-[0.18em] text-white/18 sm:block">
        DESCRIBE → GENERATE → RUN → REPORT
      </div>
    </div>
  );
}
