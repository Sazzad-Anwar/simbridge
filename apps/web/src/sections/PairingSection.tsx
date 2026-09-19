"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, PhoneCall, Radio, UserPlus } from "lucide-react";
import { SectionHeading } from "@/components/SectionHeading";
import { SectionReveal } from "@/lib/motion";

const STEPS = [
  { title: "Enter Receiver number", body: "The Sender initiates using the Receiver's phone number." },
  { title: "Receiver gets pairing request", body: "A secure request is delivered for explicit approval." },
  { title: "Receiver accepts", body: "Consent-based pairing — the Receiver is always in control." },
  { title: "Secure device pair created", body: "Device-bound keys are exchanged and stored securely." },
  { title: "Messages can now be relayed", body: "Real-time relay goes live between the two devices." },
];

export function PairingSection() {
  const reduce = useReducedMotion();

  return (
    <section className="relative bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Pairing"
          title="Pair once. Stay connected."
        />

        <div className="mx-auto mt-14 max-w-2xl">
          <div className="relative">
            {/* animated spine */}
            {!reduce && (
              <motion.span
                aria-hidden
                className="absolute left-6 top-2 bottom-2 w-0.5 origin-top bg-gradient-to-b from-blue via-cyan to-transparent"
                initial={{ scaleY: 0 }}
                whileInView={{ scaleY: 1 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
              />
            )}

            {STEPS.map((step, i) => (
              <motion.div
                key={step.title}
                initial={reduce ? { opacity: 0 } : { opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ delay: i * 0.12, duration: 0.5 }}
                className="relative flex gap-6 pb-9 last:pb-0"
              >
                <span className="relative z-10 grid h-12 w-12 shrink-0 place-items-center rounded-full border border-bg-blue bg-bg-blue text-blue shadow-sm">
                  {i === 0 ? (
                    <PhoneCall className="h-5 w-5" aria-hidden />
                  ) : i % 2 ? (
                    <Radio className="h-5 w-5" aria-hidden />
                  ) : (
                    <UserPlus className="h-5 w-5" aria-hidden />
                  )}
                </span>
                <div className="flex-1 rounded-2xl border border-line bg-bg p-5 transition-colors hover:border-blue/40 hover:bg-white">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-base font-bold text-ink">{step.title}</p>
                    <span className="shrink-0 text-xs font-bold text-cyan">0{i + 1}</span>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{step.body}</p>
                </div>
              </motion.div>
            ))}

            <SectionReveal delay={0.2}>
              <p className="flex items-center justify-center gap-2 pt-2 text-sm font-semibold text-success">
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                Relaying activated
              </p>
            </SectionReveal>
          </div>
        </div>
      </div>
    </section>
  );
}