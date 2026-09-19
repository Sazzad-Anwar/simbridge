"use client";

import { Database, Hourglass, KeyRound, Link2, Lock, ShieldCheck } from "lucide-react";
import { SectionHeading } from "@/components/SectionHeading";
import { SectionReveal, StaggerGroup, StaggerItem } from "@/lib/motion";

const CARDS = [
  {
    n: "01",
    icon: Lock,
    title: "End-to-end encryption",
    body: "Messages are encrypted before leaving the Sender and decrypted only on the trusted Receiver.",
  },
  {
    n: "02",
    icon: Database,
    title: "Encrypted database",
    body: "Message content is never stored as plaintext in the backend database.",
  },
  {
    n: "03",
    icon: Link2,
    title: "Secure device pairing",
    body: "Only explicitly paired devices can exchange messages.",
  },
  {
    n: "04",
    icon: ShieldCheck,
    title: "Secure transport",
    body: "All communication uses encrypted HTTPS/WSS connections.",
  },
  {
    n: "05",
    icon: KeyRound,
    title: "Device-bound keys",
    body: "Encryption keys are protected using platform secure storage.",
  },
  {
    n: "06",
    icon: Hourglass,
    title: "Automatic retention",
    body: "Messages can be automatically removed according to your retention settings.",
  },
];

export function SecuritySection() {
  return (
    <section id="security" className="relative overflow-hidden bg-navy-deep py-24 text-white sm:py-32">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-0 bg-grid-dark [mask-image:radial-gradient(ellipse_70%_60%_at_50%_20%,black,transparent)]" />
        <div className="absolute -top-32 right-[10%] h-80 w-80 rounded-full bg-blue/20 blur-3xl" />
        <div className="absolute -bottom-32 left-[5%] h-80 w-80 rounded-full bg-cyan/15 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          dark
          eyebrow="Security"
          title="Your messages are yours."
          subtitle="SIMBridge is designed around privacy and secure delivery."
        />

        <StaggerGroup className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <StaggerItem
                key={card.n}
                className="group rounded-2xl border border-white/10 bg-white/[0.05] p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-cyan/40 hover:bg-white/[0.08]"
              >
                <div className="flex items-center justify-between">
                  <span className="grid h-11 w-11 place-items-center rounded-xl border border-cyan/25 bg-cyan/10 text-cyan-light">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="text-sm font-bold text-white/25" aria-hidden>
                    {card.n}
                  </span>
                </div>
                <h3 className="mt-4 text-lg font-bold text-white">{card.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-dark">{card.body}</p>
              </StaggerItem>
            );
          })}
        </StaggerGroup>

        <SectionReveal className="mx-auto mt-10 max-w-3xl">
          <p className="text-center text-sm leading-relaxed text-muted-dark">
            Designed for secure SMS relay — no certifications are claimed, and no
            guarantee is implied. Security is built from verified engineering,
            not marketing.
          </p>
        </SectionReveal>
      </div>
    </section>
  );
}