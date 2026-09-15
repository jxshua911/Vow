import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { decomposeGoal, type DecomposedGoal } from '@/lib/decompose';
import { addDays, toDateString } from '@/lib/dates';
import { ArrowRight, ArrowLeft, Check } from 'lucide-react';
import type { UserSettings } from '@/types/database';

interface OnboardingProps {
  userId: string;
  onComplete: () => void;
}

const exampleGoals = [
  'Run a 10K',
  'Train for a football trial',
  'Complete my first 100 km ride',
  'Learn to swim 1,500 m',
  'Pass my exams',
  'Learn to code',
];

export function Onboarding({ userId, onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [rawGoal, setRawGoal] = useState('');
  const [decomposed, setDecomposed] = useState<DecomposedGoal | null>(null);
  const [whyItMatters, setWhyItMatters] = useState('');
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const [preferredTimes, setPreferredTimes] = useState('9:00 am');
  const [notificationFreq, setNotificationFreq] = useState('weekly');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleDecompose() {
    if (!rawGoal.trim()) return;
    const result = decomposeGoal(rawGoal);
    setDecomposed(result);
    setStep(1);
  }

  async function handleComplete() {
    setSaving(true);
    setError(null);
    try {
      const settings: Partial<UserSettings> = {
        user_id: userId,
        timezone,
        preferred_session_times: preferredTimes,
        notification_frequency: notificationFreq,
        coaching_tone: 'honest_encouraging',
        onboarding_complete: true,
      };
      await supabase.from('user_settings').upsert(settings);

      const { data: goalData, error: goalErr } = await supabase
        .from('goals')
        .insert({
          user_id: userId,
          title: decomposed!.outcome,
          outcome: decomposed!.outcome,
          why_it_matters: whyItMatters || null,
          deadline: decomposed!.deadline,
          status: 'active',
          weekly_commitment_target: decomposed!.weeklyCommitment,
        })
        .select()
        .single();

      if (goalErr) throw goalErr;

      const milestoneRows = decomposed!.milestones.map((m, i) => ({
        goal_id: goalData.id,
        title: m.title,
        description: m.description,
        sort_order: i,
        deadline: toDateString(addDays(new Date(), m.weeksOut * 7)),
        status: i === 0 ? 'in_progress' : 'pending',
      }));
      await supabase.from('milestones').insert(milestoneRows);

      const sessions = [];
      for (let i = 0; i < decomposed!.weeklyCommitment; i++) {
        const sessionDate = addDays(new Date(), i + 1);
        const [time, period] = preferredTimes.split(' ');
        const [h, m] = time.split(':').map(Number);
        let hour = h;
        if (period?.toLowerCase() === 'pm' && hour !== 12) hour += 12;
        if (period?.toLowerCase() === 'am' && hour === 12) hour = 0;
        sessionDate.setHours(hour, m || 0, 0, 0);
        sessions.push({
          goal_id: goalData.id,
          milestone_id: null,
          user_id: userId,
          title: decomposed!.milestones[0].title,
          scheduled_at: sessionDate.toISOString(),
          duration_minutes: decomposed!.suggestedSessionDuration,
          status: 'scheduled',
        });
      }
      await supabase.from('sessions').insert(sessions);

      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const steps = ['What do you want to achieve?', 'Here is your plan', 'Your preferences'];

  return (
    <div className="min-h-screen bg-vow-bg flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-xl">
        <div className="text-center mb-12">
          <h1 className="vow-heading text-4xl text-vow-ink mb-2">VOW</h1>
          <p className="vow-label">Onboarding</p>
        </div>

        <div className="flex items-center justify-center gap-3 mb-10">
          {steps.map((_, i) => (
            <div key={i} className={`h-px transition-all duration-300 ${i === step ? 'w-12 bg-vow-ink' : i < step ? 'w-8 bg-vow-ink' : 'w-8 bg-vow-border'}`} />
          ))}
        </div>

        {step === 0 && (
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-vow-muted mb-3">Start with the outcome</p>
            <h2 className="vow-heading text-2xl text-vow-ink mb-3">Tell VOW what you want to accomplish.</h2>
            <p className="text-vow-muted text-sm leading-relaxed mb-8">
              Most apps help you track what you’re doing. VOW helps you figure out what to do next. Describe the outcome in your own words — VOW will turn it into a concrete plan with milestones and a realistic weekly commitment.
            </p>
            <textarea value={rawGoal} onChange={(e) => setRawGoal(e.target.value)} rows={3} className="vow-input resize-none mb-4" placeholder="e.g. I want to run a sub-25 minute 5K" autoFocus />
            <p className="text-xs text-vow-muted mb-2">Try one:</p>
            <div className="flex flex-wrap gap-2 mb-8">
              {exampleGoals.map((s) => (
                <button key={s} onClick={() => setRawGoal(s)} className="text-xs px-3 py-1.5 border border-vow-border text-vow-muted hover:text-vow-ink hover:border-vow-ink transition-colors">{s}</button>
              ))}
            </div>
            <button onClick={handleDecompose} disabled={!rawGoal.trim()} className="vow-btn-primary w-full">Build my plan <ArrowRight className="w-4 h-4" /></button>
          </div>
        )}

        {step === 1 && decomposed && (
          <div>
            <h2 className="vow-heading text-2xl text-vow-ink mb-3">Here is your first plan.</h2>
            <p className="text-vow-muted text-sm leading-relaxed mb-8">VOW has turned your outcome into actions. Review it before you lock it in.</p>

            <div className="space-y-6 mb-8">
              <div className="border-t border-vow-border pt-4">
                <p className="vow-label mb-1">Outcome</p>
                <p className="text-vow-ink text-base font-medium">{decomposed.outcome}</p>
              </div>
              <div className="border-t border-vow-border pt-4">
                <p className="vow-label mb-4">Milestones</p>
                <div className="space-y-4">
                  {decomposed.milestones.map((m, i) => (
                    <div key={i} className="flex gap-4">
                      <span className="text-vow-muted text-sm font-mono pt-0.5">{String(i + 1).padStart(2, '0')}</span>
                      <div>
                        <p className="text-sm text-vow-ink font-medium">{m.title}</p>
                        <p className="text-xs text-vow-muted mt-1 leading-relaxed">{m.description}</p>
                        <p className="text-xs text-vow-muted mt-1">~{m.weeksOut} week{m.weeksOut !== 1 ? 's' : ''} out</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t border-vow-border pt-4 grid grid-cols-2 gap-6">
                <div><p className="vow-label mb-1">Weekly commitment</p><p className="text-vow-ink font-medium">{decomposed.weeklyCommitment} sessions / week</p></div>
                <div><p className="vow-label mb-1">Session length</p><p className="text-vow-ink font-medium">{decomposed.suggestedSessionDuration} min</p></div>
              </div>
            </div>

            <div className="mb-8">
              <label className="vow-label block mb-2">Why does this matter to you?</label>
              <textarea value={whyItMatters} onChange={(e) => setWhyItMatters(e.target.value)} rows={2} className="vow-input resize-none" placeholder="Your honest reason — VOW will use it when motivation dips." />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(0)} className="vow-btn-ghost"><ArrowLeft className="w-4 h-4" />Back</button>
              <button onClick={() => setStep(2)} className="vow-btn-primary flex-1">Looks good <ArrowRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="vow-heading text-2xl text-vow-ink mb-3">Tune how VOW works with you.</h2>
            <p className="text-vow-muted text-sm leading-relaxed mb-8">These preferences shape your planning rhythm. You can change them anytime.</p>

            <div className="space-y-6 mb-8">
              <div><label className="vow-label block mb-2">Timezone</label><input value={timezone} onChange={(e) => setTimezone(e.target.value)} className="vow-input" /></div>
              <div><label className="vow-label block mb-2">Preferred session time</label><input value={preferredTimes} onChange={(e) => setPreferredTimes(e.target.value)} placeholder="e.g. 9:00 am" className="vow-input" /></div>
              <div>
                <label className="vow-label block mb-2">How often should I check in?</label>
                <div className="flex gap-2">
                  {[{ val: 'daily', label: 'Daily' }, { val: 'weekly', label: 'Weekly' }, { val: 'biweekly', label: 'Every 2 weeks' }].map((opt) => (
                    <button key={opt.val} onClick={() => setNotificationFreq(opt.val)} className={`flex-1 py-2.5 text-sm border transition-colors ${notificationFreq === opt.val ? 'border-vow-ink text-vow-ink font-medium' : 'border-vow-border text-vow-muted hover:border-vow-ink'}`}>{opt.label}</button>
                  ))}
                </div>
                <p className="text-xs text-vow-muted mt-2">Weekly is recommended — daily check-ins can feel like nagging.</p>
              </div>
            </div>

            {error && <p className="text-sm text-vow-ink mb-4" style={{ borderLeft: '2px solid #111', paddingLeft: '0.75rem' }}>{error}</p>}
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="vow-btn-ghost"><ArrowLeft className="w-4 h-4" />Back</button>
              <button onClick={handleComplete} disabled={saving} className="vow-btn-primary flex-1">{saving ? 'Setting up...' : 'Lock in my first goal'} <Check className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
