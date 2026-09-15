import { useEffect, useState } from 'react';
import { Link2, Trash2 } from '@/lib/ui-icons';
import { supabase } from '@/lib/supabase';

type GoalResource = {
  id: string;
  goal_id: string;
  user_id: string;
  url: string;
  title: string | null;
  resource_type: 'youtube' | 'instagram' | 'image' | 'video' | 'link';
  created_at: string;
  displayUrl?: string;
};

function inferType(url: string): GoalResource['resource_type'] {
  const value = url.toLowerCase();
  if (/youtube\.com|youtu\.be/.test(value)) return 'youtube';
  if (/instagram\.com/.test(value)) return 'instagram';
  if (/\.(mp4|webm|mov|m4v)(\?.*)?$/.test(value)) return 'video';
  if (/\.(png|jpe?g|webp|gif)(\?.*)?$/.test(value)) return 'image';
  return 'link';
}

function ResourceIcon({ type }: { type: GoalResource['resource_type'] }) {
  const label = type === 'youtube' ? 'YT' : type === 'instagram' ? 'IG' : type === 'image' ? 'IMG' : type === 'video' ? 'VID' : null;
  if (label) return <span className="w-4 h-4 inline-flex items-center justify-center text-[9px] font-semibold leading-none" aria-hidden="true">{label}</span>;
  return <Link2 className="w-4 h-4" />;
}

export function GoalResources({ goalId }: { goalId: string }) {
  const [resources, setResources] = useState<Array<GoalResource & { displayUrl: string }>>([]);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function signedDisplayUrl(urlValue: string) {
    if (!urlValue.startsWith('storage://')) return urlValue;
    const { data } = await supabase.storage.from('goal-resources').createSignedUrl(urlValue.slice('storage://'.length), 60 * 60);
    return data?.signedUrl || '';
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    supabase.from('goal_resources').select('id,goal_id,user_id,url,title,resource_type,created_at').eq('goal_id', goalId).order('created_at', { ascending: true }).then(async ({ data, error: loadError }) => {
      if (cancelled) return;
      if (loadError) {
        setError('Could not load references for this goal.');
        setResources([]);
        setLoading(false);
        return;
      }
      const next = await Promise.all(((data || []) as GoalResource[]).map(async (resource) => ({ ...resource, displayUrl: await signedDisplayUrl(resource.url) })));
      if (!cancelled) { setResources(next); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [goalId]);

  async function addResource() {
    const cleanUrl = url.trim();
    const cleanTitle = title.trim();
    if (!cleanUrl || saving) return;
    if (!/^https?:\/\/\S+\.\S+/i.test(cleanUrl)) {
      setError('Enter a valid link starting with http:// or https://');
      return;
    }
    if (cleanUrl.length > 2048) {
      setError('That link is too long (maximum 2048 characters).');
      return;
    }
    setSaving(true);
    setError('');
    const { data, error: insertError } = await supabase.from('goal_resources').insert({ goal_id: goalId, url: cleanUrl, title: cleanTitle || null, resource_type: inferType(cleanUrl) }).select('id,goal_id,user_id,url,title,resource_type,created_at').single();
    if (insertError || !data) {
      setError(insertError?.message || 'Could not save that reference. Please try again.');
      setSaving(false);
      return;
    }
    const display = await signedDisplayUrl(data.url);
    setResources((current) => [...current, { ...(data as GoalResource), displayUrl: display }]);
    setUrl('');
    setTitle('');
    setSaving(false);
  }

  async function removeResource(id: string) {
    setError('');
    const { error: deleteError } = await supabase.from('goal_resources').delete().eq('id', id);
    if (deleteError) {
      setError('Could not remove that reference. Please try again.');
      return;
    }
    setResources((current) => current.filter((resource) => resource.id !== id));
  }

  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="vow-label">Goal references</h2>
          <p className="text-xs text-vow-muted mt-1">Links VOW uses as evidence of your intended outcome.</p>
        </div>
      </div>
      <div className="border border-vow-border p-4 mb-4 space-y-3">
        <input
          value={url}
          onChange={(e) => { setUrl(e.target.value); if (error) setError(''); }}
          maxLength={2048}
          inputMode="url"
          placeholder="https://example.com/your-reference"
          className="vow-input"
          aria-label="Reference URL"
        />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          placeholder="Title (optional)"
          className="vow-input"
          aria-label="Reference title"
        />
        {error && <p className="text-sm text-vow-ink border-l-2 border-vow-ink pl-3">{error}</p>}
        <button type="button" onClick={addResource} disabled={!url.trim() || saving} className="vow-btn-soft text-xs disabled:opacity-50">
          {saving ? 'Saving…' : 'Add reference'}
        </button>
      </div>
      {loading ? (
        <div className="text-vow-muted text-sm">Loading references…</div>
      ) : resources.length === 0 ? (
        <div className="border border-vow-border p-6 text-center">
          <p className="text-vow-muted text-sm">No references yet. Add a link to help VOW tailor your plan.</p>
        </div>
      ) : (
        <div className="border-t border-vow-border">
          {resources.map((resource) => (
            <div key={resource.id} className="border-b border-vow-border py-4 flex items-start gap-4">
              <div className="w-14 shrink-0 flex items-center justify-center">
                {resource.displayUrl && resource.resource_type === 'image'
                  ? <img src={resource.displayUrl} alt={resource.title || 'Goal reference'} className="w-14 h-14 object-cover border border-vow-border" />
                  : <div className="w-14 h-14 border border-vow-border flex items-center justify-center"><ResourceIcon type={resource.resource_type} /></div>}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-vow-ink font-medium truncate">{resource.title || resource.url}</p>
                <p className="text-xs text-vow-muted mt-1 capitalize">{resource.resource_type}</p>
                {resource.displayUrl && (
                  <a href={resource.displayUrl} target="_blank" rel="noreferrer" className="text-xs text-vow-muted hover:text-vow-ink mt-1 inline-flex items-center gap-1">
                    <span className="truncate max-w-[220px] sm:max-w-md">Open reference</span>
                    <Link2 className="w-3 h-3" />
                  </a>
                )}
              </div>
              <button type="button" onClick={() => removeResource(resource.id)} className="text-xs text-vow-muted hover:text-vow-ink disabled:opacity-50 flex-shrink-0" aria-label={`Remove reference ${resource.title || resource.url}`}>
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
