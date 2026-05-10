/**
 * Renders a country flag as an image from flagcdn.com.
 * Falls back to the emoji flag stored in DB if the image fails to load.
 *
 * Usage: <TeamFlag code="BRA" fallback="🇧🇷" size={24} />
 */

const CODE_MAP: Record<string, string> = {
  // Map FIFA codes to ISO 3166-1 alpha-2 (lowercase) for flagcdn
  MEX: "mx", RSA: "za", KOR: "kr", CZE: "cz",
  CAN: "ca", BIH: "ba", QAT: "qa", SUI: "ch",
  BRA: "br", MAR: "ma", HAI: "ht", SCO: "gb-sct",
  USA: "us", PAR: "py", AUS: "au", TUR: "tr",
  GER: "de", CUW: "cw", CIV: "ci", ECU: "ec",
  NED: "nl", JPN: "jp", SWE: "se", TUN: "tn",
  BEL: "be", EGY: "eg", IRN: "ir", NZL: "nz",
  ESP: "es", CPV: "cv", SAU: "sa", URU: "uy",
  FRA: "fr", SEN: "sn", IRQ: "iq", NOR: "no",
  ARG: "ar", ALG: "dz", AUT: "at", JOR: "jo",
  POR: "pt", COL: "co", UZB: "uz", COD: "cd",
  ENG: "gb-eng", CRO: "hr", GHA: "gh", PAN: "pa",
  // Legacy codes (from older data)
  POA: "eu", POB: "eu", POC: "eu", POD: "eu",
  FP1: "un", FP2: "un",
};

function getIsoCode(fifaCode: string): string {
  return CODE_MAP[fifaCode] ?? fifaCode.toLowerCase().slice(0, 2);
}

export default function TeamFlag({
  code,
  fallback,
  size = 24,
  className = "",
}: {
  code: string;
  fallback?: string;
  size?: number;
  className?: string;
}) {
  const iso = getIsoCode(code);
  const w = Math.round(size * 1.5); // flags are ~3:2 ratio
  const src = `https://flagcdn.com/w${w >= 40 ? 80 : 40}/${iso}.png`;

  return (
    <img
      src={src}
      alt={code}
      width={size}
      height={Math.round(size * 0.67)}
      className={`inline-block rounded-sm object-cover ${className}`}
      style={{ width: size, height: Math.round(size * 0.67) }}
      onError={(e) => {
        // Fallback to emoji if image fails
        const span = document.createElement("span");
        span.textContent = fallback ?? code;
        span.style.fontSize = `${size * 0.8}px`;
        (e.target as HTMLElement).replaceWith(span);
      }}
    />
  );
}
