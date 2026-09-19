"use client";

import { ArrowRight, File, Lock, ShieldCheck } from "lucide-react";
import { DownloadButton } from "@/components/DownloadButton";
import { SectionReveal } from "@/lib/motion";

export function DownloadSection() {
  return (
    <section className="relative overflow-hidden bg-brand" id="download">
      <div className="mx-auto max-w-4xl px-4 py-24 text-center sm:px-6 sm:py-32">
        <SectionReveal>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-cyan-light">Get SIMBridge</p>
          <h2 className="mt-4 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Keep your SIM.
            <br />
            Take your messages with you.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-dark">
            Download SIMBridge for Android and connect your trusted devices.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <DownloadButton label="Download Android APK" />
            <a
              href="#how-it-works"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              Learn how it works
              <ArrowRight className="h-4 w-4" aria-hidden />
            </a>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium text-muted-dark">
            <span className="flex items-center gap-1.5">
              <File className="h-3.5 w-3.5 text-cyan-light" aria-hidden /> Android APK
            </span>
            <span className="flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-cyan-light" aria-hidden /> Free to download
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-cyan-light" aria-hidden /> Secure connection
            </span>
          </div>
        </SectionReveal>
      </div>
    </section>
  );
}