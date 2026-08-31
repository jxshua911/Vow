import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ExternalLink, Image as ImageIcon, Instagram, Link as LinkIcon, Trash2, Youtube } from 'lucide-react';

type GoalResource = {
  id: string;
  goal_id: string;
  user_id: string;
  url: string;
  title: string | null;
  resource_type: 'youtube' | 'instagram' | 'image' | 'link';
  created_at: string;
};

type GoalOption = { id: string; outcome: string; status: string };

function inferType(url: string): GoalResource['resource_type'] {
  const value = url.toLowerCase();
  if (/youtube\.com|youtu\.be/.test(value)) return 'youtube';
  if (/instagram\.com/.test(value)) return 'instagram';
  if (/\.(png|jpe?g|webp|gif)(\?.*)?$/.test(value)) return 'image';
  return 'link';
}

function ResourceIcon({ type }: { type: GoalResource['resource_type'] }) {
  if (type === 'youtube') return <Youtube className="w-4 h-4" />;
  if (type === 'instagram') return <Instagram className="w-4 h-4" />;
  if (type === 'image') return <ImageIcon className="w-4 h-4" />;
  return <LinkIcon className="w-4 h-4" />;
}

export function GoalResources() {
  const [goals, setGoals] = useState<GoalOption[]>([]);
  const [goalId, setGoalId] = useState('');
  const [resources, setResources] = useState<GoalResource[]>([]);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function loadGoals() {
    const { data } = await supabase.from('goals').select('id,outcome,status').order('created_at', { ascending: false });
    const nextGoals = (data || []) as GoalOption[];
    setGoals(nextGoals);
    if (!goalId && nextGoals[0]) setGoalId(nextGoals[0].id);
  }

  async function loadResources(nextGoalId: string) {
    if (!nextGoalId) { setResources([]); return; }
    const { data, error: resourceError } = await supabase.from('goal_resources').select('*').eq('goal_id', nextGoalId).order('created_at', { ascending: false });
    if (resourceError) setError('Could not load goal references.');
    else setResources((data || []) as GoalResource[]);
  }

  useEffect(() => { loadGoals().finally(() => setLoading(false)); }, []);
  useEffect(() => { setError(''); loadResources(goalId); }, [goalId]);

  async function addResource() {
    const cleanUrl = url.trim();
    if (!cleanUrl || !goalId || saving) return;
    let parsed: URL;
    try { parsed = new URL(cleanUrl); } catch { setError('Enter a valid link.'); return; }
    if (!['http:', 'https:'].includes(parsed.protocol)) { setError('Only web links can be added.'); return; }
    setSaving(true); setError('');
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { setError('You need to be signed in.'); setSaving(false); return; }
    const { error: insertError } = await supabase.from('goal_resources').insert({ goal_id: goalId, user_id: userData.user.id, url: parsed.toString(), title: title.trim() || null, resource_type: inferType(parsed.toString()) });
    if (insertError) setError('Could not save that reference.');
    else { setUrl(''); setTitle(''); await loadResources(goalId); }
    setSaving(false);
  }

  async function removeResource(id: string) {
    await supabase.from('goal_resources').delete().eq('id', id);
    await loadResources(goalId);
  }

  if (loading) return null;
  if (!goals.length) return null;

  return <section className="border-t border-vow-border pt-10">
    <div className="mb-6">
      <p className="vow-label mb-1">Goal references</p>
      <p className="text-xs text-vow-muted leading-relaxed">Attach a YouTube video, Instagram reference, image, or any useful link to keep the outcome visible and concrete.</p>
    </div>
    <div className="max-w-2xl">
      <label className="vow-label block mb-2">Goal</label>
      <select value={goalId} onChange={(e) => setGoalId(e.target.value)} className="vow-input mb-4">
        {goals.map((goal) => <option key={goal.id} value={goal.id}>{goal.outcome}</option>)}
      </select>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <input value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addResource(); }} className="vow-input" placeholder="Paste a YouTube, Instagram, image, or web link" inputMode="url" />
        <button onClick={addResource} disabled={!url.trim() || saving} className="vow-btn-primary">{saving ? 'Saving…' : 'Add reference'}</button>
      </div>
      <input value={title} onChange={(e) => setTitle(e.target.value)} className="vow-input mt-2" placeholder="Optional label — e.g. target physique, technique, destination" />
      {error && <p className="text-xs text-vow-ink mt-3">{error}</p>}
      {resources.length > 0 && <div className="mt-5 border-t border-vow-border">{resources.map((resource) => <div key={resource.id} className="py-4 border-b border-vow-border flex items-center gap-3"><ResourceIcon type={resource.resource_type} /><div className="min-w-0 flex-1"><a href={resource.url} target="_blank" rel="noreferrer" className="text-sm text-vow-ink hover:opacity-70 inline-flex items-center gap-1 max-w-full"><span className="truncate">{resource.title || resource.url}</span><ExternalLink className="w-3 h-3 flex-shrink-0" /></a><p className="text-xs text-vow-muted capitalize mt-1">{resource.resource_type} reference</p></div><button onClick={() => removeResource(resource.id)} className="text-vow-muted hover:text-vow-ink" aria-label="Remove reference"><Trash2 className="w-4 h-4" /></button></div>)}</div>}
    </div>
  </section>;
}
