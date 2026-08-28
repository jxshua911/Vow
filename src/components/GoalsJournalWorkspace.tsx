import type { ReactNode } from 'react';
import { GoalsPage } from './Goals';
import { JournalPage } from './Journal';

export function GoalsJournalWorkspace({ children }: { children?: ReactNode }) {
  return (
    <div className="space-y-16">
      <GoalsPage />
      {children}
      <section className="border-t border-vow-border pt-10">
        <div className="mb-6">
          <p className="vow-label mb-1">Reflect on the work</p>
          <p className="text-xs text-vow-muted leading-relaxed">Keep your journal close to your goals. Your writing stays private unless you explicitly choose to share something.</p>
        </div>
        <JournalPage />
      </section>
    </div>
  );
}
