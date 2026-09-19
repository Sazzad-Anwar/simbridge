"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Briefcase, Phone, CreditCard } from "lucide-react";
import { SectionHeading } from "@/components/SectionHeading";
import { SectionReveal } from "@/lib/motion";

const ROUTES = [
  {
    sim: "SIM 1 · +880 1711 •••••",
    receiver: "Receiver A",
    cap: "Personal Phone",
    icon: Phone,
    color: "from-blue to-cyan",
    text: "text-cyan",
    line: "from-blue/40 to-cyan/50",
  },
  {
    sim: "SIM 2 · +880 1811 •••••",
    receiver: "Receiver B",
    cap: "Work Phone",
    icon: Briefcase,
    color: "from-navy to-blue",
    text: "text-blue",
    line: "from-navy/40 to-blue/50",
  },
];

export function MultiSimSection() {
  const reduce = useReducedMotion();

  return (
    <section id="multi-sim" className="relative bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Multi-SIM"
          title="One phone. Multiple SIMs. Separate destinations."
          subtitle="SIMBridge can support multiple SIM subscriptions on a Sender device, with each SIM routed to its paired Receiver."
        />

        <div className="mt-14 grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          {/* Sender */}
          <SectionReveal className="mx-auto w-full max-w-sm">
            <div className="rounded-3xl border border-line bg-white p-6 shadow-card">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-ink">Sender Phone</p>
                <span className="rounded-full bg-bg-blue px-2.5 py-1 text-[10px] font-bold text-blue">
                  2 SIM ACTIVE
                </span>
              </div>
              <div className="mt-4 grid gap-3">
                {ROUTES.map((r) => (
                  <div key={r.sim} className="flex items-center gap-3 rounded-2xl border border-line bg-bg p-3">
                    <span className={`grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br ${r.color} text-white`}>
                      <CreditCard className="h-5 w-5" aria-hidden />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-ink">{r.sim}</p>
                      <p className={`text-xs font-medium ${r.text}`}>routed to {r.receiver}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </SectionReveal>

          {/* Routing */}
          <div className="relative">
            <div className="flex flex-col justify-center gap-8">
              {ROUTES.map((r, i) => {
                const Icon = r.icon;
                return (
                  <SectionReveal key={r.receiver} delay={0.1 + i * 0.15}>
                    <div className="flex items-center gap-4">
                      {/* Connector */}
                      <div className="relative h-px flex-1">
                        <div className={`absolute inset-0 rounded-full bg-gradient-to-r ${r.line}`} aria-hidden />
                        {!reduce && (
                          <motion.span
                            aria-hidden
                            className={`absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-gradient-to-br ${r.color}`}
                            style={{ boxShadow: "0 0 12px 2px rgba(6,182,212,0.5)" }}
                            animate={{ left: ["0%", "100%"] }}
                            transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut", delay: i * 1.2 }}
                          />
                        )}
                      </div>
                      <div className="flex w-full max-w-xs items-center gap-3 rounded-2xl border border-line bg-white p-4 shadow-card">
                        <span className={`grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br ${r.color} text-white`}>
                          <Icon className="h-5 w-5" aria-hidden />
                        </span>
                        <div>
                          <p className="text-sm font-bold text-ink">{r.receiver}</p>
                          <p className="text-xs text-muted">{r.cap}</p>
                        </div>
                      </div>
                    </div>
                  </SectionReveal>
                );
              })}
            </div>
            <SectionReveal delay={0.3} className="mt-8">
              <p className="rounded-2xl bg-bg-blue p-4 text-center text-sm font-semibold text-ink">
                Each SIM has its own secure route.
              </p>
            </SectionReveal>
          </div>
        </div>
      </div>
    </section>
  );
}