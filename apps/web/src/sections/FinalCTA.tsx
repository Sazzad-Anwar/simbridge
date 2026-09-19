"use client";

import { ArrowDown, Sparkles } from "lucide-react";
import { BrandMark } from "@/components/Logo";
import { DownloadButton } from "@/components/DownloadButton";
import { SectionReveal } from "@/lib/motion";

export function FinalCTA() {
  return (
    <section className="relative overflow-hidden bg-bg py-24 sm:py-32">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute left-1/2 top-1/2 h-[420px] w-[720px] max-w-full -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-soft blur-3xl" />
        <div className="absolute inset-0 bg-grid [mask-image:radial-gradient(ellipse_45%_50%_at_50%_50%,black,transparent)]" />
      </div>

      <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
        <SectionReveal>
          <div className="mx-auto mb-8 w-fit animate-float">
            <BrandMark className="h-16 w-16 rounded-2xl shadow-glow" />
          </div>
          <h2 className="text-4xl font-extrabold tracking-tight text-ink sm:text-6xl">
            Your SIM.
            <br />
            Your messages.
            <br />
            <span className="text-gradient-cyan">Anywhere.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-md text-lg text-muted">
            Stay connected without carrying your home SIM everywhere.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <DownloadButton label="Download Android APK" />
            <a
              href="#features"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-white px-5 py-3 text-sm font-semibold text-ink transition-colors hover:border-blue/50 hover:text-blue"
            >
              <Sparkles className="h-4 w-4" aria-hidden />
              Explore Features
            </a>
          </div>

          <p className="mt-8 flex items-center justify-center gap-2 text-xs font-medium text-muted">
            <ArrowDown className="h-3.5 w-3.5 animate-pulse-soft text-cyan" aria-hidden />
            Scroll up to see how SIMBridge works
          </p>
        </SectionReveal>
      </div>
    </section>
  );
}