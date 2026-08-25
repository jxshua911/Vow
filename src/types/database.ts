export type GoalStatus = 'draft' | 'locked' | 'active' | 'completed' | 'abandoned';
export type MilestoneStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';
export type SessionStatus = 'scheduled' | 'completed' | 'skipped' | 'moved';
export type ReviewStatus = 'draft' | 'confirmed';

export interface UserSettings {
  user_id: string;
  timezone: string;
  preferred_session_times: string | null;
  notification_frequency: string;
  coaching_tone: string;
  pause_context: string | null;
  onboarding_complete: boolean;
  created_at: string;
  updated_at: string;
}

export interface Goal {
  id: string;
  user_id: string;
  title: string;
  outcome: string;
  why_it_matters: string | null;
  deadline: string | null;
  status: GoalStatus;
  weekly_commitment_target: number;
  created_at: string;
  updated_at: string;
}

export interface Milestone {
  id: string;
  goal_id: string;
  title: string;
  description: string | null;
  sort_order: number;
  deadline: string | null;
  status: MilestoneStatus;
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: string;
  goal_id: string;
  milestone_id: string | null;
  user_id: string;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  status: SessionStatus;
  moved_count: number;
  external_event_id: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface JournalEntry {
  id: string;
  user_id: string;
  body: string;
  tag: string | null;
  linked_goal_id: string | null;
  embedding: string | null;
  created_at: string;
}

export interface CommitmentLogEntry {
  id: string;
  user_id: string;
  week_start: string;
  week_end: string;
  goal_id: string;
  committed_sessions: number;
  completed_sessions: number;
  skipped_sessions: number;
  moved_sessions: number;
  snapshot: Record<string, unknown>;
  created_at: string;
}

export interface PatternFinding {
  type: 'time_pattern' | 'calendar_conflict' | 'milestone_calibration' | 'overload' | 'disruption';
  description: string;
  evidence: string[];
  hypothesis: string;
  proposed_adjustment: string;
}

export interface Recommendation {
  title: string;
  description: string;
  category: 'schedule' | 'milestone' | 'load' | 'tone';
}

export interface ProposedCommitment {
  goal_id: string;
  goal_title: string;
  sessions_per_week: number;
  notes: string;
}

export interface Review {
  id: string;
  user_id: string;
  week_start: string;
  week_end: string;
  completion_pct: number;
  committed_count: number;
  completed_count: number;
  missed_count: number;
  moved_count: number;
  biggest_win: string | null;
  biggest_setback: string | null;
  patterns: PatternFinding[];
  recommendations: Recommendation[];
  coaching_text: string;
  proposed_commitments: ProposedCommitment[];
  status: ReviewStatus;
  created_at: string;
  confirmed_at: string | null;
}
