import React from "react";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl" | number;
  variant?: "symbol" | "full" | "monochrome";
  className?: string;
}

export function CentauriAegisLogo({
  size = "md",
  variant = "symbol",
  className = "",
}: LogoProps) {
  const dimension =
    typeof size === "number"
      ? size
      : {
          sm: 24,
          md: 32,
          lg: 44,
          xl: 60,
        }[size] ?? 32;

  // Abstract heraldic aegis geometry combined with the Centauri 4-point/8-point astrometric guide
  const symbolSvg = (
    <svg
      width={dimension}
      height={dimension}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
      aria-label="Centauri Aegis Symbol"
    >
      <defs>
        <linearGradient id="aegis-outer" x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#9333EA" />
          <stop offset="50%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#3B82F6" />
        </linearGradient>
        <linearGradient id="aegis-inner" x1="12" y1="10" x2="36" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#A855F7" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#4F46E5" stopOpacity="0.4" />
        </linearGradient>
        <radialGradient id="centauri-core" cx="24" cy="22" r="10" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="40%" stopColor="#C084FC" />
          <stop offset="100%" stopColor="#7E22CE" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Outer Aegis Diamond-Shield Perimeter */}
      <path
        d="M24 3L42 12V25C42 34.5 34.5 42.5 24 45C13.5 42.5 6 34.5 6 25V12L24 3Z"
        stroke="url(#aegis-outer)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="#07070A"
      />

      {/* Layered Inner Shield Geometries */}
      <path
        d="M24 8L37 15V24C37 31.5 31.5 37.8 24 40C16.5 37.8 11 31.5 11 24V15L24 8Z"
        fill="url(#aegis-inner)"
        stroke="#8B5CF6"
        strokeWidth="1"
        strokeOpacity="0.5"
      />

      {/* Astrometric Centauri Crosshairs / Security Coordinates */}
      <line x1="24" y1="12" x2="24" y2="34" stroke="#D8B4FE" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.8" />
      <line x1="15" y1="22" x2="33" y2="22" stroke="#D8B4FE" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.8" />

      {/* Geometric Diamond Core */}
      <polygon
        points="24,16 29,22 24,28 19,22"
        fill="url(#centauri-core)"
      />

      {/* Core Node */}
      <circle cx="24" cy="22" r="2" fill="#FFFFFF" />
    </svg>
  );

  if (variant === "symbol") {
    return <div className={`inline-flex items-center justify-center ${className}`}>{symbolSvg}</div>;
  }

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      {symbolSvg}
      <div className="flex flex-col">
        <span className="font-sans text-base font-bold tracking-tight text-white leading-tight">
          Centauri <span className="text-purple-400">Aegis</span>
        </span>
        <span className="font-mono text-[9px] tracking-wider uppercase text-purple-300/70 font-medium">
          AI Security Testing &amp; Research
        </span>
      </div>
    </div>
  );
}
