import type { ReactNode } from 'react';
import { GoalsPage } from './Goals';
import { GoalResources } from './GoalResources';
import { JournalPage } from './Journal';

export function GoalsJournalWorkspace({ children }: { children?: ReactNode }) {
  return (
    <div className="space-y-16">
      <GoalsPage />
      {children}
      <GoalResources />
      <section className="border-t border-vow-border pt-10">
        <div className="mb-6">
          <p className="vow-label mb-1">Journal</p>
          <p className="text-xs text-vow-muted leading-relaxed">Reflect on the work. Your entries stay private unless you explicitly choose to share something.</p>
        </div>
        <JournalPage embedded />
      </section>
    </div>
  );
}
