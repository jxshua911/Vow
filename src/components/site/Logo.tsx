import { Link } from "@tanstack/react-router";
export function Logo({ inverted = false }: { inverted?: boolean }) {
  return <Link to="/" aria-label="VOW home" className="inline-flex items-center">
    <img src="/vow-wordmark.svg" alt="VOW" className={`block h-8 w-auto sm:h-9 ${inverted ? "brightness-0 invert" : ""}`} />
  </Link>;
}