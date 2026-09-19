"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BatteryLow, BellRing, Lock, RefreshCw, ShieldCheck, Smartphone } from "lucide-react";
import { SectionHeading } from "@/components/SectionHeading";
import { SectionReveal } from "@/lib/motion";

const STAGES = [
  { icon: Lock, label: "Phone locked" },
  { icon: BellRing, label: "SMS received" },
  { icon: Smartphone, label: "SIMBridge detects message" },
  { icon: ShieldCheck, label: "Message encrypted" },
  { icon: BatteryLow, label: "Message queued" },
  { icon: RefreshCw, label: "Sent to Receiver" },
];

export function BackgroundRelaySection() {
  const reduce = useReducedMotion();

  return (
    <section className="relative overflow-hidden bg-white py-24 sm:py-32">
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-2">
        {/* Locked phone visual */}
        <SectionReveal className="order-1">
          <div className="relative mx-auto w-fit">
            <div className="mx-auto w-[212px] rounded-[38px] border border-line bg-bg p-[9px] shadow-card">
              <div className="relative h-[430px] overflow-hidden rounded-[29px] bg-navy-deep">
                <div className="absolute left-1/2 top-[16px] h-[20px] w-[80px] -translate-x-1/2 rounded-full bg-black/60" aria-hidden />
                <AnimatePresence mode="wait">
                  {reduce ? (
                    <LockScreen key="static" />
                  ) : (
                    <motion.div key="cycle" className="h-full">
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
                        transition={{ delay: 3, duration: 6, times: [0, 0.1, 0.85, 1] }}
                        className="absolute inset-x-4 top-32 z-10 rounded-2xl border border-cyan/30 bg-white/95 p-3 shadow-glow"
                      >
                        <p className="text-[10px] font-bold uppercase tracking-wider text-cyan">BANK</p>
                        <p className="mt-0.5 text-[11px] font-medium text-ink">Your bank OTP is 582941</p>
                        <p className="mt-1.5 flex items-center gap-1 text-[9px] font-semibold text-success">
                          <ShieldCheck className="h-3 w-3" aria-hidden /> encrypted &amp; queued
                        </p>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <div className="absolute inset-0 flex items-end justify-center pb-8">
                  <span className="rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-semibold text-white/80">
                    Screen is off — relay is on
                  </span>
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
              <span className="absolute bottom-4 left-[21px] top-4 w-px bg-line" aria-hidden />
              {STAGES.map((stage, i) => {
                const Icon = stage.icon;
                return (
                  <motion.li
                    key={stage.label}
                    initial={reduce ? { opacity: 0 } : { opacity: 0, x: -14 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: "-40px" }}
                    transition={{ delay: i * 0.1, duration: 0.45 }}
                    className="relative flex items-center gap-4"
                  >
                    <span className="relative z-10 grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-line bg-white text-blue shadow-sm">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="rounded-xl border border-line/70 bg-bg px-4 py-2.5 text-sm font-medium text-ink">
                      {stage.label}
                    </span>
                  </motion.li>
                );
              })}
            </ol>
          </SectionReveal>

          <SectionReveal delay={0.15} className="mt-8">
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
  );
}

function LockScreen() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="grid h-16 w-16 place-items-center rounded-2xl bg-white/10 text-white"
      >
        <Lock className="h-7 w-7" aria-hidden />
      </motion.div>
      <p className="text-sm font-semibold text-white/80">Locked</p>
      <p className="text-xs text-white/40">09:41</p>
    </div>
  );
}