import { useEffect, useState } from 'react';
import { ArrowRight, Link2, RotateCcw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { buildGoalContext, buildResourceSearchPlan } from '@/lib/goalContext';
import type { Goal } from '@/types/database';

type GoalResource = { id: string; url: string; title: string | null; resource_type: string; relevance_score: number | null; plan_step: string | null; difficulty: string | null; reason_recommended: string | null; created_at: string };

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
  const [goal, setGoal] = useState<Goal | null>(null);
  const [resources, setResources] = useState<Array<GoalResource & { displayUrl: string }>>([]);
  const [discovering, setDiscovering] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    const [{ data: goalData, error: goalError }, { data, error: resourceError }] = await Promise.all([
      supabase.from('goals').select('*').eq('id', goalId).maybeSingle(),
      supabase.from('goal_resources').select('id,url,title,resource_type,relevance_score,plan_step,difficulty,reason_recommended,created_at').eq('goal_id', goalId).order('relevance_score', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }),
    ]);
    if (goalError || resourceError) { setError('Could not load goal references.'); return; }
    setGoal(goalData as Goal | null);
    const next = await Promise.all(((data || []) as GoalResource[]).map(async (resource) => ({ ...resource, displayUrl: await displayUrl(resource.url) })));
    setResources(next);
  }
  useEffect(() => { let cancelled = false; load().catch(() => { if (!cancelled) setError('Could not load goal references.'); }); return () => { cancelled = true; }; }, [goalId]);

  async function discover() {
    if (!goal || discovering) return;
    setDiscovering(true); setError('');
    try {
      const { data: answers, error: answersError } = await supabase.from('goal_clarification_answers').select('*').eq('goal_id', goalId).order('question_order');
      if (answersError) throw answersError;
      const context = buildGoalContext(goal, answers || []);
      const { data, error: invokeError } = await supabase.functions.invoke('vow-goal-resources', { body: { goal_id: goalId, goal_context: context, resource_search: buildResourceSearchPlan(context) } });
      if (invokeError) throw invokeError;
      if (data?.fallback) setError(data.message || 'No strong resources were found.');
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not discover resources right now.'); }
    finally { setDiscovering(false); }
  }

  return <section className="mb-10">
    <div className="flex items-start justify-between gap-4 mb-4"><div><h2 className="vow-label">Goal references</h2><p className="text-xs text-vow-muted mt-1">VOW ranks resources for this exact goal and plan context.</p></div><button onClick={discover} disabled={!goal || discovering} className="vow-btn-ghost text-xs shrink-0 flex items-center gap-1"><RotateCcw className={`w-3 h-3 ${discovering ? 'animate-spin' : ''}`} />{discovering ? 'Searching...' : resources.length ? 'Refresh resources' : 'Find resources'}</button></div>
    {error && <p className="text-xs text-vow-muted border-l border-vow-border pl-3 mb-4">{error}</p>}
    {!resources.length ? <div className="border border-vow-border p-5 text-sm text-vow-muted">No resources attached yet. VOW can search specifically for this goal without changing your plan.</div> : <div className="border-t border-vow-border">
      {resources.map((resource) => {
        const videoId = resource.displayUrl ? youtubeId(resource.displayUrl) : null;
        const score = resource.relevance_score == null ? null : Math.round(resource.relevance_score * 100);
        return <div key={resource.id} className="border-b border-vow-border py-5">
          {videoId ? <div className="aspect-video w-full bg-black mb-4"><iframe title={resource.title || 'YouTube video'} src={`https://www.youtube-nocookie.com/embed/${videoId}`} className="w-full h-full" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /></div> : resource.displayUrl && resource.resource_type === 'image' ? <img src={resource.displayUrl} alt={resource.title || 'Goal reference'} className="w-full max-h-96 object-cover border border-vow-border mb-4" /> : resource.displayUrl && resource.resource_type === 'video' ? <video src={resource.displayUrl} controls className="w-full max-h-96 border border-vow-border mb-4" /> : null}
          <div className="flex gap-4"><div className="w-16 h-16 border border-vow-border flex items-center justify-center text-xs text-vow-muted uppercase shrink-0">{videoId ? 'YT' : resource.resource_type}</div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><p className="text-sm text-vow-ink font-medium">{resource.title || resource.url}</p>{score != null && <span className="text-[10px] text-vow-muted shrink-0">{score}% relevant</span>}</div>{resource.plan_step && <p className="text-xs text-vow-muted mt-1">For: {resource.plan_step}</p>}{resource.difficulty && <p className="text-[10px] text-vow-muted mt-1 capitalize">Level: {resource.difficulty}</p>}{resource.reason_recommended && <p className="text-xs text-vow-muted mt-2 leading-relaxed">{resource.reason_recommended}</p>}{resource.displayUrl && <a href={resource.displayUrl} target="_blank" rel="noreferrer" className="text-xs text-vow-muted hover:text-vow-ink mt-2 inline-flex items-center gap-1"><span>{videoId ? 'Watch on YouTube' : 'Open reference'}</span>{videoId ? <ArrowRight className="w-3 h-3" /> : <Link2 className="w-3 h-3" />}</a>}</div></div>
        </div>;
      })}
    </div>}
  </section>;
}
