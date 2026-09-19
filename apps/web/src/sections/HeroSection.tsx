"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowDown, ShieldCheck } from "lucide-react";
import { DownloadButton } from "@/components/DownloadButton";
import { ConnectionAnimation } from "@/components/ConnectionAnimation";
import { EASE } from "@/lib/motion";
import { cn } from "@/lib/utils";

const FLOATERS = [
  { label: "Encrypted", className: "hidden lg:flex left-0 top-[12%]", dot: "bg-cyan" },
  { label: "Real-time", className: "hidden lg:flex right-[2%] top-[2%]", dot: "bg-blue-bright" },
  { label: "Secure", className: "hidden lg:flex right-[2%] top-[46%]", dot: "bg-success" },
  { label: "Offline Sync", className: "hidden lg:flex left-0 bottom-[18%]", dot: "bg-cyan-light" },
];

const PARTICLES = [
  { top: "16%", left: "12%", size: 5, delay: "0s" },
  { top: "28%", left: "82%", size: 4, delay: "1.4s" },
  { top: "64%", left: "8%", size: 4, delay: "0.8s" },
  { top: "72%", left: "90%", size: 5, delay: "2.1s" },
  { top: "38%", left: "46%", size: 3, delay: "3s" },
];

const reveal = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE } },
};

export function HeroSection() {
  const reduce = useReducedMotion();

  return (
    <section id="top" className="relative overflow-hidden pt-32 pb-20 sm:pt-40 sm:pb-28">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-0 bg-grid [mask-image:radial-gradient(ellipse_70%_60%_at_50%_20%,black,transparent)]" />
        <div className="absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-bg-blue blur-3xl" />
        <div className="absolute top-24 -left-32 h-80 w-80 rounded-full bg-cyan/10 blur-3xl" />
        <div className="absolute top-32 -right-24 h-96 w-96 rounded-full bg-blue/10 blur-3xl" />
        {!reduce &&
          PARTICLES.map((p, i) => (
            <span
              key={i}
              className="absolute rounded-full bg-blue/25 animate-pulse-soft"
              style={{ top: p.top, left: p.left, width: p.size, height: p.size, animationDelay: p.delay }}
            />
          ))}
        <svg className="absolute inset-x-0 bottom-0 h-40 w-full opacity-[0.06]" aria-hidden>
          <defs>
            <linearGradient id="hero-line" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#0B1F4D" />
              <stop offset="1" stopColor="#06B6D4" />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3].map((i) => (
            <line key={i} x1="0" y1={20 + i * 24} x2="100%" y2={20 + i * 24} stroke="url(#hero-line)" strokeWidth="1" />
          ))}
        </svg>
      </div>

      <div className="relative mx-auto grid max-w-6xl items-center gap-16 px-4 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-8">
        {/* Copy */}
        <motion.div variants={reveal} initial={reduce ? false : "hidden"} animate="show" className="max-w-xl">
          <motion.div
            variants={reduce ? reveal : undefined}
            className="inline-flex items-center gap-2 rounded-full border border-blue/20 bg-white/80 px-3.5 py-1.5 text-xs font-semibold text-blue shadow-sm"
          >
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            Secure SMS relay for Android
          </motion.div>

          <h1 className="mt-5 text-5xl font-extrabold leading-[1.05] tracking-tight text-ink sm:text-6xl">
            Your SIM.
            <br />
            Your messages.
            <br />
            <span className="text-gradient-cyan">Anywhere.</span>
          </h1>

          <p className="mt-6 max-w-md text-lg leading-relaxed text-muted">
            Keep your home SIM active while you live abroad. SIMBridge securely
            relays incoming SMS to your trusted phone.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <DownloadButton label="Download Android APK" />
            <a
              href="#how-it-works"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-white px-5 py-3 text-sm font-semibold text-ink transition-colors hover:border-blue/50 hover:text-blue"
            >
              See How It Works
              <ArrowDown className="h-4 w-4" aria-hidden />
            </a>
          </div>

          <p className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium tracking-wide text-muted">
            {["Android", "Secure", "Private", "Real-time"].map((item, i) => (
              <span key={item} className="flex items-center gap-2">
                {item}
                {i < 3 && <span className="text-cyan" aria-hidden>•</span>}
              </span>
            ))}
          </p>
        </motion.div>

        {/* Phone-to-phone visual */}
        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, ease: EASE, delay: 0.15 }}
          className="relative mx-auto w-full max-w-xl"
        >
          <div className="relative scale-[0.82] sm:scale-90 lg:scale-100 origin-top lg:origin-center">
            <ConnectionAnimation />
          </div>

          <div className="pointer-events-none absolute inset-0" aria-hidden>
            {FLOATERS.map((f) => (
              <span
                key={f.label}
                className={cn(
                  "absolute z-30 inline-flex items-center gap-1.5 rounded-full border border-line/80 bg-white/95 px-3 py-1.5 text-xs font-semibold text-ink shadow-card backdrop-blur",
                  f.className,
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", f.dot)} />
                {f.label}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}