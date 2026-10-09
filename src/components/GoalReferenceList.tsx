import { useEffect, useState } from 'react';
import { Link2 } from '@/lib/ui-icons';
import { supabase } from '@/lib/supabase';
import { openExternalLink } from '@/lib/externalLinks';

type GoalResource = { id: string; url: string; title: string | null; resource_type: string; created_at: string };

function referencesFromPlan(value: unknown): GoalResource[] {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !('references' in value) || !Array.isArray(value.references)) {
    return [];
  }
  return value.references.flatMap((reference, index) => {
    if (!reference || typeof reference !== 'object' || Array.isArray(reference)) return [];
    const url = 'url' in reference && typeof reference.url === 'string' ? reference.url : '';
    if (!url.startsWith('https://')) return [];
    const title = 'title' in reference && typeof reference.title === 'string' ? reference.title : null;
    const resourceType = 'resource_type' in reference ? reference.resource_type : null;
    const allowedTypes = ['youtube', 'instagram', 'image', 'video', 'link'];
    return [{
      id: url || `plan-reference-${index}`,
      url,
      title,
      resource_type: typeof resourceType === 'string' && allowedTypes.some((type) => type === resourceType) ? resourceType : 'link',
      created_at: '',
    }];
  });
}

async function displayUrl(url: string) {
  if (!url.startsWith('storage://')) return url;
  const { data, error } = await supabase.storage.from('goal-resources').createSignedUrl(url.slice('storage://'.length), 60 * 60);
  if (error) throw error;
  return data?.signedUrl || '';
}

export function GoalReferenceList({ goalId }: { goalId: string }) {
  const [resources, setResources] = useState<Array<GoalResource & { displayUrl: string }>>([]);
  const [error, setError] = useState('');
  const [openError, setOpenError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { data, error: loadError } = await supabase
          .from('goal_resources')
          .select('id,url,title,resource_type,created_at')
          .eq('goal_id', goalId)
          .order('created_at', { ascending: true });
        let rows = (data || []) as GoalResource[];
        if (loadError || !rows.length) {
          if (loadError) console.error('[VOW] Goal resource rows could not be loaded; trying the saved plan:', loadError);
          const { data: goal, error: goalError } = await supabase
            .from('goals')
            .select('plan_json')
            .eq('id', goalId)
            .maybeSingle();
          if (goalError) {
            console.error('[VOW] Saved goal resources could not be loaded:', goalError);
            throw loadError || goalError;
          }
          rows = referencesFromPlan(goal?.plan_json);
          if (loadError && !rows.length) throw loadError;
        }
        const next = await Promise.all(
          rows.map(async (resource) => ({
            ...resource,
            displayUrl: await displayUrl(resource.url),
          }))
        );
        if (!cancelled) setResources(next);
      } catch (loadError) {
        console.error('[VOW] Goal references could not be loaded:', loadError);
        if (!cancelled) setError('Goal resources could not be loaded. Please try again later.');
      }
    })();
    return () => { cancelled = true; };
  }, [goalId]);

  if (!resources.length && !error) return null;
  return (
    <section className="mb-10">
      <div className="mb-4">
        <h2 className="vow-label">Goal references</h2>
        <p className="mt-1 text-xs text-vow-muted">References attached to this VOW.</p>
      </div>
      {error && <p role="alert" className="mb-4 border-l-2 border-vow-ink px-4 py-3 text-sm text-vow-muted">{error}</p>}
      {openError && <p role="alert" className="mb-4 border-l-2 border-vow-ink px-4 py-3 text-sm text-vow-muted">{openError}</p>}
      <div className="border-t border-vow-border">
        {resources.map((resource) => (
          <div key={resource.id} className="flex gap-4 border-b border-vow-border py-4">
            <div className="w-20 shrink-0">
              {resource.displayUrl && resource.resource_type === 'image' ? (
                <img src={resource.displayUrl} alt={resource.title || 'Goal reference'} className="h-20 w-20 border border-vow-border object-cover" />
              ) : resource.displayUrl && resource.resource_type === 'video' ? (
                <video src={resource.displayUrl} controls className="h-20 w-20 border border-vow-border object-cover" />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center border border-vow-border text-xs uppercase text-vow-muted">{resource.resource_type}</div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-vow-ink">{resource.title || resource.url}</p>
              <p className="mt-1 text-xs capitalize text-vow-muted">{resource.resource_type}</p>
              {resource.displayUrl && resource.resource_type !== 'image' && resource.resource_type !== 'video' && (
                <button
                  type="button"
                  onClick={() => {
                    setOpenError('');
                    void openExternalLink(resource.displayUrl).catch((openError: unknown) => {
                      console.error('[VOW] Goal resource could not be opened:', openError);
                      setOpenError('We could not open this resource. Please try again.');
                    });
                  }}
                  className="mt-2 inline-flex items-center gap-1 text-xs text-vow-muted hover:text-vow-ink"
                >
                  <span className="max-w-md truncate">Open reference</span>
                  <Link2 className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
