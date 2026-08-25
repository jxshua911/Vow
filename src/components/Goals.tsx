import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Goal, Milestone, Session, GoalStatus } from '@/types/database';
import { decomposeGoal, type DecomposedGoal } from '@/lib/decompose';
import { addDays, toDateString, formatTime, formatDate, formatRelative, nextSessionSlot } from '@/lib/dates';
import { PageHeader, NewButton } from './AppShell';
import {
  Lock, Plus, X, Check, Circle, CheckCircle2, SkipForward, Move,
  Flag, Pause, AlertTriangle, ChevronDown, ChevronUp, ArrowLeft, Calendar, Clock
} from 'lucide-react';

export function GoalsPage() {
  const { session } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadGoals = useCallback(async () => {
    if (!session) return;
    const { data } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });
    setGoals(data || []);
    setLoading(false);
  }, [session]);

  useEffect(() => { loadGoals(); }, [loadGoals]);

  if (selectedGoalId) {
    return (
      <GoalDetail
        goalId={selectedGoalId}
        onBack={() => { setSelectedGoalId(null); loadGoals(); }}
      />
    );
  }

  if (showCreate) {
    return (
      <CreateGoal
        userId={session!.user.id}
        onCreated={() => { setShowCreate(false); loadGoals(); }}
        onCancel={() => setShowCreate(false)}
      />
    );
  }

  const activeGoals = goals.filter((g) => g.status === 'active' || g.status === 'locked');
  const draftGoals = goals.filter((g) => g.status === 'draft');
  const completedGoals = goals.filter((g) => g.status === 'completed' || g.status === 'abandoned');

  return (
    <div>
      <PageHeader
        title="Goals"
        subtitle="Lock in commitments. Track honestly. Adjust when the plan is wrong."
        action={<NewButton onClick={() => setShowCreate(true)} label="New goal" />}
      />

      {loading ? (
        <div className="text-vow-muted text-sm">Loading...</div>
      ) : goals.length === 0 ? (
        <div className="border border-vow-border p-16 text-center">
          <p className="vow-heading text-xl text-vow-ink mb-2">No goals yet</p>
          <p className="text-vow-muted text-sm mb-6">Create your first goal and lock in a commitment.</p>
          <NewButton onClick={() => setShowCreate(true)} label="Create goal" />
        </div>
      ) : (
        <div className="space-y-12">
          {activeGoals.length > 0 && (
            <GoalSection title="Active" goals={activeGoals} onSelect={setSelectedGoalId} />
          )}
          {draftGoals.length > 0 && (
            <GoalSection title="Drafts" goals={draftGoals} onSelect={setSelectedGoalId} />
          )}
          {completedGoals.length > 0 && (
            <GoalSection title="Completed & Abandoned" goals={completedGoals} onSelect={setSelectedGoalId} />
          )}
        </div>
      )}
    </div>
  );
}

function GoalSection({ title, goals, onSelect }: { title: string; goals: Goal[]; onSelect: (id: string) => void }) {
  const statusColors: Record<GoalStatus, string> = {
    draft: 'text-vow-muted',
    locked: 'text-vow-ink',
    active: 'text-vow-ink',
    completed: 'text-vow-success',
    abandoned: 'text-vow-muted line-through',
  };

  return (
    <div>
      <h2 className="vow-label mb-4">{title}</h2>
      <div className="border-t border-vow-border">
        {goals.map((g) => (
          <button
            key={g.id}
            onClick={() => onSelect(g.id)}
            className="w-full text-left border-b border-vow-border py-5 group flex items-start justify-between gap-4 hover:opacity-70 transition-opacity"
          >
            <div className="flex-1 min-w-0">
              <div className={`text-base font-medium mb-1 ${statusColors[g.status]}`}>{g.outcome}</div>
              {g.why_it_matters && (
                <div className="text-xs text-vow-muted italic mb-2">"{g.why_it_matters}"</div>
              )}
              <div className="flex items-center gap-4 text-xs text-vow-muted">
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{g.deadline ? formatRelative(g.deadline) : 'No deadline'}</span>
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{g.weekly_commitment_target}x/week</span>
              </div>
            </div>
            <ArrowLeft className="w-4 h-4 text-vow-border rotate-180 mt-1 group-hover:text-vow-ink transition-colors" />
          </button>
        ))}
      </div>
    </div>
  );
}

