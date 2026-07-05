import { useId } from "react";

import { cn } from "@/lib/utils";

type LogoProps = {
  /** Icon size in pixels (width & height of the mark). */
  size?: number;
  /** Show the "PDF Quanta" wordmark next to the icon. */
  showText?: boolean;
  className?: string;
  textClassName?: string;
};

/**
 * PDF Quanta brand mark: a futuristic "Q" that blends into a folded document
 * page, with a glowing quantum particle node at its core. Indigo → violet
 * gradient reads well on both light and dark surfaces.
 */
export function LogoIcon({ size = 36, className }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  const grad = `pq-grad-${id}`;
  const glow = `pq-glow-${id}`;
  const core = `pq-core-${id}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      role="img"
      aria-label="PDF Quanta"
      className={cn("shrink-0", className)}
    >
      <defs>
        <linearGradient id={grad} x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4F46E5" />
          <stop offset="1" stopColor="#7C3AED" />
        </linearGradient>
        <radialGradient id={core} cx="0.5" cy="0.5" r="0.5">
          <stop stopColor="#FFFFFF" />
          <stop offset="0.55" stopColor="#E9D5FF" />
          <stop offset="1" stopColor="#C4B5FD" />
        </radialGradient>
        <filter id={glow} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
      </defs>

      {/* Folded document page filled with the brand gradient */}
      <path
        d="M11 4h17.2a3 3 0 0 1 2.12.88l6.8 6.8A3 3 0 0 1 38 13.8V41a3 3 0 0 1-3 3H11a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z"
        fill={`url(#${grad})`}
      />
      {/* Corner fold highlight */}
      <path d="M28 4.4v6.6a2 2 0 0 0 2 2h6.6" stroke="#FFFFFF" strokeOpacity="0.45" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />

      {/* Stylized Q ring */}
      <circle cx="23.5" cy="26.5" r="8.4" stroke="#FFFFFF" strokeWidth="2.4" strokeOpacity="0.95" />
      {/* Q tail */}
      <path d="M28.6 31.8 33 36.4" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" />

      {/* Glowing quantum particle node */}
      <circle cx="23.5" cy="26.5" r="4" fill={`url(#${core})`} filter={`url(#${glow})`} />
      <circle cx="23.5" cy="26.5" r="2.4" fill="#FFFFFF" />
    </svg>
  );
}

export function Logo({ size = 36, showText = true, className, textClassName }: LogoProps) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <LogoIcon size={size} className="drop-shadow-[0_4px_12px_color-mix(in_oklab,var(--primary)_35%,transparent)]" />
      {showText && (
        <span className={cn("truncate text-lg font-bold tracking-tight", textClassName)}>
          <span className="font-semibold text-muted-foreground">PDF</span>
          <span className="bg-gradient-to-r from-primary to-[#7C3AED] bg-clip-text text-transparent"> Quanta</span>
        </span>
      )}
    </span>
  );
}