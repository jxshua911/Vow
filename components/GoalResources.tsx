import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ExternalLink, Image as ImageIcon, Instagram, Link as LinkIcon, Trash2, Youtube, Video, Upload } from 'lucide-react';

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

type GoalOption = { id: string; outcome: string; status: string };
type PendingLink = { url: string; title: string | null; resource_type: GoalResource['resource_type'] };

function inferType(url: string): GoalResource['resource_type'] {
  const value = url.toLowerCase();
  if (/youtube\.com|youtu\.be/.test(value)) return 'youtube';
  if (/instagram\.com/.test(value)) return 'instagram';
  if (/\.(mp4|webm|mov|m4v)(\?.*)?$/.test(value)) return 'video';
  if (/\.(png|jpe?g|webp|gif)(\?.*)?$/.test(value)) return 'image';
  return 'link';
}

function ResourceIcon({ type }: { type: GoalResource['resource_type'] }) {
  if (type === 'youtube') return <Youtube className="w-4 h-4" />;
  if (type === 'instagram') return <Instagram className="w-4 h-4" />;
  if (type === 'image') return <ImageIcon className="w-4 h-4" />;
  if (type === 'video') return <Video className="w-4 h-4" />;
  return <LinkIcon className="w-4 h-4" />;
}

function isStorageUrl(url: string) { return url.startsWith('storage://'); }

