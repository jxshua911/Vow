import { useEffect, useState } from 'react';
import { ExternalLink, Link2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type GoalResource = { id: string; url: string; title: string | null; resource_type: string; created_at: string };

async function displayUrl(url: string) {
  if (!url.startsWith('storage://')) return url;
  const { data } = await supabase.storage.from('goal-resources').createSignedUrl(url.slice('storage://'.length), 60 * 60);
  return data?.signedUrl || '';
}

function youtubeId(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'youtu.be') return parsed.pathname.slice(1).split('/')[0] || null;
    if (parsed.hostname.endsWith('youtube.com')) {
      if (parsed.pathname === '/watch') return parsed.searchParams.get('v');
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parts[0] === 'shorts' || parts[0] === 'embed') return parts[1] || null;
    }
  } catch { return null; }
  return null;
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
  return <section className="mb-10">
    <div className="flex items-center justify-between mb-4"><div><h2 className="vow-label">Goal references</h2><p className="text-xs text-vow-muted mt-1">References attached to this VOW.</p></div></div>
    <div className="border-t border-vow-border">
      {resources.map((resource) => {
        const videoId = resource.displayUrl ? youtubeId(resource.displayUrl) : null;
        return <div key={resource.id} className="border-b border-vow-border py-5">
          {videoId ? <div className="aspect-video w-full bg-black mb-4"><iframe title={resource.title || 'YouTube video'} src={`https://www.youtube-nocookie.com/embed/${videoId}`} className="w-full h-full" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /></div> : resource.displayUrl && resource.resource_type === 'image' ? <img src={resource.displayUrl} alt={resource.title || 'Goal reference'} className="w-full max-h-96 object-cover border border-vow-border mb-4" /> : resource.displayUrl && resource.resource_type === 'video' ? <video src={resource.displayUrl} controls className="w-full max-h-96 border border-vow-border mb-4" /> : null}
          <div className="flex gap-4">
            <div className="w-16 h-16 border border-vow-border flex items-center justify-center text-xs text-vow-muted uppercase shrink-0">{videoId ? 'YT' : resource.resource_type}</div>
            <div className="min-w-0 flex-1"><p className="text-sm text-vow-ink font-medium">{resource.title || resource.url}</p><p className="text-xs text-vow-muted mt-1 capitalize">{videoId ? 'YouTube video · watchable inside VOW' : resource.resource_type}</p>
              {resource.displayUrl && <a href={resource.displayUrl} target="_blank" rel="noreferrer" className="text-xs text-vow-muted hover:text-vow-ink mt-2 inline-flex items-center gap-1"><span>{videoId ? 'Watch on YouTube' : 'Open reference'}</span>{videoId ? <ExternalLink className="w-3 h-3" /> : <Link2 className="w-3 h-3" />}</a>}
            </div>
          </div>
        </div>;
      })}
    </div>
  </section>;
}
