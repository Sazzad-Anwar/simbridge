"use client";

import { CheckCircle2, Download, Info, Package, Settings, ShieldOff } from "lucide-react";
import { DownloadButton } from "@/components/DownloadButton";
import { SectionHeading } from "@/components/SectionHeading";
import { SectionReveal } from "@/lib/motion";
import { APK_DOWNLOAD_URL } from "@/lib/constants";

const STEPS = [
  {
    icon: Download,
    title: "Download the SIMBridge APK",
    body: "The current build is distributed as an Android APK and is not on the Google Play Store yet. Download it from the button on this page (or from the GitHub releases page), and always use that official link.",
  },
  {
    icon: ShieldOff,
    title: "Pause Google Play Protect",
    body: "Play Protect can block apps that are not installed from the Play Store. Open the Google Play app, tap your profile picture, go to Play Protect → settings (gear icon), and switch off “Scan apps with Play Protect”. Turn it back on after installing.",
  },
  {
    icon: Settings,
    title: "Allow installs from unknown sources",
    body: "On Android 8 and later this is granted per app. Go to Settings → Apps → Special app access → Install unknown apps → choose Chrome (or the browser you downloaded with) → enable “Allow from this source”. You can also just tap the APK and confirm the on-screen prompt.",
  },
  {
    icon: Package,
    title: "Install and re-enable protection",
    body: "Open SIMBridge.apk from your notifications or Downloads folder, tap Install, and confirm. Once SIMBridge is ready, re-enable Google Play Protect so your device stays protected.",
  },
];

const NOTES = [
  "Re-enable Google Play Protect right after installation.",
  "Only install from the official download link or the GitHub releases page — APKs from other sources may be tampered with.",
  "The current build is Android-only. Sender SMS relay needs Android capabilities, so there is no iOS build yet.",
];

export function InstallSection() {
  return (
    <section id="install" className="relative bg-bg py-24 sm:py-32">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Setup"
          title="Installation guide"
          subtitle="SIMBridge isn't on the Play Store yet, so it's installed directly on your Android device. Here's how to do it safely."
        />

        <div className="mt-12 space-y-4">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <SectionReveal key={step.title}>
                <div className="flex gap-4 rounded-2xl border border-line bg-white p-6 shadow-card">
                  <span className="mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-bg-blue bg-bg-blue text-blue">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div>
                    <h3 className="text-[15px] font-bold text-ink">
                      <span className="mr-2 text-blue" aria-hidden>
                        Step {i + 1}.
                      </span>
                      {step.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted">{step.body}</p>
                  </div>
                </div>
              </SectionReveal>
            );
          })}
        </div>

        <SectionReveal className="mt-8 rounded-2xl border border-warning/30 bg-warning/10 p-6" delay={0.05}>
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden />
            <ul className="space-y-2">
              {NOTES.map((note) => (
                <li key={note} className="flex items-start gap-2 text-sm leading-relaxed text-muted">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
                  {note}
                </li>
              ))}
            </ul>
          </div>
        </SectionReveal>

        <SectionReveal className="mt-10 flex justify-center" delay={0.05}>
          <DownloadButton variant="outline" label="Download Android APK" url={APK_DOWNLOAD_URL} full={false} />
        </SectionReveal>
      </div>
    </section>
  );
}