export function GoalResources() {
  const [goals, setGoals] = useState<GoalOption[]>([]);
  const [goalId, setGoalId] = useState('');
  const [resources, setResources] = useState<GoalResource[]>([]);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creatingGoal, setCreatingGoal] = useState(false);
  const [error, setError] = useState('');
  const latestGoalId = useRef<string | null>(null);
  const pendingAttachments = useRef<Array<{ file: File; title: string }>>([]);
  const pendingLinks = useRef<PendingLink[]>([]);

  useEffect(() => {
    const updateCreatingState = () => setCreatingGoal(/\bNew Goal\b/.test(document.body.innerText));
    updateCreatingState();
    const observer = new MutationObserver(updateCreatingState);
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  async function uploadFile(nextGoalId: string, selectedFile: File, resourceTitle: string) {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error('You need to be signed in.');
    if (selectedFile.size > 25 * 1024 * 1024) throw new Error('Attachments must be 25 MB or smaller.');
    const safeName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${userData.user.id}/${nextGoalId}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from('goal-resources').upload(path, selectedFile, { contentType: selectedFile.type, upsert: false });
    if (uploadError) throw uploadError;
    const type = selectedFile.type.startsWith('video/') ? 'video' : 'image';
    const { error: insertError } = await supabase.from('goal_resources').insert({ goal_id: nextGoalId, user_id: userData.user.id, url: `storage://${path}`, title: resourceTitle || selectedFile.name, resource_type: type });
    if (insertError) throw insertError;
  }

  async function attachPendingToGoal(nextGoalId: string) {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const pendingFiles = pendingAttachments.current.splice(0);
    const pendingUrlLinks = pendingLinks.current.splice(0);
    await Promise.all(pendingFiles.map(async (item) => {
      try { await uploadFile(nextGoalId, item.file, item.title); } catch (err) { console.error('[VOW] Failed to attach pending file:', err); }
    }));
    if (pendingUrlLinks.length) {
      await supabase.from('goal_resources').insert(pendingUrlLinks.map((item) => ({ ...item, goal_id: nextGoalId, user_id: userData.user.id })));
    }
  }

  async function loadResources(nextGoalId: string) {
    if (!nextGoalId) { setResources([]); return; }
    const { data, error: resourceError } = await supabase.from('goal_resources').select('*').eq('goal_id', nextGoalId).order('created_at', { ascending: false });
    if (resourceError) { setError('Could not load goal references.'); return; }
    const next = await Promise.all(((data || []) as GoalResource[]).map(async (resource) => ({ ...resource, displayUrl: await signedDisplayUrl(resource.url) })));
    setResources(next);
  }

  async function signedDisplayUrl(urlValue: string) {
    if (!isStorageUrl(urlValue)) return urlValue;
    const path = urlValue.slice('storage://'.length);
    const { data } = await supabase.storage.from('goal-resources').createSignedUrl(path, 60 * 60);
    return data?.signedUrl || '';
  }

  async function loadGoals() {
    const { data } = await supabase.from('goals').select('id,outcome,status,created_at').order('created_at', { ascending: false });
    const nextGoals = (data || []) as GoalOption[];
    const newest = nextGoals[0]?.id || null;
    const justCreated = latestGoalId.current && newest && latestGoalId.current !== newest;
    setGoals(nextGoals);
    if (!goalId && newest) setGoalId(newest);
    if (justCreated && newest && (pendingAttachments.current.length || pendingLinks.current.length)) {
      await attachPendingToGoal(newest);
      await loadResources(newest);
    }
    latestGoalId.current = newest;
  }

  useEffect(() => { loadGoals().finally(() => setLoading(false)); }, []);
  useEffect(() => {
    setError('');
    if (goalId && !creatingGoal) loadResources(goalId);
  }, [goalId, creatingGoal]);
  useEffect(() => {
    if (!creatingGoal && !pendingAttachments.current.length && !pendingLinks.current.length) return;
    const timer = window.setInterval(() => { loadGoals(); }, 1200);
    return () => window.clearInterval(timer);
  }, [creatingGoal]);

  async function addResource() {
    if (saving) return;
    setSaving(true); setError('');
    try {
      if (file) {
        if (creatingGoal) pendingAttachments.current.push({ file, title: title.trim() });
        else if (goalId) await uploadFile(goalId, file, title.trim());
        setFile(null);
      }
      const cleanUrl = url.trim();
      if (cleanUrl) {
        let parsed: URL;
        try { parsed = new URL(cleanUrl); } catch { throw new Error('Enter a valid link.'); }
        if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Only web links can be added.');
        const pendingLink = { url: parsed.toString(), title: title.trim() || null, resource_type: inferType(parsed.toString()) };
        if (creatingGoal) pendingLinks.current.push(pendingLink);
        else {
          const { data: userData } = await supabase.auth.getUser();
          if (!userData.user || !goalId) throw new Error('You need to be signed in and have a goal selected.');
          const { error: insertError } = await supabase.from('goal_resources').insert({ ...pendingLink, goal_id: goalId, user_id: userData.user.id });
          if (insertError) throw insertError;
        }
        setUrl('');
      }
      setTitle('');
      if (goalId && !creatingGoal) await loadResources(goalId);
      if (creatingGoal) setError('Reference saved. VOW will attach it to the new goal as soon as you create it.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that reference.');
    } finally { setSaving(false); }
  }

  async function removeResource(id: string) {
    const resource = resources.find((item) => item.id === id);
    if (resource && isStorageUrl(resource.url)) await supabase.storage.from('goal-resources').remove([resource.url.slice('storage://'.length)]);
    await supabase.from('goal_resources').delete().eq('id', id);
    await loadResources(goalId);
  }

  if (loading) return null;

  return <section className="border-t border-vow-border pt-10">
    <div className="mb-6">
      <p className="vow-label mb-1">Goal references</p>
      <p className="text-xs text-vow-muted leading-relaxed">Attach an image, video, YouTube link, Instagram link, or any useful reference. While you are creating a new goal, VOW holds these references and attaches them to that new goal automatically.</p>
    </div>
    <div className="max-w-2xl">
      {!creatingGoal && goals.length > 0 && <><label className="vow-label block mb-2">Goal</label><select value={goalId} onChange={(e) => setGoalId(e.target.value)} className="vow-input mb-4">{goals.map((goal) => <option key={goal.id} value={goal.id}>{goal.outcome}</option>)}</select></>}
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <input value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addResource(); }} className="vow-input" placeholder="Paste YouTube, Instagram, image, video, or web link" inputMode="url" />
        <button onClick={addResource} disabled={(!url.trim() && !file) || saving} className="vow-btn-primary">{saving ? 'Saving…' : 'Add reference'}</button>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <label className="vow-btn-ghost cursor-pointer"><Upload className="w-4 h-4" />Attach image/video<input type="file" accept="image/*,video/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} /></label>
        {file && <span className="text-xs text-vow-muted truncate">{file.name}</span>}
      </div>
      <input value={title} onChange={(e) => setTitle(e.target.value)} className="vow-input mt-2" placeholder="Optional label — e.g. target physique, technique, destination" />
      {error && <p className="text-xs text-vow-ink mt-3">{error}</p>}
      {resources.length > 0 && <div className="mt-5 border-t border-vow-border">{resources.map((resource) => <div key={resource.id} className="py-4 border-b border-vow-border flex items-center gap-3"><ResourceIcon type={resource.resource_type} /><div className="min-w-0 flex-1">{resource.displayUrl && resource.resource_type === 'image' ? <a href={resource.displayUrl} target="_blank" rel="noreferrer"><img src={resource.displayUrl} alt={resource.title || 'Goal reference'} className="w-20 h-20 object-cover border border-vow-border mb-2" /></a> : resource.displayUrl && resource.resource_type === 'video' ? <video src={resource.displayUrl} controls className="w-full max-h-56 border border-vow-border mb-2" /> : <a href={resource.displayUrl || resource.url} target="_blank" rel="noreferrer" className="text-sm text-vow-ink hover:opacity-70 inline-flex items-center gap-1 max-w-full"><span className="truncate">{resource.title || resource.url}</span><ExternalLink className="w-3 h-3 flex-shrink-0" /></a>}<p className="text-xs text-vow-muted capitalize mt-1">{resource.title || resource.resource_type} · {resource.resource_type} reference</p></div><button onClick={() => removeResource(resource.id)} className="text-vow-muted hover:text-vow-ink" aria-label="Remove reference"><Trash2 className="w-4 h-4" /></button></div>)}</div>}
    </div>
  </section>;
}
