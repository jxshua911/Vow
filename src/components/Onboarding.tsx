import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ArrowRight, ArrowLeft } from '@/lib/ui-icons';
import { GoalPlanner } from './GoalPlanner';
import type { UserSettings } from '@/types/database';

interface OnboardingProps {
  userId: string;
  onComplete: () => void;
}

const goalPlaceholders = [
  'Make ravioli',
  'Land a bicycle kick',
  'Build my first website',
  'Run a 10K',
  'Learn conversational Spanish',
  'Build a robot',
  'Make a short film',
  'Learn to sail',
  'Bake proper sourdough',
  'Launch my first app',
  'Get ready for football trials',
  'Swim 1,500 m',
  'Write my first song',
  'Plan a backpacking trip',
  'Learn to play guitar',
  'Read 12 books',
  'Start a garden',
  'Cook a proper curry',
  'Pass my maths exam',
  'Learn to edit videos',
  'Cycle 100 km',
  'Build a portfolio',
  'Learn how to surf',
  'Design a game',
  'Make the perfect pizza',
];

const exampleGoals = [
  'Run a 10K',
  'Train for a football trial',
  'Complete my first 100 km ride',
  'Learn to swim 1,500 m',
  'Pass my exams',
  'Learn to code',
];

function getRandomPlaceholder() {
  return goalPlaceholders[Math.floor(Math.random() * goalPlaceholders.length)];
}

export function Onboarding({ userId, onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [rawGoal, setRawGoal] = useState('');
  const [goalPlaceholder, setGoalPlaceholder] = useState(getRandomPlaceholder);
  const [showPlanner, setShowPlanner] = useState(false);
  const [whyItMatters, setWhyItMatters] = useState('');
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const [preferredTimes, setPreferredTimes] = useState('9:00 am');
  const [notificationFreq, setNotificationFreq] = useState('weekly');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleGoalContinue() {
    if (!rawGoal.trim()) return;
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
      const { error: settingsError } = await supabase.from('user_settings').upsert(settings);
      if (settingsError) throw settingsError;
      setShowPlanner(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (showPlanner) {
    return (
      <GoalPlanner
        userId={userId}
        initialGoal={rawGoal}
        initialWhy={whyItMatters}
        onCreated={onComplete}
        onCancel={onComplete}
      />
    );
  }

  const steps = ['What do you want to achieve?', 'Your preferences'];

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
            <textarea value={rawGoal} onChange={(e) => setRawGoal(e.target.value)} rows={3} className="vow-input resize-none mb-4" placeholder={goalPlaceholder} autoFocus />
            <p className="text-xs text-vow-muted mb-2">Try one:</p>
            <div className="flex flex-wrap gap-2 mb-8">
              {exampleGoals.map((s) => (
                <button key={s} onClick={() => setRawGoal(s)} className="text-xs px-3 py-1.5 border border-vow-border text-vow-muted hover:text-vow-ink hover:border-vow-ink transition-colors">{s}</button>
              ))}
            </div>
            <button onClick={handleGoalContinue} disabled={!rawGoal.trim()} className="vow-btn-primary w-full">Build my plan <ArrowRight className="w-4 h-4" /></button>
          </div>
        )}

        {step === 1 && (
          <div>
            <h2 className="vow-heading text-2xl text-vow-ink mb-3">Tune how VOW works with you.</h2>
            <p className="text-vow-muted text-sm leading-relaxed mb-8">These preferences shape your planning rhythm. Your first goal will then go through VOW's full domain-aware AI planner.</p>
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
              <button onClick={() => setStep(0)} className="vow-btn-ghost"><ArrowLeft className="w-4 h-4" />Back</button>
              <button onClick={handleComplete} disabled={saving} className="vow-btn-primary flex-1">{saving ? 'Saving preferences…' : 'Build my first VOW plan'} <ArrowRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
