import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Logo } from "./Logo";
import { navLinks } from "@/content/site";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return <header className="sticky top-0 z-50 border-b border-vow-border/80 bg-vow-bg/95 backdrop-blur">
    <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-[60] focus:bg-vow-ink focus:px-4 focus:py-2 focus:text-sm focus:text-vow-bg">Skip to content</a>
    <div className="container-site flex h-[4.25rem] items-center justify-between">
      <Logo />
      <nav aria-label="Primary" className="hidden items-center gap-7 md:flex">
        {navLinks.map(l => <Link key={l.label} to={l.to} className="text-sm font-medium text-vow-muted transition-colors hover:text-vow-ink">{l.label}</Link>)}
        <Link to="/support" className="vow-btn-primary">Get in touch</Link>
      </nav>
      <button type="button" aria-expanded={open} aria-controls="mobile-nav" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen(v => !v)} className="grid size-10 place-items-center border border-vow-border text-vow-ink md:hidden">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">{open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 8h16M4 16h16" />}</svg>
      </button>
    </div>
    {open && <nav id="mobile-nav" aria-label="Mobile" className="border-t border-vow-border bg-vow-bg md:hidden">
      <div className="container-site flex flex-col py-2">
        {navLinks.map(l => <Link key={l.label} to={l.to} onClick={() => setOpen(false)} className="border-b border-vow-border/70 py-3.5 text-base font-medium text-vow-ink">{l.label}</Link>)}
        <Link to="/support" onClick={() => setOpen(false)} className="vow-btn-primary my-4">Get in touch</Link>
      </div>
    </nav>}
  </header>;
}