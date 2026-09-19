"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Plus } from "lucide-react";
import { SectionHeading } from "@/components/SectionHeading";
import { SectionReveal } from "@/lib/motion";
import { cn } from "@/lib/utils";

const FAQS = [
  {
    q: "Does SIMBridge work when the Sender app is closed?",
    a: "The Sender uses native Android background functionality to detect incoming SMS. The app is designed so the UI does not need to remain open.",
  },
  {
    q: "What happens if the Sender loses internet?",
    a: "Incoming messages are placed in an encrypted local queue and automatically retried when connectivity returns.",
  },
  {
    q: "Can I use two SIMs?",
    a: "SIMBridge is designed to support multiple SIM subscriptions and separate routing configurations.",
  },
  {
    q: "Are messages stored on the server?",
    a: "Messages may be stored as encrypted ciphertext for delivery and offline synchronization. Plaintext SMS content should not be stored in the backend database.",
  },
  {
    q: "Can I pair multiple devices?",
    a: "Use the device-pairing system to connect trusted Sender and Receiver devices.",
  },
  {
    q: "Is my SMS stored as plain text?",
    a: "No. The production architecture should encrypt message content before backend persistence.",
  },
  {
    q: "Does it work on iPhone?",
    a: "Sender SMS relay requires Android-specific capabilities. Receiver functionality can be designed separately for supported platforms.",
  },
];

function FaqItem({ q, a, index }: { q: string; a: string; index: number }) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const panelId = `faq-panel-${index}`;
  const buttonId = `faq-button-${index}`;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border bg-white transition-colors",
        open ? "border-blue/40 shadow-card" : "border-line hover:border-blue/30",
      )}
    >
      <h3>
        <button
          id={buttonId}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
        >
          <span className="text-[15px] font-semibold text-ink">{q}</span>
          <motion.span
            animate={{ rotate: open ? 45 : 0 }}
            transition={reduce ? { duration: 0 } : { duration: 0.25 }}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-bg-blue bg-bg-blue text-blue"
            aria-hidden
          >
            <Plus className="h-4 w-4" />
          </motion.span>
        </button>
      </h3>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            role="region"
            aria-labelledby={buttonId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={reduce ? { duration: 0 } : { duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <p className="px-5 pb-5 text-sm leading-relaxed text-muted">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FAQ() {
  return (
    <section id="faq" className="relative bg-bg py-24 sm:py-32">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="FAQ"
          title="Questions, answered."
        />

        <SectionReveal className="mt-12 space-y-3">
          {FAQS.map((faq, i) => (
            <FaqItem key={faq.q} q={faq.q} a={faq.a} index={i} />
          ))}
        </SectionReveal>
      </div>
    </section>
  );
}