"use client";

import { Github } from "lucide-react";
import { LogoWordmark } from "@/components/Logo";
import { APP_VERSION, GITHUB_URL, NAV_LINKS, RELEASES_URL } from "@/lib/constants";

const FOOTER_LINKS = [...NAV_LINKS.map((l) => ({ href: l.href, label: l.label })), { href: "#download", label: "Download" }];

export function Footer() {
  return (
    <footer className="relative border-t border-line bg-white">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.2fr_1fr_1fr]">
          <div>
            <a href="#top" aria-label="SIMBridge home">
              <LogoWordmark />
            </a>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">
              Your SIM. Your messages. Anywhere. A personal SMS relay for paired devices.
            </p>
          </div>

          <nav aria-label="Footer">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Product</p>
            <ul className="mt-4 space-y-2.5">
              {FOOTER_LINKS.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="text-sm text-muted transition-colors hover:text-blue">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Legal</p>
            <ul className="mt-4 space-y-2.5">
              <li>
                <a href="#top" className="text-sm text-muted transition-colors hover:text-blue">
                  Privacy
                </a>
              </li>
              <li>
                <a href="#top" className="text-sm text-muted transition-colors hover:text-blue">
                  Terms
                </a>
              </li>
              <li className="pt-2">
                <a
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium text-ink transition-colors hover:text-blue"
                >
                  <Github className="h-4 w-4" aria-hidden />
                  GitHub
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-line/70 pt-6 sm:flex-row">
          <p className="text-xs text-muted">
            © {new Date().getFullYear()} SIMBridge. All rights reserved.
          </p>
          <p className="text-xs text-muted">
            Version{" "}
            <a
              href={RELEASES_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono font-semibold text-ink transition-colors hover:text-blue"
            >
              {APP_VERSION}
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}