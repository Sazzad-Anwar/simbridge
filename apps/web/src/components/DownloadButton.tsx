"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Download, Loader2 } from "lucide-react";
import { APK_DOWNLOAD_URL } from "@/lib/constants";
import { cn } from "@/lib/utils";

type Phase = "idle" | "busy" | "done";

/**
 * Download button with a subtle download state flow. Uses a real <a href>
 * so native browser download behaviour is never prevented.
 */
export function DownloadButton({
  label = "Download Android APK",
  variant = "primary",
  url = APK_DOWNLOAD_URL,
  className,
  full,
  onStarted,
}: {
  label?: string;
  variant?: "primary" | "outline" | "outline-light";
  url?: string;
  className?: string;
  full?: boolean;
  onStarted?: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");

  const handleClick = () => {
    if (phase !== "idle") return;
    onStarted?.();
    setPhase("busy");
    window.setTimeout(() => setPhase("done"), 1200);
    window.setTimeout(() => setPhase("idle"), 3600);
  };

  const styles: Record<NonNullable<typeof variant>, string> = {
    primary:
      "bg-brand text-white shadow-glow hover:brightness-110",
    outline: "border border-blue/30 bg-white text-blue hover:border-blue/60 hover:bg-bg-blue",
    "outline-light": "border border-white/25 bg-white/5 text-white hover:bg-white/10",
  };

  return (
    <a
      href={url}
      download
      onClick={handleClick}
      className={cn(
        "group relative inline-flex items-center justify-center gap-2.5 rounded-xl px-5 py-3 text-sm font-semibold transition-[transform,box-shadow,filter] duration-200 hover:scale-[1.02] active:scale-[0.98]",
        styles[variant],
        full && "w-full",
        className,
      )}
      aria-live="polite"
    >
      <AnimatePresence mode="wait" initial={false}>
        {phase === "idle" && (
          <motion.span
            key="idle"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="inline-flex items-center gap-2.5"
          >
            <Download className="h-4 w-4" aria-hidden />
            {label}
          </motion.span>
        )}
        {phase === "busy" && (
          <motion.span
            key="busy"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="inline-flex items-center gap-2.5"
          >
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Downloading…
          </motion.span>
        )}
        {phase === "done" && (
          <motion.span
            key="done"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="inline-flex items-center gap-2.5"
          >
            <Check className="h-4 w-4 text-success" aria-hidden />
            Download started ✓
          </motion.span>
        )}
      </AnimatePresence>
    </a>
  );
}