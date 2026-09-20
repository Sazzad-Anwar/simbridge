'use client'

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  BatteryLow,
  BatteryMedium,
  BellRing,
  Lock,
  RefreshCw,
  ShieldCheck,
  Signal,
  Smartphone,
  Wifi,
} from 'lucide-react'
import { SectionHeading } from '@/components/SectionHeading'
import { SectionReveal } from '@/lib/motion'

const STAGES = [
  { icon: Lock, label: 'Phone locked' },
  { icon: BellRing, label: 'SMS received' },
  { icon: Smartphone, label: 'SIMBridge detects message' },
  { icon: ShieldCheck, label: 'Message encrypted' },
  { icon: BatteryLow, label: 'Message queued' },
  { icon: RefreshCw, label: 'Sent to Receiver' },
]

export function BackgroundRelaySection() {
  const reduce = useReducedMotion()

  return (
    <section className="relative overflow-hidden bg-white py-24 sm:py-32">
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-2">
        {/* Locked phone visual */}
        <SectionReveal className="order-1">
          <div className="relative mx-auto w-fit">
            {/* Volume buttons */}
            <span
              className="absolute -left-0.75 top-22 h-16 w-0.75 rounded-l-xs bg-[#454c5c]"
              aria-hidden
            />
            <span
              className="absolute -left-0.75 top-42 h-16 w-0.75 rounded-l-xs bg-[#4a5162]"
              aria-hidden
            />
            {/* Power button */}
            <span
              className="absolute -right-0.75 top-34 h-24 w-0.75 rounded-r-xs bg-[#454c5c]"
              aria-hidden
            />

            <div className="relative rounded-[46px] bg-[#1b2029] p-1.75 shadow-card ring-1 ring-black/50">
              <div className="rounded-[40px] bg-linear-to-b from-[#2b313d] via-[#181d26] to-[#12161e] p-0.5">
                <div className="relative h-129.5 w-60.5 overflow-hidden rounded-[38px] bg-navy-deep">
                  {/* Punch-hole camera */}
                  <div
                    className="absolute left-1/2 top-4.5 z-20 h-2.75 w-2.75 -translate-x-1/2 rounded-full border border-white/10 bg-black shadow-[inset_0_0_3px_rgba(255,255,255,0.2)]"
                    aria-hidden
                  />

                  <AnimatePresence mode="wait">
                    {reduce ? (
                      <LockScreen key="static" />
                    ) : (
                      <motion.div
                        key="cycle"
                        className="h-full"
                      >
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1, y: [0, 0] }}
                          transition={{ duration: 0.4 }}
                        >
                          <LockScreen />
                        </motion.div>
                        <motion.div
                          initial={{ opacity: 0, y: 16 }}
                          animate={{ opacity: [0, 1, 1, 0], y: [16, 0, 0, -8] }}
                          transition={{
                            delay: 3,
                            duration: 6,
                            times: [0, 0.1, 0.85, 1],
                          }}
                          className="absolute inset-x-5 top-40 z-10 rounded-2xl border border-cyan/30 bg-white/95 p-3.5 shadow-glow"
                        >
                          <p className="text-[10px] font-bold uppercase tracking-wider text-cyan">
                            BANK
                          </p>
                          <p className="mt-0.5 text-[11px] font-medium text-ink">
                            Your bank OTP is 582941
                          </p>
                          <p className="mt-1.5 flex items-center gap-1 text-[9px] font-semibold text-success">
                            <ShieldCheck
                              className="h-3 w-3"
                              aria-hidden
                            />{' '}
                            encrypted &amp; queued
                          </p>
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Glass glare */}
                  <div
                    className="pointer-events-none absolute inset-0 z-20 bg-linear-to-br from-white/8 via-transparent to-white/2"
                    aria-hidden
                  />

                  <div className="absolute inset-0 flex items-end justify-center pb-8">
                    <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-[10px] font-semibold text-white/70">
                      Screen is off — relay is on
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </SectionReveal>

        {/* Stage list */}
        <div className="order-2">
          <SectionHeading
            align="left"
            eyebrow="Background relay"
            title="It works even when you're not looking."
            subtitle="SIMBridge is designed to run in the background on the Sender device."
          />

          <SectionReveal className="mt-8">
            <ol className="relative space-y-2.5">
              <span
                className="absolute bottom-4 left-5.25 top-4 w-px bg-line"
                aria-hidden
              />
              {STAGES.map((stage, i) => {
                const Icon = stage.icon
                return (
                  <motion.li
                    key={stage.label}
                    initial={reduce ? { opacity: 0 } : { opacity: 0, x: -14 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: '-40px' }}
                    transition={{ delay: i * 0.1, duration: 0.45 }}
                    className="relative flex items-center gap-4"
                  >
                    <span className="relative z-10 grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-line bg-white text-blue shadow-sm">
                      <Icon
                        className="h-5 w-5"
                        aria-hidden
                      />
                    </span>
                    <span className="rounded-xl border border-line/70 bg-bg px-4 py-2.5 text-sm font-medium text-ink">
                      {stage.label}
                    </span>
                  </motion.li>
                )
              })}
            </ol>
          </SectionReveal>

          <SectionReveal
            delay={0.15}
            className="mt-8"
          >
            <div className="rounded-2xl border-l-4 border-cyan bg-bg-blue p-5">
              <p className="text-base font-bold text-ink">
                The app doesn't need to be open for incoming SMS detection.
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Native Android background services handle the critical SMS relay
                path — reliably and quietly.
              </p>
            </div>
          </SectionReveal>
        </div>
      </div>
    </section>
  )
}

function LockScreen() {
  return (
    <div className="flex h-full flex-col">
      {/* Status bar */}
      <div className="flex items-center justify-between px-5 pt-3.5">
        <span className="text-[11px] font-semibold tracking-wide text-white/90">
          09:41
        </span>
        <span className="flex items-center gap-1.5 text-white/50">
          <Signal
            className="h-3 w-3"
            aria-hidden
          />
          <Wifi
            className="h-3 w-3"
            aria-hidden
          />
          <BatteryMedium
            className="h-3.5 w-3.5"
            aria-hidden
          />
        </span>
      </div>

      {/* Clock */}
      <div className="flex flex-1 flex-col items-center justify-center gap-2.5 px-6 text-center">
        <p className="text-[54px] font-extralight leading-none tracking-tight text-white">
          09:41
        </p>
        <p className="text-sm font-medium text-white/60">
          Sunday, September 20
        </p>
        <span className="mt-3 grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/10 text-white/80">
          <Lock
            className="h-4.5 w-4.5"
            aria-hidden
          />
        </span>
      </div>

      {/* Hint */}
      <p className="pb-7 text-center text-[10px] font-medium uppercase tracking-[0.18em] text-white/30">
        Swipe up to unlock
      </p>
    </div>
  )
}
