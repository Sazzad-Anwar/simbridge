"use client";

import { Check, Link2, MessageSquare, CreditCard } from "lucide-react";
import { SectionHeading } from "@/components/SectionHeading";
import { SectionReveal, StaggerGroup, StaggerItem } from "@/lib/motion";

const STEPS = [
  {
    n: "01",
    title: "Keep your SIM",
    body: "Place your home SIM in the Sender Android phone.",
    icon: CreditCard,
    accent: "from-navy to-blue",
  },
  {
    n: "02",
    title: "Pair your devices",
    body: "Connect the Sender with your trusted Receiver.",
    icon: Link2,
    accent: "from-blue to-cyan",
  },
  {
    n: "03",
    title: "Receive your messages",
    body: "Incoming SMS are securely relayed to your Receiver.",
    icon: MessageSquare,
    accent: "from-cyan to-cyan-light",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative bg-white py-24 sm:py-32">
      <SectionHeading
        eyebrow="How it works"
        title="Simple by design."
        subtitle="Pair two phones once. SIMBridge handles the rest."
      />

      <StaggerGroup className="mx-auto mt-14 grid max-w-6xl gap-6 px-4 sm:px-6 md:grid-cols-3">
        {STEPS.map((step) => {
          const Icon = step.icon;
          return (
            <StaggerItem
              key={step.n}
              className="group relative overflow-hidden rounded-2xl border border-line bg-bg p-7 transition-all duration-300 hover:-translate-y-1.5 hover:border-blue/40 hover:shadow-card-hover"
            >
              <span className="absolute right-6 top-5 text-5xl font-extrabold text-line/80 transition-colors group-hover:text-blue/15" aria-hidden>
                {step.n}
              </span>
              <span
                className={`grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br ${step.accent} text-white shadow-md`}
              >
                <Icon className="h-7 w-7" aria-hidden />
              </span>
              <h3 className="mt-5 text-xl font-bold text-ink">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
              <span className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-cyan">
                <Check className="h-3.5 w-3.5" aria-hidden />
                Automated
              </span>
            </StaggerItem>
          );
        })}
      </StaggerGroup>

      <SectionReveal className="mx-auto mt-12 max-w-6xl px-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3 rounded-2xl border border-blue/20 bg-bg-blue/70 px-6 py-4 text-sm font-medium text-muted">
          <span className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-blue" aria-hidden /> Single device
          </span>
          <span className="hidden h-1 w-1 rounded-full bg-blue/40 sm:block" aria-hidden />
          <span className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-blue" aria-hidden /> One-time pairing
          </span>
          <span className="hidden h-1 w-1 rounded-full bg-blue/40 sm:block" aria-hidden />
          <span className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-blue" aria-hidden /> Endless relays
          </span>
        </div>
      </SectionReveal>
    </section>
  );
}