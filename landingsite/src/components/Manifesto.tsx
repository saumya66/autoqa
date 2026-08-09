import { motion } from 'motion/react';
import Eyebrow from './Eyebrow';
import ScrollTextBand from './ScrollTextBand';

export default function Manifesto() {
  return (
    <section id="solution" className="relative overflow-hidden py-28 sm:py-36">
      {/* starfield + glow */}
      <div className="pointer-events-none absolute inset-0 bg-dots opacity-40" aria-hidden="true" />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 60% 55% at 50% 45%, rgba(124,58,237,0.14), transparent 70%)' }}
        aria-hidden="true"
      />

      <div className="relative">
      <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '0px 0px -20% 0px' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="flex justify-center"
        >
          <Eyebrow>OUR THESIS</Eyebrow>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, filter: 'blur(8px)', y: 16 }}
          whileInView={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
          viewport={{ once: true, margin: '0px 0px -20% 0px' }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto mt-6 max-w-3xl text-[clamp(1.8rem,4.2vw,3rem)] font-extrabold leading-[1.1] tracking-tight text-white"
        >
          People use your product.{' '}
          <span className="text-gradient">Your tests should too.</span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '0px 0px -20% 0px' }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/55 sm:text-xl"
        >
          We started from one question: how does a great QA engineer actually test? They never read
          your code. They open the app, explore like a real user, notice when something feels off,
          and use the context their team gives them.
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '0px 0px -20% 0px' }}
          transition={{ duration: 0.8, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-white/55 sm:text-xl"
        >
          So we rebuilt testing around that — not scripts, not selectors, not even code.
        </motion.p>
      </div>
      </div>

      <div className="relative z-10 mt-16">
        <ScrollTextBand text="Presenting Clariti · Autonomous QA Agent · " />
      </div>
    </section>
  );
}
