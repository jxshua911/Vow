import { Link } from "@tanstack/react-router";
import { Logo } from "./Logo";
import { site } from "@/content/site";
export function SiteFooter() {
  return <footer className="bg-vow-ink text-vow-bg">
    <div className="container-site py-16">
      <div className="grid gap-12 md:grid-cols-[1.5fr_1fr_1fr]">
        <div><Logo inverted /><p className="mt-5 max-w-sm text-sm leading-relaxed text-vow-muted">{site.tagline} A goal-planning and accountability app by {site.operator}. Public launch planned for {site.launchDate}.</p></div>
        <nav aria-label="Legal"><h2 className="vow-label !text-vow-muted">Legal</h2><ul className="mt-5 space-y-3 text-sm">
          <li><Link to="/privacy-policy" className="text-vow-muted hover:text-vow-bg">Privacy Policy</Link></li>
          <li><Link to="/terms" className="text-vow-muted hover:text-vow-bg">Terms / EULA</Link></li>
          <li><Link to="/copyright" className="text-vow-muted hover:text-vow-bg">Copyright / DMCA</Link></li>
        </ul></nav>
        <div><h2 className="vow-label !text-vow-muted">Contact & account</h2><ul className="mt-5 space-y-3 text-sm">
          <li><Link to="/support" className="text-vow-muted hover:text-vow-bg">Support & contact</Link></li>
          <li><Link to="/delete-account" className="text-vow-muted hover:text-vow-bg">Delete your account</Link></li>
          <li><a href={`mailto:${site.supportEmail}`} className="break-all text-vow-muted hover:text-vow-bg">{site.supportEmail}</a></li>
          <li><a href={`mailto:${site.privacyEmail}`} className="break-all text-vow-muted hover:text-vow-bg">{site.privacyEmail}</a></li>
        </ul></div>
      </div>
      <div className="mt-14 flex flex-col gap-3 border-t border-vow-muted/20 pt-6 text-xs text-vow-muted sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} {site.operator}. All rights reserved.</p><p>This website is not the VOW mobile app.</p>
      </div>
    </div>
  </footer>;
}