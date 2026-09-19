"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Database, Lock, Unlock } from "lucide-react";
import { SectionHeading } from "@/components/SectionHeading";
import { SectionReveal } from "@/lib/motion";

const STEPS: Array<{ label: string; icon?: "lock" | "unlock"; sub?: string }> = [
  { label: "SMS", sub: "plaintext on device" },
  { label: "Encrypt", icon: "lock" },
  { label: "Ciphertext" },
  { label: "Secure transport" },
  { label: "Encrypted database", icon: "lock" },
  { label: "Receiver" },
  { label: "Decrypt", icon: "unlock" },
  { label: "SMS", sub: "plaintext on device" },
];

function FlowNode({ label, icon, sub }: { label: string; icon?: "lock" | "unlock"; sub?: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-1">
      {icon && (
        <span className="grid h-8 w-8 place-items-center rounded-full border border-cyan/30 bg-bg-blue text-blue">
          {icon === "lock" ? <Lock className="h-4 w-4" aria-hidden /> : <Unlock className="h-4 w-4" aria-hidden />}
        </span>
      )}
      <span className="rounded-xl border border-line bg-white px-3 py-2 text-center text-xs font-semibold text-ink shadow-sm">
        {label}
      </span>
      {sub && <span className="text-[10px] text-muted">{sub}</span>}
    </div>
  );
}

export function DataFlowSection() {
  const reduce = useReducedMotion();

  return (
    <section className="relative bg-bg py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Data flow"
          title="Ciphertext end to end."
          subtitle="Plaintext exists only inside your devices. Everything in transit and at rest is encrypted."
        />

        <SectionReveal className="mt-14">
          <div className="relative rounded-3xl border border-line bg-white p-6 shadow-card sm:p-10">
            {/* Flow line */}
            <div className="mb-8 hidden items-center justify-center gap-2 lg:flex">
              {STEPS.map((s, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                  <FlowNode {...s} />
                  {i < STEPS.length - 1 && (
                    <span className="mt-1 hidden h-0.5 w-full rounded-full bg-gradient-to-r from-blue/20 to-cyan/20 lg:block" aria-hidden />
                  )}
                </div>
              ))}
            </div>

            {/* Mobile / tablet: vertical flow */}
            <div className="flex flex-col gap-3 lg:hidden">
              {STEPS.map((s, i) => (
                <div key={i} className="flex items-center gap-4">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-bg-blue text-[10px] font-bold text-blue">
                    {i + 1}
                  </span>
                  <FlowNode {...s} />
                </div>
              ))}
            </div>

            {/* Encrypted database block */}
            <div className="mt-8 rounded-2xl border border-cyan/25 bg-navy-deep p-6 sm:p-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Database className="h-5 w-5 text-cyan-light" aria-hidden />
                  <p className="font-mono text-sm font-semibold text-white">messages · ciphertext</p>
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
                    transition={{ duration: 3.4, repeat: Infinity, delay: i * 0.7 }}
                    className="space-y-1.5 rounded-xl bg-white/10 p-4"
                    style={{ fontFamily: "ui-monospace, SFMono-Regular, monospace" }}
                  >
                    {[0, 1, 2].map((row) => (
                      <div key={row} className="flex gap-1">
                        {Array.from({ length: 10 }).map((_, b) => (
                          <span key={b} className={`h-1.5 w-1.5 rounded-[2px] ${b % 2 ? "bg-cyan/70" : "bg-white/40"}`} />
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
  );
}