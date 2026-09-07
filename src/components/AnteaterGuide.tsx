type Demonstration = { kind?: 'video' | 'image' | 'none'; title?: string; query?: string; image_prompt?: string; source_url?: string; source_title?: string };
type Alternative = { constraint?: string; task?: string; equipment?: string[]; instructions?: string };
type ExecutionSession = { activity_type?: string; equipment?: string[]; instructions?: string[]; form_cues?: string[]; alternatives?: Alternative[]; demonstration?: Demonstration | null };
type GoalLike = { outcome?: string; title?: string; armadillo?: { category?: string; goal_type?: string } | null; plan_json?: { session_templates?: ExecutionSession[]; schedule?: ExecutionSession[] } | null };
type AnteaterGuideProps = { goal?: GoalLike; session?: ExecutionSession };

function embedUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (!['https:', 'http:'].includes(parsed.protocol)) return null;
    const host = parsed.hostname.toLowerCase();
    if (host === 'youtu.be') {
      const id = parsed.pathname.replace(/^\//, '').split('/')[0];
      return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : null;
    }
    if (host.endsWith('youtube.com')) {
      const id = parsed.searchParams.get('v') || parsed.pathname.match(/\/(?:shorts|live|embed)\/([^/?]+)/)?.[1];
      return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : null;
    }
    if (host.endsWith('vimeo.com')) {
      const id = parsed.pathname.match(/\/(\d+)(?:$|\/)/)?.[1];
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
  } catch (error) {
    console.warn('[VOW] Invalid demonstration URL.', error);
  }
  return null;
}

function youtubeSearchUrl(query: string) { return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`; }

function serviceLink(activityType: string | undefined, goalText: string) {
  const value = `${activityType || ''} ${goalText}`.toLowerCase();
  if (/read|reading|book|literature|novel|study/.test(value)) return { name: 'Kindle', prompt: 'Want to use Kindle for this?', url: 'https://www.amazon.com/kindle/' };
  if (/run|running|cycle|cycling|bike|swim|football|training|fitness|workout|endurance/.test(value)) return { name: 'Strava', prompt: 'Want to track this on Strava?', url: 'https://www.strava.com/' };
  return null;
}

function executionFromGoal(goal: GoalLike): ExecutionSession {
  const plan = goal.plan_json || {};
  const candidate = Array.isArray(plan.session_templates) ? plan.session_templates[0] : Array.isArray(plan.schedule) ? plan.schedule[0] : undefined;
  const goalText = `${goal.outcome || goal.title || ''} ${goal.armadillo?.category || ''} ${goal.armadillo?.goal_type || ''}`.trim();
  if (candidate) return { ...candidate, activity_type: candidate.activity_type || goal.armadillo?.goal_type || 'Goal-specific practice' };
  const lower = goalText.toLowerCase();
  const activityType = /read|reading|book|literature|novel/.test(lower) ? 'Reading practice' : /run|running|cycle|cycling|bike|swim|football|fitness|workout/.test(lower) ? 'Training' : 'Goal-specific practice';
  return { activity_type: activityType, demonstration: { kind: 'video', title: `${activityType} demonstration`, query: `${goalText} tutorial demonstration` } };
}

export function AnteaterGuide({ goal, session: suppliedSession }: AnteaterGuideProps) {
  const session = suppliedSession || (goal ? executionFromGoal(goal) : {});
  const goalText = `${goal?.outcome || goal?.title || ''} ${goal?.armadillo?.category || ''} ${goal?.armadillo?.goal_type || ''}`.trim();
  const demo = session.demonstration || null;
  const video = demo?.source_url ? embedUrl(demo.source_url) : null;
  const instructions = Array.isArray(session.instructions) ? session.instructions : [];
  const equipment = Array.isArray(session.equipment) ? session.equipment : [];
  const cues = Array.isArray(session.form_cues) ? session.form_cues : [];
  const alternatives = Array.isArray(session.alternatives) ? session.alternatives : [];
  const service = serviceLink(session.activity_type, goalText);
  const query = demo?.query || `${goalText || session.activity_type || 'goal'} tutorial demonstration`;
  const hasGuide = instructions.length || equipment.length || cues.length || alternatives.length || demo || service;
  if (!hasGuide) return null;

  return (
    <div className="mt-4 border border-vow-border bg-vow-paper/40 p-4 space-y-4">
      <div><p className="vow-label">Session guide</p>{session.activity_type && <p className="text-sm text-vow-ink mt-1">{session.activity_type}</p>}</div>
      {equipment.length > 0 && <div><p className="text-xs font-medium text-vow-ink mb-2">Setup</p><ul className="space-y-1">{equipment.map((item, index) => <li key={`${item}-${index}`} className="text-xs text-vow-muted">• {item}</li>)}</ul></div>}
      {instructions.length > 0 && <div><p className="text-xs font-medium text-vow-ink mb-2">How to do it</p><ol className="space-y-2">{instructions.map((step, index) => <li key={`${step}-${index}`} className="flex gap-3 text-xs text-vow-muted"><span className="text-vow-ink font-medium">{index + 1}.</span><span>{step}</span></li>)}</ol></div>}
      {cues.length > 0 && <div><p className="text-xs font-medium text-vow-ink mb-2">Quality cues</p><ul className="space-y-1">{cues.map((cue, index) => <li key={`${cue}-${index}`} className="text-xs text-vow-muted">• {cue}</li>)}</ul></div>}
      {alternatives.length > 0 && <div><p className="text-xs font-medium text-vow-ink mb-2">If your setup is different</p><ul className="space-y-2">{alternatives.map((alternative, index) => <li key={`${alternative.constraint || alternative.task || index}-${index}`} className="text-xs text-vow-muted">{alternative.constraint && <span className="font-medium text-vow-ink">{alternative.constraint}: </span>}{alternative.task || alternative.instructions || 'Alternative session'}{alternative.equipment?.length ? ` (${alternative.equipment.join(', ')})` : ''}</li>)}</ul></div>}
      {video && <div><p className="text-xs font-medium text-vow-ink mb-2">Demonstration</p><div className="aspect-video overflow-hidden border border-vow-border bg-black"><iframe src={video} title={demo?.source_title || demo?.title || 'Session demonstration'} className="h-full w-full" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /></div><p className="text-xs text-vow-muted mt-2">{demo?.source_title || demo?.title}</p></div>}
      {!video && demo?.kind === 'video' && <div className="border-l-2 border-vow-border pl-3"><p className="text-xs font-medium text-vow-ink">YouTube demonstration</p><p className="text-xs text-vow-muted mt-1">A goal-specific demonstration search is ready for this session.</p><a href={youtubeSearchUrl(query)} target="_blank" rel="noreferrer" className="vow-btn-soft inline-flex mt-3 min-h-10">Find the best YouTube match →</a></div>}
      {demo?.kind === 'image' && <div className="border-l-2 border-vow-border pl-3"><p className="text-xs font-medium text-vow-ink">Visual demonstration</p><p className="text-xs text-vow-muted mt-1">A visual demonstration was identified as the best fit for this session.</p></div>}
      {service && <div className="border-t border-vow-border pt-4 flex items-center justify-between gap-4"><div className="min-w-0"><p className="text-xs font-medium text-vow-ink">{service.name}</p><p className="text-xs text-vow-muted mt-1">{service.prompt}</p></div><a href={service.url} target="_blank" rel="noreferrer" className="vow-btn-soft shrink-0 min-h-10">Open {service.name} →</a></div>}
    </div>
  );
}
