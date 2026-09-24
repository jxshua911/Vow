import { Link } from "@tanstack/react-router";
import { useLocale } from "@/lib/i18n";
import { Logo } from "./Logo";
import { site } from "@/content/site";

export function SiteFooter() {
  const sw=useLocale();
  return <footer className="bg-vow-bg text-vow-ink border-t border-vow-border">
    <div className="container-site py-14">
      <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr]">
        <div><Logo /><p className="mt-5 max-w-sm text-sm leading-7 text-vow-muted">{site.tagline}</p></div>
        <nav><p className="vow-label">{sw?"Gundua":"Explore"}</p><ul className="mt-5 space-y-3 text-sm">
          <li><Link to="/how-it-works">{sw?"Jinsi inavyofanya kazi":"How it works"}</Link></li><li><Link to="/work">{sw?"Kazi":"Work"}</Link></li><li><Link to="/services">{sw?"Huduma":"Services"}</Link></li><li><Link to="/support">{sw?"Wasiliana nasi":"Get in touch"}</Link></li>
        </ul></nav>
        <nav><p className="vow-label">{sw?"Sheria":"Legal"}</p><ul className="mt-5 space-y-3 text-sm">
          <li><Link to="/legal" hash="privacy">{sw?"Faragha":"Privacy"} Policy</Link></li><li><Link to="/legal" hash="terms">{sw?"Masharti":"Terms"} / EULA</Link></li><li><Link to="/legal" hash="copyright">{sw?"Hakimiliki":"Copyright"} / DMCA</Link></li><li><Link to="/legal" hash="account-deletion">{sw?"Kufuta akaunti":"Account deletion"}</Link></li>
        </ul></nav>
      </div>
      <div className="mt-12 border-t border-vow-border pt-6 text-xs text-vow-muted">
        <p>© 2026 VOW. All rights reserved.</p>
        <p className="mt-2">Designed and Developed by Joshua Nathan Kasanga</p>
      </div>
    </div>
  </footer>;
}