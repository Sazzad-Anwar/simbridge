"use client";

import { Lock, Layers, RefreshCw, ShieldCheck, WifiOff } from "lucide-react";
import { TRUST_ITEMS } from "@/lib/constants";
import { StaggerGroup, StaggerItem, fadeUp } from "@/lib/motion";

const ICONS = [ShieldCheck, Lock, RefreshCw, WifiOff, Layers];

export function TrustBar() {
  return (
    <section className="relative border-y border-line/70 bg-white/70 backdrop-blur" aria-label="Why SIMBridge">
      <StaggerGroup className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-4 px-4 py-6 sm:px-6">
        {TRUST_ITEMS.map((item, i) => {
          const Icon = ICONS[i % ICONS.length];
          return (
            <StaggerItem
              key={item.label}
              variants={fadeUp}
              className="flex items-center gap-2 text-sm font-medium text-muted"
            >
              <Icon className="h-4 w-4 text-cyan" aria-hidden />
              {item.label}
            </StaggerItem>
          );
        })}
      </StaggerGroup>
    </section>
  );
}