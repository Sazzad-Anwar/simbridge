"use client";

import { SectionHeading } from "@/components/SectionHeading";
import { FeatureCard, FEATURES } from "@/components/FeatureCard";

export function FeaturesSection() {
  return (
    <section id="features" className="relative bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Features"
          title="Everything you need. Nothing you don't."
        />
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, i) => (
            <FeatureCard key={feature.title} feature={feature} delay={(i % 3) * 0.08} />
          ))}
        </div>
      </div>
    </section>
  );
}