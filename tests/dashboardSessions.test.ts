import test from 'node:test';
import assert from 'node:assert/strict';
import { isFlexibleUpcomingSession, isSessionInCurrentPlanWeek } from '../src/lib/dashboardSessions.ts';

const goal = { id: 'goal-1', status: 'active', start_date: '2026-10-19' };
const session = {
  goal_id: 'goal-1',
  status: 'scheduled',
  scheduled_at: null,
  day_of_week: 'Monday',
  notes: 'Plan day: Week 1, Monday',
};

test('counts an unscheduled active-plan session in its current plan week', () => {
  assert.equal(isSessionInCurrentPlanWeek(session, [goal], new Date(2026, 9, 19, 12)), true);
});

test('does not count next-week unscheduled sessions in the current week', () => {
  assert.equal(
    isSessionInCurrentPlanWeek({ ...session, notes: 'Plan day: Week 2, Monday' }, [goal], new Date(2026, 9, 19, 12)),
    false,
  );
});

test('does not count date-less sessions for completed or abandoned goals outside active states', () => {
  assert.equal(isSessionInCurrentPlanWeek(session, [{ ...goal, status: 'completed' }], new Date(2026, 9, 19, 12)), false);
});

test('continues to use calendar dates for scheduled sessions', () => {
  assert.equal(
    isSessionInCurrentPlanWeek({ ...session, scheduled_at: '2026-10-19T09:00:00.000Z' }, [goal], new Date(2026, 9, 19, 12)),
    true,
  );
});

test('includes flexible-day sessions for active goals in the upcoming list', () => {
  assert.equal(isFlexibleUpcomingSession(session, [goal]), true);
});

test('does not include flexible-day sessions for completed goals or sessions without a weekday', () => {
  assert.equal(isFlexibleUpcomingSession(session, [{ ...goal, status: 'completed' }]), false);
  assert.equal(isFlexibleUpcomingSession({ ...session, day_of_week: null }, [goal]), false);
  assert.equal(isFlexibleUpcomingSession({ ...session, status: 'completed' }, [goal]), false);
});

test('keeps timestamped sessions out of the flexible-day category', () => {
  assert.equal(isFlexibleUpcomingSession({ ...session, scheduled_at: '2026-10-19T09:00:00.000Z' }, [goal]), false);
});
