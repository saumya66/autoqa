import { motion } from 'motion/react';
import { LogoMark } from './Icons';

const LINKS = [
  { label: 'Email', href: 'mailto:claritihq@gmail.com' },
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Terms of Use', href: '/terms' },
];

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-ink">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 px-6 py-12 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <LogoMark className="h-8 w-8" />
          <p className="font-bold text-white">Clariti</p>
        </div>

        <nav aria-label="Legal and contact" className="flex flex-wrap gap-x-6 gap-y-2">
          {LINKS.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="group relative text-sm text-white/50 transition-colors hover:text-white"
            >
              {l.label}
              <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-violet-400 transition-all duration-300 group-hover:w-full" />
            </a>
          ))}
        </nav>
      </div>

      {/* Oversized brand wordmark */}
      <div className="relative overflow-hidden">
        <motion.p
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '0px 0px -8% 0px' }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="text-gradient select-none whitespace-nowrap text-center font-extrabold leading-[0.78] tracking-tighter text-[clamp(4rem,25vw,20rem)]"
          style={{
            WebkitMaskImage: 'linear-gradient(to bottom, #000 55%, transparent)',
            maskImage: 'linear-gradient(to bottom, #000 55%, transparent)',
          }}
          aria-hidden="true"
        >
          Clariti
        </motion.p>
      </div>

      <div className="border-t border-white/5 py-5">
        <p className="text-center text-xs text-white/30">
          © 2026 Clariti. Built for teams who ship.
        </p>
      </div>
    </footer>
  );
}
