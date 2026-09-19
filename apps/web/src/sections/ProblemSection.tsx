"use client";

import { motion } from "framer-motion";
import { ArrowDown, CheckCircle2, XCircle } from "lucide-react";
import { SectionHeading } from "@/components/SectionHeading";
import { SectionReveal } from "@/lib/motion";

const WITHOUT = [
  { text: "Phone stays at home" },
  { text: "SMS arrives" },
  { text: "You can't access it easily" },
];

const WITH = [
  { text: "Home SIM", tone: "cyan" },
  { text: "Secure relay", tone: "blue" },
  { text: "Your phone", tone: "blue" },
  { text: "SMS instantly available", tone: "green" },
];

export function ProblemSection() {
  return (
    <section id="problem" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="The problem"
          title="Your SIM shouldn't limit where you live."
          subtitle="Moving abroad doesn't mean leaving your important messages behind."
        />

        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          {/* Without */}
          <SectionReveal>
            <div className="h-full rounded-2xl border border-line bg-white p-7 shadow-card">
              <p className="flex items-center gap-2 text-base font-bold text-muted">
                <XCircle className="h-5 w-5 text-error" aria-hidden />
                Without SIMBridge
              </p>
              <ol className="mt-6 space-y-4">
                {WITHOUT.map((step, i) => (
                  <li
                    key={step.text}
                    className="flex items-center gap-4 rounded-xl border border-line/60 bg-bg p-4"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg-blue text-sm font-bold text-blue">
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium text-muted">{step.text}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-6 rounded-xl bg-error/5 p-4 text-sm font-medium text-error">
                Banking OTPs, verification codes and alerts — unreachable.
              </p>
            </div>
          </SectionReveal>

          {/* With */}
          <SectionReveal delay={0.15}>
            <div className="h-full rounded-2xl bg-brand p-7 shadow-glow">
              <p className="flex items-center gap-2 text-base font-bold text-white">
                <CheckCircle2 className="h-5 w-5 text-emerald-300" aria-hidden />
                With SIMBridge
              </p>
              <ul className="mt-6 space-y-4">
                {WITH.map((step, i) => (
                  <motion.li
                    key={step.text}
                    initial={{ opacity: 0, x: 24 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: "-60px" }}
                    transition={{ delay: 0.2 + i * 0.14, duration: 0.55 }}
                    className="flex items-center gap-4 rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-bold text-white">
                      {i + 1}
                    </span>
                    <span className="text-sm font-semibold text-white">{step.text}</span>
                  </motion.li>
                ))}
              </ul>
              <p className="mt-6 flex items-center gap-2 rounded-xl bg-white/10 p-4 text-sm font-semibold text-cyan-light">
                <ArrowDown className="h-4 w-4" aria-hidden />
                Relayed within seconds — wherever you are.
              </p>
            </div>
          </SectionReveal>
        </div>
      </div>
    </section>
  );
}