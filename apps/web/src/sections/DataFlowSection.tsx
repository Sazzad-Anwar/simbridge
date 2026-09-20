'use client'

import { motion, useReducedMotion } from 'framer-motion'
import {
  Binary,
  Database,
  Globe,
  Lock,
  MessageSquare,
  Smartphone,
  Unlock,
  type LucideIcon,
} from 'lucide-react'
import { SectionHeading } from '@/components/SectionHeading'
import { SectionReveal } from '@/lib/motion'

const STEPS: Array<{ label: string; icon: LucideIcon; sub?: string }> = [
  { label: 'SMS', icon: MessageSquare, sub: 'plaintext on device' },
  { label: 'Encrypt', icon: Lock },
  { label: 'Ciphertext', icon: Binary },
  { label: 'Secure transport', icon: Globe },
  { label: 'Encrypted database', icon: Database },
  { label: 'Receiver', icon: Smartphone },
  { label: 'Decrypt', icon: Unlock },
  { label: 'SMS', icon: MessageSquare, sub: 'plaintext on device' },
]

export function DataFlowSection() {
  const reduce = useReducedMotion()

  return (
    <section className="relative bg-bg py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Data flow"
          title="Ciphertext end to end."
          subtitle="Plaintext exists only inside your devices. Everything in transit and at rest is encrypted."
        />

        <SectionReveal className="mt-14">
          <div className="rounded-3xl border border-line bg-white p-6 shadow-card sm:p-10">
            {/* Desktop flow */}
            <div className="relative hidden lg:block">
              <div
                className="absolute left-0 right-0 top-5 h-0.5 -translate-y-1/2 rounded-full bg-linear-to-r from-blue/25 via-cyan/40 to-blue/25"
                aria-hidden
              />
              <div className="grid grid-cols-8 gap-2">
                {STEPS.map((s, i) => {
                  const Icon = s.icon
                  return (
                    <div
                      key={i}
                      className="flex flex-col items-center gap-2"
                    >
                      <span className="relative z-10 grid h-10 w-10 place-items-center rounded-full border border-cyan/25 bg-bg-blue text-blue shadow-sm">
                        <Icon
                          className="h-4.5 w-4.5"
                          aria-hidden
                        />
                      </span>
                      <span className="flex min-h-12 w-full items-center justify-center rounded-xl border border-line bg-white px-2 py-2 text-center text-[11px] font-semibold leading-tight text-ink shadow-sm">
                        {s.label}
                      </span>
                      {s.sub && (
                        <p className="text-center text-[10px] text-muted">
                          {s.sub}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Mobile / tablet: vertical flow */}
            <div className="flex flex-col gap-2.5 lg:hidden">
              {STEPS.map((s, i) => {
                const Icon = s.icon
                return (
                  <div
                    key={i}
                    className="flex items-center gap-3"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-cyan/25 bg-bg-blue text-blue shadow-sm">
                      <Icon
                        className="h-4.5 w-4.5"
                        aria-hidden
                      />
                    </span>
                    <div>
                      <span className="inline-flex items-center rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink shadow-sm">
                        {s.label}
                      </span>
                      {s.sub && (
                        <p className="mt-1 text-[10px] text-muted">{s.sub}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Encrypted database block */}
            <div className="mt-8 rounded-2xl border border-cyan/25 bg-navy-deep p-6 sm:p-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Database
                    className="h-5 w-5 text-cyan-light"
                    aria-hidden
                  />
                  <p className="font-mono text-sm font-semibold text-white">
                    messages · ciphertext
                  </p>
                </div>
                <span className="hidden rounded-full bg-cyan/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-cyan-light sm:block">
                  at rest
                </span>
              </div>

              {/* Animated ciphertext blocks */}
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    aria-hidden
                    animate={reduce ? undefined : { opacity: [0.55, 1, 0.55] }}
                    transition={{
                      duration: 3.4,
                      repeat: Infinity,
                      delay: i * 0.7,
                    }}
                    className="space-y-1.5 rounded-xl bg-white/10 p-4"
                    style={{
                      fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                    }}
                  >
                    {[0, 1, 2].map((row) => (
                      <div
                        key={row}
                        className="flex gap-1"
                      >
                        {Array.from({ length: 10 }).map((_, b) => (
                          <span
                            key={b}
                            className={`h-1.5 w-1.5 rounded-xs ${b % 2 ? 'bg-cyan/70' : 'bg-white/40'}`}
                          />
                        ))}
                      </div>
                    ))}
                  </motion.div>
                ))}
              </div>

              <p className="mt-5 text-center text-sm font-semibold text-cyan-light">
                Backend never needs plaintext message content.
              </p>
            </div>
          </div>
        </SectionReveal>
      </div>
    </section>
  )
}
