"use client";

import { Compass, Globe2, Landmark, Smartphone } from "lucide-react";
import { SectionHeading } from "@/components/SectionHeading";
import { StaggerGroup, StaggerItem } from "@/lib/motion";

const CASES = [
  {
    icon: Globe2,
    title: "Living abroad",
    body: "Keep access to important SMS from your home SIM.",
  },
  {
    icon: Landmark,
    title: "Banking OTPs",
    body: "Receive important verification messages wherever you are.",
  },
  {
    icon: Compass,
    title: "Travel",
    body: "Stay connected to your home number while traveling.",
  },
  {
    icon: Smartphone,
    title: "Remote access",
    body: "Keep your trusted SIM device at home and receive messages remotely.",
  },
];

export function UseCasesSection() {
  return (
    <section className="relative bg-bg py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Use cases"
          title="Built for moments when your SIM can't travel with you."
        />

        <StaggerGroup className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {CASES.map((c) => {
            const Icon = c.icon;
            return (
              <StaggerItem
                key={c.title}
                className="group rounded-2xl border border-line bg-white p-6 transition-all duration-300 hover:-translate-y-1.5 hover:border-blue/40 hover:shadow-card-hover"
              >
                <span className="grid h-12 w-12 place-items-center rounded-2xl border border-bg-blue bg-bg-blue text-blue transition-all duration-300 group-hover:bg-gradient-to-br group-hover:from-blue group-hover:to-cyan group-hover:text-white">
                  <Icon className="h-6 w-6" aria-hidden />
                </span>
                <h3 className="mt-4 text-lg font-bold text-ink">{c.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{c.body}</p>
              </StaggerItem>
            );
          })}
        </StaggerGroup>

        <p className="mx-auto mt-10 max-w-2xl text-center text-sm leading-relaxed text-muted">
          SIMBridge is a personal relay utility. It is not affiliated with, or
          endorsed by, any bank or mobile operator.
        </p>
      </div>
    </section>
  );
}