function CreateGoal({ userId, onCreated, onCancel }: { userId: string; onCreated: () => void; onCancel: () => void }) {
  const [rawInput, setRawInput] = useState('');
  const [decomposed, setDecomposed] = useState<DecomposedGoal | null>(null);
  const [whyItMatters, setWhyItMatters] = useState('');
  const [weeklyTarget, setWeeklyTarget] = useState(3);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!decomposed) return;
    setSaving(true);
    setError(null);
    try {
      const { data: goalData, error: goalErr } = await supabase
        .from('goals')
        .insert({
          user_id: userId,
          title: decomposed.outcome,
          outcome: decomposed.outcome,
          why_it_matters: whyItMatters || null,
          deadline: decomposed.deadline,
          status: 'active',
          weekly_commitment_target: weeklyTarget,
        })
        .select()
        .single();
      if (goalErr) throw goalErr;

      const milestoneRows = decomposed.milestones.map((m, i) => ({
        goal_id: goalData.id,
        title: m.title,
        description: m.description,
        sort_order: i,
        deadline: toDateString(addDays(new Date(), m.weeksOut * 7)),
        status: i === 0 ? 'in_progress' : 'pending' as const,
      }));
      await supabase.from('milestones').insert(milestoneRows);

      const sessions = [];
      for (let i = 0; i < weeklyTarget; i++) {
        const sessionDate = nextSessionSlot(null, addDays(new Date(), i + 1));
        sessions.push({
          goal_id: goalData.id,
          milestone_id: null,
          user_id: userId,
          title: decomposed.milestones[0].title,
          scheduled_at: sessionDate.toISOString(),
          duration_minutes: decomposed.suggestedSessionDuration,
          status: 'scheduled',
        });
      }
      await supabase.from('sessions').insert(sessions);

      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create goal.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="New goal" subtitle="Describe what you want. We will decompose it into a plan." />
      <div className="max-w-xl">
        {!decomposed ? (
          <>
            <textarea
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              rows={3}
              className="vow-input resize-none mb-4"
              placeholder="e.g. I want to get better at running"
              autoFocus
            />
            <div className="flex gap-3">
              <button onClick={onCancel} className="vow-btn-ghost">Cancel</button>
              <button
                onClick={() => setDecomposed(decomposeGoal(rawInput))}
                disabled={!rawInput.trim()}
                className="vow-btn-primary flex-1"
              >
                Decompose
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="border-t border-vow-border pt-4 mb-6">
              <p className="vow-label mb-1">Outcome</p>
              <p className="text-vow-ink font-medium">{decomposed.outcome}</p>
            </div>

            <div className="border-t border-vow-border pt-4 mb-6">
              <p className="vow-label mb-4">Milestones</p>
              <div className="space-y-4">
                {decomposed.milestones.map((m, i) => (
                  <div key={i} className="flex gap-4">
                    <span className="text-vow-muted text-sm font-mono pt-0.5">{String(i + 1).padStart(2, '0')}</span>
                    <div>
                      <p className="text-sm text-vow-ink font-medium">{m.title}</p>
                      <p className="text-xs text-vow-muted mt-1">{m.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <label className="vow-label block mb-2">Sessions per week</label>
              <input
                type="number"
                min={1}
                max={14}
                value={weeklyTarget}
                onChange={(e) => setWeeklyTarget(parseInt(e.target.value) || 1)}
                className="vow-input"
              />
            </div>

            <div className="mb-6">
              <label className="vow-label block mb-2">Why does this matter to you?</label>
              <textarea
                value={whyItMatters}
                onChange={(e) => setWhyItMatters(e.target.value)}
                rows={2}
                className="vow-input resize-none"
                placeholder="Your coach will reference this when motivation dips."
              />
            </div>

            {error && (
              <p className="text-sm text-vow-ink mb-4" style={{ borderLeft: '2px solid #111', paddingLeft: '0.75rem' }}>
                {error}
              </p>
            )}

            <div className="flex gap-3">
              <button onClick={() => setDecomposed(null)} className="vow-btn-ghost">Back</button>
              <button onClick={handleCreate} disabled={saving} className="vow-btn-primary flex-1">
                <Lock className="w-4 h-4" />
                {saving ? 'Creating...' : 'Lock in goal'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function GoalDetail({ goalId, onBack }: { goalId: string; onBack: () => void }) {
  const { session } = useAuth();
  const [goal, setGoal] = useState<Goal | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddSession, setShowAddSession] = useState(false);
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [expandedMilestone, setExpandedMilestone] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [goalRes, msRes, sessRes] = await Promise.all([
      supabase.from('goals').select('*').eq('id', goalId).maybeSingle(),
      supabase.from('milestones').select('*').eq('goal_id', goalId).order('sort_order'),
      supabase.from('sessions').select('*').eq('goal_id', goalId).order('scheduled_at', { ascending: true }),
    ]);
    setGoal(goalRes.data as Goal | null);
    setMilestones(msRes.data || []);
    setSessions(sessRes.data || []);
    setLoading(false);
  }, [goalId]);

  useEffect(() => { load(); }, [load]);

  async function updateSessionStatus(sessId: string, status: Session['status']) {
    const updates: Partial<Session> = { status, updated_at: new Date().toISOString() };
    if (status === 'completed') updates.completed_at = new Date().toISOString();
    await supabase.from('sessions').update(updates).eq('id', sessId);
    load();
  }

  async function moveSession(sess: Session) {
    const newDate = addDays(new Date(sess.scheduled_at), 1);
    await supabase.from('sessions').update({
      scheduled_at: newDate.toISOString(),
      moved_count: sess.moved_count + 1,
      status: 'moved',
      updated_at: new Date().toISOString(),
    }).eq('id', sess.id);
    load();
  }

  async function toggleMilestoneStatus(ms: Milestone) {
    const newStatus = ms.status === 'completed' ? 'pending' : 'completed';
    await supabase.from('milestones').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', ms.id);
    load();
  }

  async function abandonGoal() {
    if (!confirm('Mark this goal as abandoned? This becomes pattern data — it does not erase failure, it records it so your coach can help adjust.')) return;
    await supabase.from('goals').update({ status: 'abandoned', updated_at: new Date().toISOString() }).eq('id', goalId);
    onBack();
  }

  async function completeGoal() {
    await supabase.from('goals').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', goalId);
    onBack();
  }

  async function handlePause(context: string) {
    if (!session) return;
    await supabase.from('user_settings').upsert({
      user_id: session.user.id,
      pause_context: context || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    setShowPauseModal(false);
  }

  if (loading) return <div className="text-vow-muted text-sm">Loading...</div>;
  if (!goal) return <div className="text-vow-muted text-sm">Goal not found.</div>;

  const completedSessions = sessions.filter((s) => s.status === 'completed').length;
  const totalSessions = sessions.length;
  const pct = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;
  const movedCount = sessions.filter((s) => s.moved_count > 0).reduce((sum, s) => sum + s.moved_count, 0);

  const statusIcons: Record<string, typeof CheckCircle2> = {
    completed: CheckCircle2,
    scheduled: Circle,
    skipped: SkipForward,
    moved: Move,
  };

  return (
    <div>
      <button onClick={onBack} className="text-sm text-vow-muted hover:text-vow-ink mb-6 flex items-center gap-1 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back to goals
      </button>

      {/* Goal header */}
      <div className="border-t border-vow-border pt-8 mb-8">
        <div className="flex items-start justify-between gap-4 mb-4">
          <h1 className="vow-heading text-3xl text-vow-ink flex-1">{goal.outcome}</h1>
          <span className={`text-xs uppercase tracking-wide flex-shrink-0 ${
            goal.status === 'completed' ? 'text-vow-success' :
            goal.status === 'abandoned' ? 'text-vow-muted line-through' :
            'text-vow-muted'
          }`}>{goal.status}</span>
        </div>
        {goal.why_it_matters && (
          <p className="text-sm text-vow-muted italic">Why this matters: "{goal.why_it_matters}"</p>
        )}

        {/* Metrics */}
        <div className="grid grid-cols-3 gap-8 mt-8 pt-6 border-t border-vow-border">
          <div>
            <div className="vow-label mb-1">Progress</div>
            <div className="text-2xl vow-heading text-vow-ink">{pct}%</div>
            <div className="h-px bg-vow-border relative mt-2">
              <div className="absolute inset-y-0 left-0 bg-vow-ink" style={{ width: `${pct}%`, height: '1px' }} />
            </div>
          </div>
          <div>
            <div className="vow-label mb-1">Sessions</div>
            <div className="text-2xl vow-heading text-vow-ink">{completedSessions}/{totalSessions}</div>
          </div>
          <div>
            <div className="vow-label mb-1">Times moved</div>
            <div className="text-2xl vow-heading text-vow-ink">{movedCount}</div>
          </div>
        </div>

        {(goal.status === 'active' || goal.status === 'locked') && (
          <div className="flex flex-wrap gap-3 mt-6 pt-6 border-t border-vow-border">
            <button onClick={() => setShowAddSession(true)} className="vow-btn-ghost text-xs">
              <Plus className="w-3.5 h-3.5" /> Add session
            </button>
            <button onClick={() => setShowPauseModal(true)} className="vow-btn-ghost text-xs">
              <Pause className="w-3.5 h-3.5" /> Pause / adjust context
            </button>
            <button onClick={completeGoal} className="vow-btn-ghost text-xs" style={{ color: '#3F6B4F', borderColor: '#3F6B4F' }}>
              <Check className="w-3.5 h-3.5" /> Mark completed
            </button>
            <button onClick={abandonGoal} className="text-xs text-vow-muted hover:text-vow-ink ml-auto px-4 py-2.5 transition-colors">
              <Flag className="w-3.5 h-3.5 inline mr-1" /> Abandon
            </button>
          </div>
        )}
      </div>

      {/* Milestones */}
      <div className="mb-10">
        <h2 className="vow-label mb-4">Milestones</h2>
        <div className="border-t border-vow-border">
          {milestones.map((ms) => {
            const isExpanded = expandedMilestone === ms.id;
            const msSessions = sessions.filter((s) => s.milestone_id === ms.id);
            return (
              <div key={ms.id} className="border-b border-vow-border">
                <div className="flex items-center gap-3 py-4">
                  <button
                    onClick={() => toggleMilestoneStatus(ms)}
                    className={`flex-shrink-0 w-5 h-5 border flex items-center justify-center transition-colors ${
                      ms.status === 'completed' ? 'bg-vow-success border-vow-success' : 'border-vow-border hover:border-vow-ink'
                    }`}
                  >
                    {ms.status === 'completed' && <Check className="w-3 h-3 text-vow-bg" />}
                  </button>
                  <button
                    onClick={() => setExpandedMilestone(isExpanded ? null : ms.id)}
                    className="flex-1 text-left flex items-center justify-between"
                  >
                    <div>
                      <div className={`text-sm ${ms.status === 'completed' ? 'text-vow-muted line-through' : 'text-vow-ink'}`}>
                        {ms.title}
                      </div>
                      <div className="text-xs text-vow-muted mt-0.5">
                        {ms.deadline ? `Due ${formatDate(ms.deadline)}` : ''}
                        {msSessions.length > 0 && ` — ${msSessions.length} sessions`}
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-vow-muted" /> : <ChevronDown className="w-4 h-4 text-vow-muted" />}
                  </button>
                </div>
                {isExpanded && (
                  <div className="pb-4 pl-8">
                    {ms.description && <p className="text-xs text-vow-muted mb-3">{ms.description}</p>}
                    {msSessions.length === 0 ? (
                      <p className="text-xs text-vow-muted">No sessions linked to this milestone.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {msSessions.map((s) => {
                          const StatusIcon = statusIcons[s.status] || Circle;
                          return (
                            <div key={s.id} className="flex items-center gap-2 text-xs">
                              <StatusIcon className="w-3.5 h-3.5 text-vow-muted" strokeWidth={1.5} />
                              <span className="text-vow-ink flex-1">{s.title}</span>
                              <span className="text-vow-muted">{formatDate(s.scheduled_at)}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Sessions */}
      <div>
        <h2 className="vow-label mb-4">All sessions</h2>
        <div className="border-t border-vow-border">
          {sessions.map((s) => {
            const StatusIcon = statusIcons[s.status] || Circle;
            return (
              <div key={s.id} className="border-b border-vow-border py-4 flex items-center gap-3">
                <StatusIcon className="w-4 h-4 flex-shrink-0 text-vow-muted" strokeWidth={1.5} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-vow-ink">{s.title}</div>
                  <div className="text-xs text-vow-muted">
                    {formatDate(s.scheduled_at)} at {formatTime(s.scheduled_at)} — {s.duration_minutes}min
                    {s.moved_count > 0 && ` — moved ${s.moved_count}x`}
                  </div>
                </div>
                {(goal.status === 'active' || goal.status === 'locked') && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => updateSessionStatus(s.id, 'completed')} title="Completed" className="p-1.5 text-vow-muted hover:text-vow-ink transition-colors">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => updateSessionStatus(s.id, 'skipped')} title="Skipped" className="p-1.5 text-vow-muted hover:text-vow-ink transition-colors">
                      <SkipForward className="w-4 h-4" />
                    </button>
                    <button onClick={() => moveSession(s)} title="Move +1 day" className="p-1.5 text-vow-muted hover:text-vow-ink transition-colors">
                      <Move className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {showAddSession && (
        <AddSessionModal
          milestones={milestones}
          onAdd={async (title, date, duration, milestoneId) => {
            await supabase.from('sessions').insert({
              goal_id: goalId,
              milestone_id: milestoneId,
              user_id: session!.user.id,
              title,
              scheduled_at: date.toISOString(),
              duration_minutes: duration,
              status: 'scheduled',
            });
            setShowAddSession(false);
            load();
          }}
          onClose={() => setShowAddSession(false)}
        />
      )}

      {showPauseModal && (
        <PauseModal onSave={handlePause} onClose={() => setShowPauseModal(false)} />
      )}
    </div>
  );
}

function AddSessionModal({ milestones, onAdd, onClose }: {
  milestones: Milestone[];
  onAdd: (title: string, date: Date, duration: number, milestoneId: string | null) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(toDateString(addDays(new Date(), 1)));
  const [time, setTime] = useState('09:00');
  const [duration, setDuration] = useState(45);
  const [milestoneId, setMilestoneId] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const dt = new Date(`${date}T${time}`);
    onAdd(title, dt, duration, milestoneId);
  }

  return (
    <Modal onClose={onClose} title="Add session">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="vow-label block mb-2">Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required className="vow-input" placeholder="Session title" autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="vow-label block mb-2">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="vow-input" />
          </div>
          <div>
            <label className="vow-label block mb-2">Time</label>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required className="vow-input" />
          </div>
        </div>
        <div>
          <label className="vow-label block mb-2">Duration (minutes)</label>
          <input type="number" min={5} max={480} value={duration} onChange={(e) => setDuration(parseInt(e.target.value) || 45)} className="vow-input" />
        </div>
        {milestones.length > 0 && (
          <div>
            <label className="vow-label block mb-2">Milestone (optional)</label>
            <select value={milestoneId || ''} onChange={(e) => setMilestoneId(e.target.value || null)} className="vow-input">
              <option value="">None</option>
              {milestones.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select>
          </div>
        )}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="vow-btn-ghost">Cancel</button>
          <button type="submit" className="vow-btn-primary flex-1">Add session</button>
        </div>
      </form>
    </Modal>
  );
}

function PauseModal({ onSave, onClose }: { onSave: (context: string) => void; onClose: () => void }) {
  const [context, setContext] = useState('');
  return (
    <Modal onClose={onClose} title="Pause / adjust context">
      <div className="space-y-4">
        <div className="flex items-start gap-2 border-l-2 border-vow-ink pl-3">
          <p className="text-xs text-vow-muted leading-relaxed">
            Flagging a disruption (illness, travel, crunch at work) tells your coach to treat this period
            differently — it will not penalize legitimate interruptions the same as avoidance patterns.
          </p>
        </div>
        <div>
          <label className="vow-label block mb-2">What is going on?</label>
          <textarea value={context} onChange={(e) => setContext(e.target.value)} rows={3} className="vow-input resize-none" placeholder="e.g. Traveling for work Mon-Thu" autoFocus />
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="vow-btn-ghost">Cancel</button>
          <button onClick={() => onSave(context)} className="vow-btn-primary flex-1">Save context</button>
        </div>
      </div>
    </Modal>
  );
}

export function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-vow-bg/90" onClick={onClose}>
      <div className="w-full max-w-md bg-vow-bg border border-vow-border p-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-vow-border">
          <h3 className="vow-heading text-xl text-vow-ink">{title}</h3>
          <button onClick={onClose} className="text-vow-muted hover:text-vow-ink transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
