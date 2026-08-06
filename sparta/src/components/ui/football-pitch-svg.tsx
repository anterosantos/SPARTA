interface FootballPitchSvgProps {
  ariaLabel: string;
}

/**
 * Decorative top-down football pitch background (viewBox 300×400, our goal at
 * the bottom / attack direction upward) — shared by any component that
 * positions players on a pitch by primary position (see lib/field-layout.ts).
 */
export function FootballPitchSvg({ ariaLabel }: FootballPitchSvgProps) {
  return (
    <svg
      viewBox="0 0 300 400"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={ariaLabel}
      className="absolute inset-0 w-full h-full"
    >
      {/* Fundo verde */}
      <rect width="300" height="400" fill="#2d6a2d" rx="4" />

      {/* Limite exterior */}
      <rect x="15" y="10" width="270" height="380" stroke="white" strokeWidth="2" fill="none" strokeOpacity="0.9" />

      {/* Linha de meio-campo */}
      <line x1="15" y1="200" x2="285" y2="200" stroke="white" strokeWidth="1.5" strokeOpacity="0.9" />

      {/* Círculo central */}
      <circle cx="150" cy="200" r="33" stroke="white" strokeWidth="1.5" fill="none" strokeOpacity="0.9" />
      <circle cx="150" cy="200" r="2" fill="white" fillOpacity="0.9" />

      {/* Área de penálti superior */}
      <rect x="70" y="10" width="160" height="60" stroke="white" strokeWidth="1.5" fill="none" strokeOpacity="0.9" />
      <rect x="114" y="10" width="72" height="20" stroke="white" strokeWidth="1.5" fill="none" strokeOpacity="0.9" />
      <rect x="136" y="1" width="28" height="9" stroke="white" strokeWidth="1.5" fill="rgba(0,0,0,0.25)" strokeOpacity="0.9" />
      <circle cx="150" cy="50" r="2" fill="white" fillOpacity="0.9" />
      <path d="M 124 70 A 33 33 0 0 0 176 70" stroke="white" strokeWidth="1.5" fill="none" strokeOpacity="0.9" />

      {/* Área de penálti inferior */}
      <rect x="70" y="330" width="160" height="60" stroke="white" strokeWidth="1.5" fill="none" strokeOpacity="0.9" />
      <rect x="114" y="370" width="72" height="20" stroke="white" strokeWidth="1.5" fill="none" strokeOpacity="0.9" />
      <rect x="136" y="390" width="28" height="9" stroke="white" strokeWidth="1.5" fill="rgba(0,0,0,0.25)" strokeOpacity="0.9" />
      <circle cx="150" cy="350" r="2" fill="white" fillOpacity="0.9" />
      <path d="M 124 330 A 33 33 0 0 1 176 330" stroke="white" strokeWidth="1.5" fill="none" strokeOpacity="0.9" />

      {/* Arcos de canto */}
      <path d="M 23 10 A 8 8 0 0 1 15 18" stroke="white" strokeWidth="1.5" fill="none" strokeOpacity="0.9" />
      <path d="M 277 10 A 8 8 0 0 0 285 18" stroke="white" strokeWidth="1.5" fill="none" strokeOpacity="0.9" />
      <path d="M 15 382 A 8 8 0 0 0 23 390" stroke="white" strokeWidth="1.5" fill="none" strokeOpacity="0.9" />
      <path d="M 285 382 A 8 8 0 0 1 277 390" stroke="white" strokeWidth="1.5" fill="none" strokeOpacity="0.9" />
    </svg>
  );
}
