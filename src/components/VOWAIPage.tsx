import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Goal } from '@/types/database';
import { PageHeader } from './AppShell';
import { GoalAI } from './GoalAI';

function readCachedGoals(userId: string): Goal[] {
  try {
    const raw = localStorage.getItem(`vow:offline-goals:${userId}`);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as Goal[] : [];
  } catch {
    return [];
  }
}

export function VOWAIPage() {
  const { session } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [selectedGoalId, setSelectedGoalId] = useState('');
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine);
  const [loadNotice, setLoadNotice] = useState('');

  const loadGoals = useCallback(async () => {
    if (!session) {
      setGoals([]);
      setLoading(false);
      return;
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const cached = readCachedGoals(session.user.id);
      setGoals(cached);
      setSelectedGoalId((current) => current || cached[0]?.id || '');
      setLoadNotice(cached.length ? 'Showing goals saved on this device. AI consultation is available when you reconnect.' : 'You are offline and no goals have been saved on this device yet.');
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.from('goals').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false });
    if (data && !error) {
      const nextGoals = data as Goal[];
      setGoals(nextGoals);
      setSelectedGoalId((current) => nextGoals.some((goal) => goal.id === current) ? current : (nextGoals[0]?.id || ''));
      try { localStorage.setItem(`vow:offline-goals:${session.user.id}`, JSON.stringify(nextGoals)); } catch { /* Device storage is best-effort. */ }
      setLoadNotice('');
    } else {
      const cached = readCachedGoals(session.user.id);
      setGoals(cached);
      setSelectedGoalId((current) => current || cached[0]?.id || '');
      setLoadNotice(cached.length ? 'Could not refresh from VOW. Showing the goals saved on this device.' : 'Could not load your goals. Please check your connection and try again.');
    }
    setLoading(false);
  }, [session]);

  useEffect(() => {
    const onOnline = () => { setOnline(true); void loadGoals(); };
    const onOffline = () => {
      setOnline(false);
      if (session) {
        const cached = readCachedGoals(session.user.id);
        setGoals(cached);
        setSelectedGoalId((current) => current || cached[0]?.id || '');
        setLoadNotice(cached.length ? 'Offline mode: these are the goals saved on this device. VOW AI consultation requires internet.' : 'Offline mode: connect once to load and save your goals on this device.');
      }
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [loadGoals, session]);

  useEffect(() => { void loadGoals(); }, [loadGoals]);

  const selectedGoal = goals.find((goal) => goal.id === selectedGoalId) || null;
  const savedPlan = selectedGoal?.plan_json && typeof selectedGoal.plan_json === 'object' ? selectedGoal.plan_json : null;
  const planSummary = typeof savedPlan?.summary === 'string' ? savedPlan.summary : '';
  const successMetric = typeof savedPlan?.success_metric === 'string' ? savedPlan.success_metric : '';
  const savedSchedule = Array.isArray(savedPlan?.schedule)
    ? (savedPlan.schedule as Array<Record<string, unknown>>).slice(0, 5)
    : [];

  return (
    <div>
      <PageHeader title="VOW AI" subtitle="Consult on your goals, pressure-test your plan, and decide what to do next." />
      <div className="border border-vow-border p-5 mb-8">
        <div className="flex items-center justify-between gap-3 mb-2">
          <p className="vow-label">Planning consultant</p>
          <span className="text-xs text-vow-muted">{online ? 'Online' : 'Offline · saved data only'}</span>
        </div>
        <p className="text-sm text-vow-ink leading-relaxed">Ask about your current plan, missed sessions, trade-offs, obstacles, or how to adapt when your circumstances change. VOW AI uses your selected goal and upcoming calendar context when connected.</p>
        {!online && <p className="text-xs text-vow-muted mt-3">AI responses and plan generation require an internet connection. Your saved goals can still be reviewed here.</p>}
      </div>

      {loadNotice && <p className="text-xs text-vow-muted border-l-2 border-vow-border pl-3 mb-6" role="status">{loadNotice}</p>}

      <section className="mb-8">
        <label htmlFor="vow-ai-goal" className="vow-label block mb-2">Consult about a goal</label>
        {loading ? <p className="text-sm text-vow-muted">Loading your goals…</p> : goals.length === 0 ? (
          <p className="text-sm text-vow-muted border border-vow-border p-4">No saved goals to select yet. You can still ask VOW AI a general planning question when online.</p>
        ) : (
          <select id="vow-ai-goal" value={selectedGoalId} onChange={(event) => setSelectedGoalId(event.target.value)} className="w-full border border-vow-border bg-vow-bg text-vow-ink px-3 py-3 text-sm">
            {goals.map((goal) => <option key={goal.id} value={goal.id}>{goal.outcome || goal.title}</option>)}
          </select>
        )}
        {selectedGoal && (
          <div className="border border-vow-border border-t-0 p-4">
            <p className="text-sm text-vow-ink">{selectedGoal.outcome || selectedGoal.title}</p>
            <p className="text-xs text-vow-muted mt-1">Status: {selectedGoal.status}{selectedGoal.deadline ? ` · Target date: ${selectedGoal.deadline}` : ''}</p>
            {selectedGoal.why_it_matters && <p className="text-xs text-vow-muted mt-3">{selectedGoal.why_it_matters}</p>}
            {(planSummary || successMetric || savedSchedule.length > 0) && (
              <div className="mt-4 pt-4 border-t border-vow-border">
                <p className="vow-label mb-2">Saved plan</p>
                {planSummary && <p className="text-sm text-vow-ink leading-relaxed">{planSummary}</p>}
                {successMetric && <p className="text-xs text-vow-muted mt-2">Success measure: {successMetric}</p>}
                {savedSchedule.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {savedSchedule.map((item, index) => (
                      <div key={index} className="border-l border-vow-border pl-3 py-1">
                        <p className="text-sm text-vow-ink">{typeof item.task === 'string' ? item.task : 'Planned action'}</p>
                        <p className="text-xs text-vow-muted mt-1">
                          {[typeof item.day === 'string' ? item.day : '', typeof item.preferred_time === 'string' ? item.preferred_time : '', typeof item.duration_minutes === 'number' ? `${item.duration_minutes} min` : ''].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {online ? <GoalAI goal={selectedGoal} /> : (
        <div className="border border-vow-border p-5">
          <p className="text-sm text-vow-ink mb-1">VOW AI consultation is paused while offline</p>
          <p className="text-xs text-vow-muted">Your saved goal information above remains available. Reconnect to ask questions, adapt a plan, or generate new steps.</p>
        </div>
      )}
    </div>
  );
}
