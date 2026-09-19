"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, CloudUpload, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { SectionHeading } from "@/components/SectionHeading";
import { SectionReveal } from "@/lib/motion";

type State = "offline" | "restoring" | "delivered";

const PENDING = [
  { id: 1, from: "BANK", text: "Your bank OTP is 582941" },
  { id: 2, from: "VISA", text: "Payment of $49.00 approved" },
  { id: 3, from: "BT", text: "Your verification code is 220411" },
];

function useLoop(reduce: boolean): State {
  const [state, setState] = useState<State>(reduce ? "delivered" : "offline");
  useEffect(() => {
    if (reduce) return;
    const timers = [
      setTimeout(() => setState("restoring"), 4400),
      setTimeout(() => setState("delivered"), 6800),
      setTimeout(() => setState("offline"), 11000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [reduce, state]);

  // Restart loop after "delivered"
  useEffect(() => {
    if (reduce || state !== "delivered") return;
    const t = setTimeout(() => setState("offline"), 3600);
    return () => clearTimeout(t);
  }, [state, reduce]);

  return state;
}

export function OfflineSyncSection() {
  const reduce = useReducedMotion();
  const state = useLoop(reduce ?? false);

  return (
    <section className="relative overflow-hidden bg-bg py-24 sm:py-32">
      <div className="pointer-events-none absolute left-1/2 top-0 h-64 w-[640px] -translate-x-1/2 rounded-full bg-bg-blue blur-3xl" aria-hidden />

      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-2">
        {/* Copy + steps */}
        <div>
          <SectionHeading
            align="left"
            eyebrow="Offline sync"
            title="No internet? No problem."
            subtitle="Messages are never dependent on a live connection."
          />

          <div className="mt-8 space-y-4">
            <SectionReveal>
              <Step
                icon={<WifiOff className="h-5 w-5 text-error" aria-hidden />}
                title="SMS received offline"
                body="Saved securely on the Sender in an encrypted outbox — marked as pending."
                active={state === "offline"}
              />
            </SectionReveal>
            <SectionReveal delay={0.1}>
              <Step
                icon={<Wifi className="h-5 w-5 text-cyan" aria-hidden />}
                title="Connection restored"
                body="Pending messages upload through the secure backend automatically."
                active={state === "restoring"}
              />
            </SectionReveal>
            <SectionReveal delay={0.2}>
              <Step
                icon={<Check className="h-5 w-5 text-success" aria-hidden />}
                title="Everything synchronized"
                body="The Receiver gets every pending message. Nothing is missed."
                active={state === "delivered"}
              />
            </SectionReveal>
          </div>
        </div>

        {/* Live scenario */}
        <SectionReveal>
          <div className="relative mx-auto max-w-sm">
            <div className="rounded-[38px] border border-line bg-white p-[9px] shadow-card">
              <div className="overflow-hidden rounded-[29px] bg-navy-deep">
                {/* Status header */}
                <div className="flex items-center justify-between px-4 pb-3 pt-5">
                  <span className="text-xs font-semibold text-white/70">Receiver inbox</span>
                  <AnimatePresence mode="wait">
                    {state === "offline" && (
                      <motion.span
                        key="offline"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-1 rounded-full bg-error/15 px-2.5 py-1 text-[10px] font-bold text-red-400"
                      >
                        <WifiOff className="h-3 w-3" aria-hidden /> OFFLINE
                      </motion.span>
                    )}
                    {state === "restoring" && (
                      <motion.span
                        key="re"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-1 rounded-full bg-cyan/15 px-2.5 py-1 text-[10px] font-bold text-cyan-light"
                      >
                        <RefreshCw className="h-3 w-3 animate-spin" aria-hidden /> SYNCING
                      </motion.span>
                    )}
                    {state === "delivered" && (
                      <motion.span
                        key="on"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-[10px] font-bold text-emerald-300"
                      >
                        <Wifi className="h-3 w-3" aria-hidden /> 3 DELIVERED
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>

                {/* Pending / uploaded list */}
                <div className="h-[320px] px-4 pb-5">
                  <AnimatePresence mode="wait">
                    {state === "offline" && (
                      <motion.ul
                        key="pending"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="space-y-2.5"
                      >
                        {PENDING.map((m) => (
                          <li key={m.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-3">
                            <CloudUpload className="h-4 w-4 shrink-0 text-warning" aria-hidden />
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] font-bold text-white/90">{m.from}</p>
                              <p className="truncate text-[11px] text-white/50">{m.text}</p>
                            </div>
                            <span className="shrink-0 rounded-full bg-warning/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-warning">
                              Pending
                            </span>
                          </li>
                        ))}
                        <li className="pt-1 text-center text-[10px] font-medium text-white/40">
                          Saved securely on Sender
                        </li>
                      </motion.ul>
                    )}

                    {state === "restoring" && (
                      <motion.div
                        key="upload"
                        initial={{ opacity: 0, scale: 0.94 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex h-full flex-col items-center justify-center gap-4"
                      >
                        <div className="flex items-center gap-2 rounded-full border border-cyan/30 bg-cyan/10 px-4 py-2 text-xs font-semibold text-cyan-light">
                          <RefreshCw className="h-4 w-4 animate-spin" aria-hidden />
                          Uploading 3 pending messages…
                        </div>
                        {[0, 1, 2].map((i) => (
                          <motion.div
                            key={i}
                            className="h-2 w-40 rounded-full bg-gradient-to-r from-blue/60 to-cyan/60"
                            animate={{ scaleX: [0.2, 1], opacity: [0.4, 1] }}
                            transition={{ delay: i * 0.25, duration: 0.9, repeat: Infinity, repeatType: "reverse" }}
                          />
                        ))}
                      </motion.div>
                    )}

                    {state === "delivered" && (
                      <motion.ul
                        key="done"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="space-y-2.5"
                      >
                        {PENDING.map((m, i) => (
                          <motion.li
                            key={m.id}
                            initial={{ opacity: 0, x: 12 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.12 }}
                            className="flex items-center gap-3 rounded-2xl border border-success/25 bg-white/[0.07] p-3"
                          >
                            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-success/20">
                              <Check className="h-3 w-3 text-emerald-300" strokeWidth={3} aria-hidden />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] font-bold text-white/90">{m.from}</p>
                              <p className="truncate text-[11px] text-white/50">{m.text}</p>
                            </div>
                          </motion.li>
                        ))}
                        <li className="flex items-center justify-center gap-1.5 pt-1 text-center text-[11px] font-semibold text-emerald-300">
                          <Check className="h-3.5 w-3.5" aria-hidden /> Everything is synchronized.
                        </li>
                      </motion.ul>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
            <p className="mx-auto mt-4 max-w-xs text-center text-xs leading-relaxed text-muted">
              Offline inbox is stored locally, encrypted — then flushed automatically the moment connectivity returns.
            </p>
          </div>
        </SectionReveal>
      </div>
    </section>
  );
}

function Step({
  icon,
  title,
  body,
  active,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  active: boolean;
}) {
  return (
    <div
      className={`flex gap-4 rounded-2xl border p-4 transition-all duration-300 ${
        active ? "border-blue/40 bg-white shadow-card-hover" : "border-line bg-white/70"
      }`}
    >
      <span
        className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border transition-colors ${
          active ? "border-blue/30 bg-bg-blue" : "border-line bg-bg"
        }`}
      >
        {icon}
      </span>
      <div>
        <p className="text-sm font-bold text-ink">{title}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
      </div>
    </div>
  );
}