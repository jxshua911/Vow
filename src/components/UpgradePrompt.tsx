import { entitlementMessage, type EntitlementResult } from '@/lib/entitlements';

export function UpgradePrompt({ result, title = 'Keep VOW working for you', compact = false }: { result: EntitlementResult; title?: string; compact?: boolean }) {
  const message = entitlementMessage(result);

  function openUpgrade() {
    window.dispatchEvent(new CustomEvent('vow:navigate', { detail: 'upgrade' }));
  }

  return (
    <div className={`border border-vow-ink bg-vow-bg ${compact ? 'p-4' : 'p-5'}`}>
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 border border-vow-border flex items-center justify-center shrink-0 text-sm text-vow-ink">✦</div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-vow-ink">{title}</p>
          <p className="text-xs text-vow-muted mt-1 leading-relaxed">{message}</p>
          <button type="button" onClick={openUpgrade} className="mt-3 vow-btn-primary text-xs inline-flex items-center gap-2">
            See VOW Premium <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </div>
  );
}
