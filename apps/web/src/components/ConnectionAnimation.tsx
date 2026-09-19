"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Signal, CreditCard } from "lucide-react";

/**
 * Signature hero visual: a "Home SIM" Sender phone and a Receiver phone joined
 * by a glowing curved bridge. A bank OTP message travels across the bridge and
 * is acknowledged with a delivered check — looping gently.
 *
 * Geometry is measured at runtime (ResizeObserver) so the travelling message
 * always lands exactly on the Receiver phone on any viewport.
 */

function PhoneShell({
  children,
  dark = false,
}: {
  children: React.ReactNode;
  dark?: boolean;
}) {
  return (
    <div
      className={`rounded-[26px] p-[6px] shadow-card ring-1 ${
        dark ? "bg-navy-deep ring-white/10" : "bg-white ring-line"
      }`}
    >
      <div
        className={`overflow-hidden rounded-[21px] ${
          dark ? "bg-navy" : "bg-white"
        } ${dark ? "text-white" : "text-ink"} shadow-inner`}
      >
        <div className="relative flex h-[190px] flex-col pt-4">{children}</div>
      </div>
    </div>
  );
}

type Phase = "travel" | "delivered";

export function ConnectionAnimation() {
  const reduce = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const senderRef = useRef<HTMLDivElement>(null);
  const receiverRef = useRef<HTMLDivElement>(null);

  const [size, setSize] = useState({ w: 1, h: 1 });
  const [from, setFrom] = useState({ x: 0, y: 0 });
  const [to, setTo] = useState({ x: 0, y: 0 });
  const [phase, setPhase] = useState<Phase>(reduce ? "delivered" : "travel");
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    const measure = () => {
      const box = containerRef.current?.getBoundingClientRect();
      const a = senderRef.current?.getBoundingClientRect();
      const b = receiverRef.current?.getBoundingClientRect();
      if (!box || !a || !b) return;
      setSize({ w: box.width, h: box.height });
      setFrom({
        x: a.left + a.width * 0.82 - box.left,
        y: a.top + a.height * 0.48 - box.top,
      });
      setTo({
        x: b.left + b.width * 0.18 - box.left,
        y: b.top + b.height * 0.48 - box.top,
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  useEffect(() => {
    if (reduce) return;
    const t =
      phase === "delivered"
        ? setTimeout(() => {
            setCycle((c) => c + 1);
            setPhase("travel");
          }, 2400)
        : setTimeout(() => setPhase("delivered"), 5000);
    return () => clearTimeout(t);
  }, [phase, reduce]);

  const dx = to.x - from.x;
  const arc = Math.min(from.y, to.y) - 52 - from.y;

  const bridgePath = `M ${from.x} ${from.y} Q ${(from.x + to.x) / 2} ${from.y + arc} ${to.x} ${to.y}`;

  const drawn = { pathLength: 1, opacity: 1 };

  return (
    <div ref={containerRef} className="relative mx-auto w-full max-w-xl select-none" aria-hidden={reduce ? "true" : undefined} role="img" aria-label="SIMBridge relays a verification code from the Home SIM sender to your phone">
      {/* Bridge */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox={`0 0 ${size.w} ${size.h}`}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="sb-bridge" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#2563EB" />
            <stop offset="100%" stopColor="#06B6D4" />
          </linearGradient>
        </defs>
        <motion.path
          d={bridgePath}
          fill="none"
          stroke="#67E8F9"
          strokeWidth="9"
          strokeLinecap="round"
          opacity={0.14}
        />
        <motion.path
          d={bridgePath}
          fill="none"
          stroke="url(#sb-bridge)"
          strokeWidth="2.5"
          strokeLinecap="round"
          initial={reduce ? { opacity: 0.9 } : { pathLength: 0, opacity: 0 }}
          animate={reduce ? { opacity: 0.9 } : drawn}
          transition={{ duration: 1.8, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>

      {/* Sender phone */}
      <div ref={senderRef} className="relative w-[44%] min-w-[140px] max-w-[215px] animate-float">
        <PhoneShell dark>
          <div className="mx-2 mb-1.5 flex items-center justify-between">
            <p className="text-[10px] font-bold text-white">Home SIM</p>
            <CreditCard className="h-3.5 w-3.5 text-cyan-light" />
          </div>
          <div className="mx-2 rounded-lg bg-white/10 px-2 py-1 text-[8px] font-semibold text-cyan-light">
            SENDER · relay active
          </div>
          <div className="mx-2 mt-2 rounded-lg rounded-tl-sm bg-white p-1.5 shadow">
            <p className="text-[7px] font-bold uppercase tracking-wider text-cyan">BANK</p>
            <p className="mt-0.5 text-[8px] leading-snug text-ink">
              Your verification code is 839421
            </p>
          </div>
        </PhoneShell>
        <p className="mt-1 -translate-x-1 text-center text-[10px] font-medium text-muted">
          Home SIM · Sender
        </p>
      </div>

      {/* Receiver phone */}
      <div ref={receiverRef} className="absolute right-0 top-[6%] w-[44%] min-w-[140px] max-w-[215px] animate-float-slow">
        <PhoneShell>
          <div className="mx-2 mb-1.5 flex items-center justify-between">
            <p className="text-[10px] font-bold text-ink">My Phone</p>
            <Signal className="h-3.5 w-3.5 text-blue" />
          </div>
          <div className="mx-2 rounded-lg bg-bg-blue px-2 py-1 text-[8px] font-semibold text-blue">
            RECEIVER
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={reduce ? "static" : `${phase}-${cycle}`}
              initial={reduce ? { opacity: 0.6 } : { opacity: 0, scale: 0.9 }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="mx-2 mt-2 flex-1"
            >
              <div className="rounded-lg rounded-tl-sm bg-white p-1.5 shadow ring-1 ring-line/60">
                <p className="text-[7px] font-bold uppercase tracking-wider text-cyan">BANK</p>
                <p className="mt-0.5 text-[8px] leading-snug text-ink">
                  Your verification code is 839421
                </p>
              </div>
              {phase === "delivered" && (
                <div className="mt-1.5 flex items-center gap-1">
                  <span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-success/15">
                    <Check className="h-2.5 w-2.5 text-success" strokeWidth={3} />
                  </span>
                  <span className="text-[8px] font-semibold text-success">Delivered securely</span>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </PhoneShell>
        <p className="mx-auto mt-1 w-max text-center text-[10px] font-medium text-muted">
          Your phone · Receiver
        </p>
      </div>

      {/* Travelling message bubble */}
      {!reduce && from.x > 0 && to.x > 0 && (
        <AnimatePresence>
          {phase === "travel" && (
            <motion.div
              key={`t-${cycle}`}
              className="absolute z-20 -translate-x-1/2 -translate-y-1/2"
              style={{ left: from.x, top: from.y }}
              initial={{ opacity: 0, scale: 0.85, x: 0, y: 0 }}
              animate={{
                x: [0, dx / 2, dx],
                y: [0, arc * 0.5 + (to.y - from.y) * 0.25, to.y - from.y],
                opacity: [0, 1, 1, 0],
                scale: [0.85, 1, 1, 0.98],
              }}
              transition={{
                x: { duration: 5, times: [0, 0.42, 1], ease: "linear" },
                y: { duration: 5, times: [0, 0.42, 1], ease: "easeInOut" },
                opacity: { duration: 5, times: [0, 0.05, 0.93, 1] },
                scale: { duration: 5, times: [0, 0.1, 0.93, 1] },
              }}
            >
              <div className="w-[120px] rounded-xl rounded-tl-sm bg-brand p-1.5 text-white shadow-glow">
                <p className="text-[7px] font-bold uppercase tracking-wider text-white/85">BANK</p>
                <p className="mt-0.5 text-[8px] leading-snug text-white">
                  Your verification code is 839421
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}