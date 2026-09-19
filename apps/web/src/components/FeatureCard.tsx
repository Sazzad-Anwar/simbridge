import { motion } from "framer-motion";
import {
  Activity,
  BellRing,
  CheckCircle2,
  ClipboardCopy,
  Cloud,
  Globe,
  History,
  KeyRound,
  Lock,
  RefreshCw,
  Smartphone,
  WifiOff,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface Feature {
  icon: LucideIcon;
  title: string;
  body: string;
}

export const FEATURES: Feature[] = [
  { icon: Activity, title: "Real-time delivery", body: "Messages arrive on the Receiver within seconds of being detected." },
  { icon: BellRing, title: "Background SMS detection", body: "Native Android services detect SMS without the app being open." },
  { icon: Smartphone, title: "Multi-SIM routing", body: "Each SIM on the Sender routes to its own paired destination." },
  { icon: WifiOff, title: "Offline message queue", body: "SMS received without connectivity is stored safely on the Sender." },
  { icon: RefreshCw, title: "Automatic retry", body: "Pending messages flush automatically once connectivity returns." },
  { icon: KeyRound, title: "Secure pairing", body: "Pair devices once through an explicit, consent-based flow." },
  { icon: Lock, title: "End-to-end encryption", body: "Content is encrypted on the Sender and decrypted on the Receiver." },
  { icon: Cloud, title: "Encrypted storage", body: "Backend persists only encrypted message payloads." },
  { icon: CheckCircle2, title: "Delivery acknowledgements", body: "Track pending, sent and delivered status for each message." },
  { icon: History, title: "Message history", body: "Browse past messages from your paired SIM devices." },
  { icon: ClipboardCopy, title: "OTP copy", body: "Copy one-time codes straight from the notification or inbox." },
  { icon: Globe, title: "Connection diagnostics", body: "See relay health, queue depth and sync state at a glance." },
];

export function FeatureCard({ feature, delay = 0 }: { feature: Feature; delay?: number }) {
  const Icon = feature.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.55, delay }}
      className="group rounded-2xl border border-line bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-all duration-300 hover:-translate-y-1.5 hover:border-blue/40 hover:shadow-card-hover"
    >
      <span className="grid h-11 w-11 place-items-center rounded-xl border border-bg-blue bg-bg-blue text-blue transition-all duration-300 group-hover:scale-105 group-hover:bg-gradient-to-br group-hover:from-blue group-hover:to-cyan group-hover:text-white">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <h3 className="mt-4 text-base font-bold text-ink">{feature.title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">{feature.body}</p>
    </motion.div>
  );
}