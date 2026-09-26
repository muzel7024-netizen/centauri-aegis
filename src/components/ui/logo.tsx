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
          sm: 20,
          md: 28,
          lg: 38,
          xl: 52,
        }[size] ?? 28;

  // Technical Aegis Insignia: Precision geometry in graphite, neutral grey, and off-white
  const symbolSvg = (
    <svg
      width={dimension}
      height={dimension}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
      aria-label="Centauri Aegis Insignia"
    >
      {/* Outer Technical Shield-Diamond Boundary */}
      <path
        d="M24 3L42 12V25C42 34.5 34.5 42.5 24 45C13.5 42.5 6 34.5 6 25V12L24 3Z"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-[#C8CBC7] fill-[#FFFFFF] dark:stroke-[#303338] dark:fill-[#111214]"
      />

      {/* Inner Precision Offset Guide */}
      <path
        d="M24 8L37 15V24C37 31.5 31.5 37.8 24 40C16.5 37.8 11 31.5 11 24V15L24 8Z"
        strokeWidth="1"
        className="stroke-[#D9DBD8] fill-[#ECEDEA] dark:stroke-[#242629] dark:fill-[#161719]"
      />

      {/* Precision Astrometric Crosshairs */}
      <line x1="24" y1="13" x2="24" y2="35" strokeWidth="1.25" strokeLinecap="round" className="stroke-[#737873] dark:stroke-[#707277]" />
      <line x1="14" y1="24" x2="34" y2="24" strokeWidth="1.25" strokeLinecap="round" className="stroke-[#737873] dark:stroke-[#707277]" />

      {/* Internal Security Diamond Coordinate */}
      <polygon
        points="24,18 29,24 24,30 19,24"
        strokeWidth="1.5"
        className="stroke-[#171918] fill-[#DFE1DD] dark:stroke-[#B8BABD] dark:fill-[#1B1D20]"
      />

      {/* Center Point */}
      <circle cx="24" cy="24" r="1.75" className="fill-[#171918] dark:fill-[#E5E5E5]" />
    </svg>
  );

  if (variant === "symbol") {
    return <div className={`inline-flex items-center justify-center ${className}`}>{symbolSvg}</div>;
  }

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      {symbolSvg}
      <div className="flex flex-col">
        <span className="font-sans text-sm font-semibold tracking-tight text-foreground leading-none">
          Centauri Aegis
        </span>
        <span className="font-mono text-[9px] tracking-wider uppercase text-muted-foreground font-normal mt-1">
          AI Security Testing &amp; Research
        </span>
      </div>
    </div>
  );
}
