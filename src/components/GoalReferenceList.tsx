import { useEffect, useState } from 'react';
import { Link2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type GoalResource = { id: string; url: string; title: string | null; resource_type: string; created_at: string };

async function displayUrl(url: string) {
  if (!url.startsWith('storage://')) return url;
  const { data } = await supabase.storage.from('goal-resources').createSignedUrl(url.slice('storage://'.length), 60 * 60);
  return data?.signedUrl || '';
}

export function GoalReferenceList({ goalId }: { goalId: string }) {
  const [resources, setResources] = useState<Array<GoalResource & { displayUrl: string }>>([]);
  useEffect(() => {
    let cancelled = false;
    supabase.from('goal_resources').select('id,url,title,resource_type,created_at').eq('goal_id', goalId).order('created_at', { ascending: true }).then(async ({ data }) => {
      const next = await Promise.all(((data || []) as GoalResource[]).map(async (resource) => ({ ...resource, displayUrl: await displayUrl(resource.url) })));
      if (!cancelled) setResources(next);
    });
    return () => { cancelled = true; };
  }, [goalId]);

  if (!resources.length) return null;
  return <section className="mb-10"><div className="flex items-center justify-between mb-4"><div><h2 className="vow-label">Goal references</h2><p className="text-xs text-vow-muted mt-1">References attached to this VOW.</p></div></div><div className="border-t border-vow-border">{resources.map((resource) => <div key={resource.id} className="border-b border-vow-border py-4 flex gap-4"><div className="w-20 shrink-0">{resource.displayUrl && resource.resource_type === 'image' ? <img src={resource.displayUrl} alt={resource.title || 'Goal reference'} className="w-20 h-20 object-cover border border-vow-border" /> : resource.displayUrl && resource.resource_type === 'video' ? <video src={resource.displayUrl} controls className="w-20 h-20 object-cover border border-vow-border" /> : <div className="w-20 h-20 border border-vow-border flex items-center justify-center text-xs text-vow-muted uppercase">{resource.resource_type}</div>}</div><div className="min-w-0 flex-1"><p className="text-sm text-vow-ink font-medium">{resource.title || resource.url}</p><p className="text-xs text-vow-muted mt-1 capitalize">{resource.resource_type}</p>{resource.displayUrl && resource.resource_type !== 'image' && resource.resource_type !== 'video' && <a href={resource.displayUrl} target="_blank" rel="noreferrer" className="text-xs text-vow-muted hover:text-vow-ink mt-2 inline-flex items-center gap-1"><span className="truncate max-w-md">Open reference</span><Link2 className="w-3 h-3" /></a>}</div></div>)}</div></section>;
}
