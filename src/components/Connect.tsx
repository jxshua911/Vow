import { useMemo, useState } from 'react';
import { Check, ChevronRight, Link2, Search } from 'lucide-react';
import { PageHeader } from './AppShell';
import { INTEGRATIONS, type IntegrationCategory } from '@/lib/integrations/catalog';

const categories: { id: IntegrationCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'fitness', label: 'Fitness' },
  { id: 'health', label: 'Health' },
  { id: 'education', label: 'Education' },
  { id: 'productivity', label: 'Productivity' },
  { id: 'reading', label: 'Reading' },
  { id: 'mindfulness', label: 'Mindfulness' },
  { id: 'faith', label: 'Faith' },
];

export function ConnectPage() {
  const [category, setCategory] = useState<IntegrationCategory | 'all'>('all');
  const [query, setQuery] = useState('');
  const [connected, setConnected] = useState<string[]>([]);

  const integrations = useMemo(() => {
    const q = query.trim().toLowerCase();
    return INTEGRATIONS.filter((integration) => {
      const categoryMatch = category === 'all' || integration.category === category;
      const queryMatch = !q || `${integration.name} ${integration.description} ${integration.category}`.toLowerCase().includes(q);
      return categoryMatch && queryMatch;
    });
  }, [category, query]);

  return (
    <div>
      <PageHeader
        title="Connect"
        subtitle="Give VOW the evidence it needs to understand your progress."
      />

      <section className="mb-8 border border-vow-border p-5 md:p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 border border-vow-border flex items-center justify-center shrink-0">
            <Link2 className="w-4 h-4 text-vow-ink" />
          </div>
          <div>
            <h2 className="text-sm font-medium text-vow-ink mb-1">Connect what matters</h2>
            <p className="text-sm text-vow-muted leading-relaxed">
              VOW only asks for connections that can meaningfully support your goals. You stay in control of every permission, and VOW should never treat a connection as proof unless the underlying data supports it.
            </p>
          </div>
        </div>
      </section>

      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-vow-muted" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search connections"
          className="w-full border border-vow-border bg-transparent pl-10 pr-4 py-3 text-sm text-vow-ink outline-none focus:border-vow-ink"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
        {categories.map((item) => (
          <button
            key={item.id}
            onClick={() => setCategory(item.id)}
            className={`whitespace-nowrap px-3 py-2 text-xs border transition-colors ${
              category === item.id
                ? 'border-vow-ink text-vow-ink'
                : 'border-vow-border text-vow-muted hover:text-vow-ink'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {integrations.map((integration) => {
          const isConnected = connected.includes(integration.id);
          const available = integration.status === 'available';

          return (
            <div key={integration.id} className="border border-vow-border p-4 md:p-5 flex items-center gap-4">
              <div className="w-10 h-10 border border-vow-border flex items-center justify-center shrink-0 text-xs font-medium text-vow-ink">
                {integration.name.slice(0, 1)}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-medium text-vow-ink">{integration.name}</h3>
                  {isConnected && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-vow-ink">
                      <Check className="w-3 h-3" /> Connected
                    </span>
                  )}
                </div>
                <p className="text-xs text-vow-muted mt-1 leading-relaxed">{integration.description}</p>
                <p className="text-[10px] text-vow-muted mt-2">Evidence: {integration.evidence.join(' · ')}</p>
              </div>

              <button
                disabled={!available || isConnected}
                onClick={() => setConnected((current) => [...current, integration.id])}
                className={`shrink-0 inline-flex items-center gap-1 px-3 py-2 text-xs border transition-colors ${
                  isConnected
                    ? 'border-vow-border text-vow-muted'
                    : available
                      ? 'border-vow-ink text-vow-ink hover:bg-vow-border/40'
                      : 'border-vow-border text-vow-muted opacity-60'
                }`}
              >
                {isConnected ? 'Connected' : available ? 'Connect' : 'Coming soon'}
                {!isConnected && available && <ChevronRight className="w-3 h-3" />}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
