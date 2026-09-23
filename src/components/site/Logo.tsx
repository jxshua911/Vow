import { Link } from "@tanstack/react-router";
export function Logo({ inverted = false }: { inverted?: boolean }) {
  const ink = inverted ? "#F7F7F5" : "#111111";
  return <Link to="/" aria-label="VOW home" className="inline-flex items-center">
    <svg width="116" height="32" viewBox="0 0 348 96" role="img" aria-label="VOW" className="block h-8 w-auto sm:h-9">
      <path d="M10 10 L76 48 L10 86" fill="none" stroke={ink} strokeWidth="12" strokeLinecap="square" strokeLinejoin="miter"/>
      <circle cx="132" cy="48" r="32" fill="none" stroke={ink} strokeWidth="12"/>
      <path d="M181 16 L205 80 L230 45 L255 80 L279 16" fill="none" stroke={ink} strokeWidth="12" strokeLinecap="square" strokeLinejoin="miter"/>
    </svg>
  </Link>;
}