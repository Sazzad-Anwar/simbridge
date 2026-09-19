import Image from "next/image";

/**
 * SIMBridge brand mark.
 *
 * Uses the actual logo asset when provided (public/logo.png); falls back to a
 * clean "SB" monogram in the navy → royal blue → cyan identity.
 */

export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={`relative grid shrink-0 place-items-center overflow-hidden rounded-xl ${className}`}>
      <Image
        src="/logo.png"
        alt="SIMBridge logo"
        width={48}
        height={48}
        className="h-full w-full object-cover"
        priority
      />
    </span>
  );
}

export function LogoWordmark({ light = false }: { light?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <BrandMark className="h-9 w-9" />
      <span className={`text-lg font-bold tracking-tight ${light ? "text-white" : "text-ink"}`}>
        SIM<span className="text-gradient-cyan">Bridge</span>
      </span>
    </span>
  );
}