import { useEffect, useState } from 'react';
import { Link2, Trash2 } from 'lucide-react';
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
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function signedDisplayUrl(urlValue: string) {
    if (!urlValue.startsWith('storage://')) return urlValue;
    const { data } = await supabase.storage.from('goal-resources').createSignedUrl(urlValue.slice('storage://'.length), 60 * 60);
    return data?.signedUrl || '';
  }

  async function loadResources() {
    if (!goalId) return;
    const { data, error: resourceError } = await supabase.from('goal_resources').select('*').eq('goal_id', goalId).eq('user_id', (await supabase.auth.getUser()).data.user?.id || '').order('created_at', { ascending: false });
    if (resourceError) { setError('Could not load goal references.'); return; }
    const next = await Promise.all(((data || []) as GoalResource[]).map(async (resource) => ({ ...resource, displayUrl: await signedDisplayUrl(resource.url) })));
    setResources(next);
  }

  useEffect(() => { loadResources().finally(() => setLoading(false)); }, [goalId]);

  async function addResource() {
    if (saving || !goalId || (!url.trim() && !file)) return;
    setSaving(true); setError('');
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('You need to be signed in.');
      if (file) {
        if (file.size > 25 * 1024 * 1024) throw new Error('Attachments must be 25 MB or smaller.');
        if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) throw new Error('Only images and videos can be attached.');
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${userData.user.id}/${goalId}/${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await supabase.storage.from('goal-resources').upload(path, file, { contentType: file.type, upsert: false });
        if (uploadError) throw uploadError;
        const { error: insertError } = await supabase.from('goal_resources').insert({ goal_id: goalId, user_id: userData.user.id, url: `storage://${path}`, title: title.trim() || file.name, resource_type: file.type.startsWith('video/') ? 'video' : 'image' });
        if (insertError) throw insertError;
        setFile(null);
      }
      const cleanUrl = url.trim();
      if (cleanUrl) {
        let parsed: URL;
        try { parsed = new URL(cleanUrl); } catch { throw new Error('Enter a valid link.'); }
        if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Only web links can be added.');
        const { error: insertError } = await supabase.from('goal_resources').insert({ goal_id: goalId, user_id: userData.user.id, url: parsed.toString(), title: title.trim() || null, resource_type: inferType(parsed.toString()) });
        if (insertError) throw insertError;
        setUrl('');
      }
      setTitle('');
      await loadResources();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that reference.');
    } finally { setSaving(false); }
  }

  async function removeResource(id: string) {
    const resource = resources.find((item) => item.id === id);
    if (resource?.url.startsWith('storage://')) await supabase.storage.from('goal-resources').remove([resource.url.slice('storage://'.length)]);
    const { error: deleteError } = await supabase.from('goal_resources').delete().eq('id', id).eq('user_id', (await supabase.auth.getUser()).data.user?.id || '');
    if (deleteError) setError('Could not remove that reference.');
    await loadResources();
  }

  if (loading) return null;

  return <section className="mb-10 border border-vow-border p-5">
    <div className="mb-5">
      <p className="vow-label mb-1">References</p>
      <p className="text-xs text-vow-muted leading-relaxed">Keep links, images and videos attached to this VOW. They stay with the goal instead of becoming a separate workspace.</p>
    </div>
    <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
      <input value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addResource(); }} className="vow-input" placeholder="Paste a useful link" inputMode="url" />
      <button onClick={addResource} disabled={(!url.trim() && !file) || saving} className="vow-btn-primary">{saving ? 'Saving…' : 'Add reference'}</button>
    </div>
    <div className="mt-2 flex items-center gap-3">
      <label className="vow-btn-ghost cursor-pointer"><span className="text-sm" aria-hidden="true">＋</span>Attach image/video<input type="file" accept="image/*,video/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} /></label>
      {file && <span className="text-xs text-vow-muted truncate">{file.name}</span>}
    </div>
    <input value={title} onChange={(e) => setTitle(e.target.value)} className="vow-input mt-2" placeholder="Optional label" />
    {error && <p className="text-xs text-vow-ink mt-3">{error}</p>}
    {resources.length > 0 && <div className="mt-5 border-t border-vow-border">{resources.map((resource) => <div key={resource.id} className="py-4 border-b border-vow-border flex items-center gap-3"><ResourceIcon type={resource.resource_type} /><div className="min-w-0 flex-1">{resource.displayUrl && resource.resource_type === 'image' ? <a href={resource.displayUrl} target="_blank" rel="noreferrer"><img src={resource.displayUrl} alt={resource.title || 'Goal reference'} className="w-20 h-20 object-cover border border-vow-border mb-2" /></a> : resource.displayUrl && resource.resource_type === 'video' ? <video src={resource.displayUrl} controls className="w-full max-h-56 border border-vow-border mb-2" /> : <a href={resource.displayUrl || resource.url} target="_blank" rel="noreferrer" className="text-sm text-vow-ink hover:opacity-70 inline-flex items-center gap-1 max-w-full"><span className="truncate">{resource.title || resource.url}</span><span aria-hidden="true">↗</span></a>}<p className="text-xs text-vow-muted capitalize mt-1">{resource.title || resource.resource_type} · {resource.resource_type}</p></div><button onClick={() => removeResource(resource.id)} className="text-vow-muted hover:text-vow-ink" aria-label="Remove reference"><Trash2 className="w-4 h-4" /></button></div>)}</div>}
  </section>;
}
