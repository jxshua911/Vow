import { ArrowRight, Sparkles } from 'lucide-react';
import { entitlementMessage, type EntitlementResult } from '@/lib/entitlements';

export function UpgradePrompt({ result, title = 'Keep VOW working for you', compact = false }: { result: EntitlementResult; title?: string; compact?: boolean }) {
  const message = entitlementMessage(result);

  function openUpgrade() {
    window.dispatchEvent(new CustomEvent('vow:navigate', { detail: 'upgrade' }));
  }

  return (
    <div className={`border border-vow-ink bg-vow-bg ${compact ? 'p-4' : 'p-5'}`}>
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 border border-vow-border flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4 text-vow-ink" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-vow-ink">{title}</p>
          <p className="text-xs text-vow-muted mt-1 leading-relaxed">{message}</p>
          <button type="button" onClick={openUpgrade} className="mt-3 vow-btn-primary text-xs inline-flex items-center gap-2">
            See VOW Premium <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
