'use client'

import { motion, useReducedMotion } from 'framer-motion'
import {
  BadgeCheck,
  Smartphone,
  Lock,
  Shield,
  MessageSquare,
  Landmark,
  Home,
  Phone,
} from 'lucide-react'
import { SectionHeading } from '@/components/SectionHeading'
import { SectionReveal } from '@/lib/motion'

const STAGES = [
  { label: 'BANK', icon: Landmark },
  { label: 'Home SIM', icon: Home },
  { label: 'Android Sender', icon: Smartphone },
  { label: 'Encrypted', icon: Lock },
  { label: 'Secure Bridge', icon: Shield },
  { label: 'Receiver', icon: Phone },
  { label: 'Your Phone', icon: MessageSquare },
]

export function RealTimeSection() {
  const reduce = useReducedMotion()

  return (
    <section className="relative overflow-hidden bg-navy-deep py-24 text-white sm:py-32">
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
      >
        <div className="absolute inset-0 bg-grid-dark mask-[radial-gradient(ellipse_60%_50%_at_50%_40%,black,transparent)]" />
        <div className="absolute -bottom-40 left-1/2 h-96 w-180 -translate-x-1/2 rounded-full bg-cyan/15 blur-3xl" />
        <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-blue/20 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          dark
          eyebrow="Real-time relay"
          title="From SMS received to your phone in seconds."
        />

        {/* Flow pipeline */}
        <SectionReveal className="mt-14">
          <div className="relative">
            <div
              className="absolute left-0 right-0 top-1/2 hidden h-px -translate-y-1/2 bg-linear-to-r from-transparent via-cyan/40 to-transparent md:block"
              aria-hidden
            />
            {!reduce && (
              <motion.div
                aria-hidden
                className="absolute top-1/2 z-10 hidden h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-cyan-light shadow-[0_0_16px_4px_rgba(103,232,249,0.6)] md:block"
                animate={{ left: ['0%', '100%'] }}
                transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
              />
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-7">
              {STAGES.map((stage, i) => {
                const Icon = stage.icon
                return (
                  <motion.div
                    key={stage.label}
                    initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-40px' }}
                    transition={{ delay: i * 0.09, duration: 0.5 }}
                    className="relative flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-5 backdrop-blur-sm"
                  >
                    <Icon
                      className="h-5 w-5 text-cyan-light"
                      aria-hidden
                    />
                    <span className="text-center text-[13px] font-semibold leading-tight">
                      {stage.label}
                    </span>
                    <span
                      className="h-1 w-8 rounded-full bg-linear-to-r from-blue/50 to-cyan/50"
                      aria-hidden
                    />
                  </motion.div>
                )
              })}
            </div>
          </div>
        </SectionReveal>

        {/* Final delivery */}
        <SectionReveal
          delay={0.2}
          className="mx-auto mt-12 max-w-xl"
        >
          <div className="rounded-2xl border border-cyan/25 bg-white/6 p-6 shadow-[0_0_60px_-20px_rgba(6,182,212,0.5)] backdrop-blur">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-cyan-light">
                BANK · OTP
              </p>
              <span className="flex items-center gap-1.5 rounded-full bg-success/15 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                <BadgeCheck
                  className="h-3.5 w-3.5"
                  aria-hidden
                />
                Delivered securely
              </span>
            </div>
            <p className="mt-3 bg-white/10 p-4 text-center font-mono text-2xl font-bold tracking-[0.12em] text-white">
              839421
            </p>
            <p className="mt-3 text-center text-sm text-muted-dark">
              Arrived on your Receiver seconds after the SMS was detected.
            </p>
          </div>
        </SectionReveal>
      </div>
    </section>
  )
}
