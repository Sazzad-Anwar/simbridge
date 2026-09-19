"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, MessageSquare, QrCode, CreditCard } from "lucide-react";
import { SectionReveal } from "@/lib/motion";

const SENDER = {
  role: "Sender",
  tag: "Your home SIM",
  icon: CreditCard,
  items: [
    "Detect incoming SMS",
    "Runs in background",
    "Multi-SIM support",
    "Local encrypted queue",
    "Automatic retry",
  ],
};

const RECEIVER = {
  role: "Receiver",
  tag: "Your everyday phone",
  icon: MessageSquare,
  items: [
    "Receive instantly",
    "Message history",
    "OTP copy",
    "Missed message sync",
    "Delivery status",
  ],
};

export function SenderReceiverSection() {
  const reduce = useReducedMotion();

  return (
    <section className="relative overflow-hidden bg-bg py-24 sm:py-32">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-0 bg-grid [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,black,transparent)]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-2">
          {[SENDER, RECEIVER].map((role, col) => {
            const Icon = role.icon;
            return (
              <SectionReveal key={role.role} delay={col * 0.12}>
                <div
                  className={`relative h-full overflow-hidden rounded-3xl border p-8 shadow-card ${
                    col === 0 ? "border-navy/15 bg-white" : "bg-brand text-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-xs font-bold uppercase tracking-[0.18em] ${col === 0 ? "text-cyan" : "text-cyan-light"}`}>
                        Role
                      </p>
                      <h3 className={`mt-1 text-2xl font-extrabold ${col === 0 ? "text-ink" : "text-white"}`}>
                        {role.role}
                      </h3>
                      <p className={`mt-1 text-sm font-medium ${col === 0 ? "text-muted" : "text-white/75"}`}>
                        {role.tag}
                      </p>
                    </div>
                    <span
                      className={`grid h-14 w-14 place-items-center rounded-2xl ${
                        col === 0 ? "border border-bg-blue bg-bg-blue text-blue" : "bg-white/15 text-white"
                      }`}
                    >
                      <Icon className="h-7 w-7" aria-hidden />
                    </span>
                  </div>

                  <ul className="mt-7 space-y-3">
                    {role.items.map((item, i) => (
                      <motion.li
                        key={item}
                        initial={reduce ? { opacity: 0 } : { opacity: 0, x: col === 0 ? -16 : 16 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true, margin: "-40px" }}
                        transition={{ delay: i * 0.08, duration: 0.45 }}
                        className="flex items-center gap-3"
                      >
                        <CheckCircle2 className={`h-5 w-5 shrink-0 ${col === 0 ? "text-success" : "text-emerald-300"}`} aria-hidden />
                        <span className={`text-sm font-semibold ${col === 0 ? "text-ink" : "text-white"}`}>{item}</span>
                      </motion.li>
                    ))}
                  </ul>

                  {col === 0 && (
                    <span className="mt-7 flex items-center gap-2 rounded-xl bg-bg-blue px-4 py-2.5 text-xs font-semibold text-blue">
                      <QrCode className="h-4 w-4" aria-hidden />
                      Paired via QR in the mobile app
                    </span>
                  )}
                  {col === 1 && (
                    <span className="mt-7 flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-xs font-semibold text-white">
                      <CheckCircle2 className="h-4 w-4 text-emerald-300" aria-hidden />
                      Always in sync, even after reconnects
                    </span>
                  )}
                </div>
              </SectionReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}