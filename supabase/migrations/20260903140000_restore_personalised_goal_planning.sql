-- Restore the original VOW planning flow: every goal gets a short
-- personalised clarification pass before plan generation, while Armadillo
-- remains the structured intelligence layer.
--
-- Important: a goal such as "learn how to surf" is a skill/sport goal, not
-- Education. Education is reserved for explicit study/revision/exam contexts.

create or replace function public.armadillo_analyse_goal(
  goal_title text,
  goal_outcome text default null,
  goal_why text default null
)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  t text := lower(trim(concat_ws(' ', coalesce(goal_title,''), coalesce(goal_outcome,''), coalesce(goal_why,''))));
  category text := 'General';
  goal_type text := 'Goal';
  metric text := 'measurable progress toward the stated outcome';
  target text := null;
  direction text := 'progress';
  secondary_metric text := null;
  time_target text := null;
  integration text := null;
  planning_strategy text := 'define the clearest measurable outcome, then break it into small repeatable actions';
  evidence jsonb := jsonb_build_array('manual progress updates','goal milestones','completed sessions or actions');
  evidence_source jsonb := jsonb_build_array('manual tracking');
  confidence numeric := 0.55;
  clarification_reasons jsonb := jsonb_build_array('A short baseline and preference check will make the plan genuinely personalised.');
  safety_flag boolean := false;
  safety_note text := null;
begin
  -- Skill/sport goals must be recognised before the broad "learn" concept.
  if t ~ '(surf|surfing|surfboard|wave|waves)' then
    category := 'Sports'; goal_type := 'Surfing'; metric := 'sessions, time in water, skills completed';
    evidence := jsonb_build_array('surf sessions','time in water','skills completed','manual progress notes');
    evidence_source := jsonb_build_array('manual tracking');
    planning_strategy := 'teach the skill progressively from water safety and fundamentals through repeatable technique drills and supervised progression';
    confidence := 0.94;
  elsif t ~ '(run|running|5k|10k|marathon|half marathon|mile|km)' then
    category := 'Sports'; goal_type := 'Running'; metric := 'distance, pace, time';
    evidence := jsonb_build_array('activity distance','activity pace','activity time'); integration := 'Strava'; evidence_source := jsonb_build_array('Strava','manual tracking');
    planning_strategy := 'progressive running sessions with gradual workload changes, recovery and measurable checkpoints'; confidence := 0.94;
  elsif t ~ '(cycle|cycling|bike|biking|ride|kilometre|kilometer)' then
    category := 'Sports'; goal_type := 'Cycling'; metric := 'distance, duration, effort';
    evidence := jsonb_build_array('ride distance','ride duration','ride effort'); integration := 'Strava'; evidence_source := jsonb_build_array('Strava','manual tracking');
    planning_strategy := 'progressive rides from an achievable beginner baseline through endurance, technique and recovery'; confidence := 0.94;
  elsif t ~ '(swim|swimming|pool|freestyle|laps)' then
    category := 'Sports'; goal_type := 'Swimming'; metric := 'distance, duration, technique skills';
    evidence := jsonb_build_array('swim distance','swim duration','completed skills','completed sessions'); integration := 'Strava'; evidence_source := jsonb_build_array('Strava','manual tracking');
    planning_strategy := 'progressive swim sessions from technique and water confidence through repeatable distance and endurance work'; confidence := 0.94;
  elsif t ~ '(football|soccer|match|football training)' then
    category := 'Sports'; goal_type := 'Football'; metric := 'sessions, minutes, performance';
    evidence := jsonb_build_array('training sessions','match activity','manual performance notes'); integration := 'Strava'; evidence_source := jsonb_build_array('Strava','manual tracking');
    planning_strategy := 'structured practice, match work, targeted skills and recovery'; confidence := 0.94;
  elsif t ~ '(study|studying|revise|revision|exam|homework|schoolwork|physics|chemistry|biology|maths|mathematics|algebra|calculus)' then
    category := 'Education'; goal_type := 'Study'; metric := 'study time, task completion, accuracy';
    evidence := jsonb_build_array('study sessions','completed tasks','practice results'); integration := 'Google Calendar'; evidence_source := jsonb_build_array('Google Calendar','manual tracking');
    planning_strategy := 'scheduled focused study with active practice, spaced review and checkpoints'; confidence := 0.94;
  elsif t ~ '(read|reading|book|books|pages)' then
    category := 'Reading'; goal_type := 'Reading'; metric := 'pages, books, reading time';
    evidence := jsonb_build_array('pages read','books completed','reading sessions'); evidence_source := jsonb_build_array('manual tracking');
    planning_strategy := 'consistent reading sessions measured by the clearest available reading metric'; confidence := 0.94;
  elsif t ~ '(meditate|meditation|mindfulness)' then
    category := 'Mindfulness'; goal_type := 'Meditation'; metric := 'sessions, duration';
    evidence := jsonb_build_array('meditation sessions','meditation duration'); integration := 'Medito'; evidence_source := jsonb_build_array('Medito','manual tracking');
    planning_strategy := 'short, repeatable sessions with gradual consistency building'; confidence := 0.94;
  elsif t ~ '(github|commit|commits|pull request|contribution|coding project)' then
    category := 'Technology/Projects'; goal_type := 'GitHub Contributions'; metric := 'contributions, pull requests, commits';
    evidence := jsonb_build_array('GitHub activity','pull requests','commits'); integration := 'GitHub'; evidence_source := jsonb_build_array('GitHub','manual tracking');
    planning_strategy := 'break the technical outcome into concrete deliverables, skills and shipped increments'; confidence := 0.94;
  elsif t ~ '(portfolio|project|career|cv|resume|job|application|internship)' then
    category := 'Career/Projects'; goal_type := 'Project'; metric := 'deliverables, milestones, completion';
    evidence := jsonb_build_array('project milestones','completed deliverables','project review'); integration := 'Google Calendar'; evidence_source := jsonb_build_array('Google Calendar','manual tracking');
    planning_strategy := 'sequence concrete deliverables into weekly execution blocks'; confidence := 0.94;
  elsif t ~ '(save|saving|savings|money|budget|financial|finance)' then
    category := 'Finance'; goal_type := 'Saving'; metric := 'money saved';
    evidence := jsonb_build_array('manual savings updates','milestones'); evidence_source := jsonb_build_array('manual tracking');
    planning_strategy := 'set measurable savings checkpoints and review progress regularly'; confidence := 0.94;
  elsif t ~ '(music|song|guitar|piano|draw|drawing|paint|painting|write|writing|novel|creative)' then
    category := 'Creative'; goal_type := 'Creative Practice'; metric := 'sessions, completed pieces';
    evidence := jsonb_build_array('practice sessions','completed pieces','project milestones'); evidence_source := jsonb_build_array('manual tracking');
    planning_strategy := 'turn the creative outcome into repeatable practice and concrete deliverables'; confidence := 0.94;
  end if;

  -- Extract common measurable targets without treating them as a substitute
  -- for the clarification step.
  select (regexp_match(t, '(\\d+(?:\\.\\d+)?)\\s*(km|kilometres?|kilometers?|miles?|mi|pages?|books?|hours?|hrs?|minutes?|mins?|sessions?)'))[1]
    || ' ' || (regexp_match(t, '(\\d+(?:\\.\\d+)?)\\s*(km|kilometres?|kilometers?|miles?|mi|pages?|books?|hours?|hrs?|minutes?|mins?|sessions?)'))[2]
  into target
  where t ~ '(\\d+(?:\\.\\d+)?)\\s*(km|kilometres?|kilometers?|miles?|mi|pages?|books?|hours?|hrs?|minutes?|mins?|sessions?)';

  if t ~ '\\b(5k|10k|half marathon|marathon)\\b' then
    target := coalesce(target, (regexp_match(t, '\\b(5k|10k|half marathon|marathon)\\b'))[1]);
  end if;
  if t ~ '\\b(?:under|below|within)\\s+(\\d+(?:\\.\\d+)?)\\s*(hours?|hrs?|minutes?|mins?)\\b' then
    time_target := (regexp_match(t, '\\b(?:under|below|within)\\s+(\\d+(?:\\.\\d+)?)\\s*(hours?|hrs?|minutes?|mins?)\\b'))[0];
    secondary_metric := 'time';
  elsif t ~ '\\b(?:under|below|within)\\s+(?:an?|one)\\s+hour\\b' then
    time_target := 'under 60 minutes'; secondary_metric := 'time';
  end if;
  if t ~ '\\b(?:reduce|decrease|lower|cut|spend less)\\b' then direction := 'decrease';
  elsif t ~ '\\b(?:maintain|keep|sustain)\\b' then direction := 'maintain';
  elsif t ~ '\\b(?:finish|complete|ship|submit|deliver)\\b' then direction := 'complete';
  elsif t ~ '\\b(?:improve|increase|grow|raise|more|faster|better)\\b' then direction := 'increase';
  elsif t ~ '\\b(?:build|develop|establish|learn|practice)\\b' then direction := 'build';
  end if;

  -- Every goal gets the short clarification pass. This deliberately restores
  -- the old personalised planning behaviour while keeping Armadillo's
  -- classification/evidence layer intact.
  return jsonb_build_object(
    'category', category,
    'goal_type', goal_type,
    'metric', metric,
    'target', target,
    'direction', direction,
    'secondary_metric', secondary_metric,
    'time_target', time_target,
    'evidence', evidence,
    'evidence_source', evidence_source,
    'integration', integration,
    'planning_strategy', planning_strategy,
    'needs_clarification', true,
    'clarification_reasons', clarification_reasons,
    'safety_flag', safety_flag,
    'safety_note', safety_note,
    'fallback', 'If the user leaves the follow-up answers blank, VOW should generate a sensible Level 1 beginner plan rather than inventing experience.',
    'confidence', confidence
  );
end;
$$;

revoke all on function public.armadillo_analyse_goal(text,text,text) from public;
grant execute on function public.armadillo_analyse_goal(text,text,text) to authenticated;

create or replace function public.attach_armadillo_to_goal()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  analysis jsonb;
begin
  analysis := public.armadillo_analyse_goal(NEW.title, NEW.outcome, NEW.why_it_matters);
  NEW.plan_json := coalesce(NEW.plan_json, '{}'::jsonb) || jsonb_build_object('armadillo', analysis);
  return NEW;
end;
$$;

drop trigger if exists trg_attach_armadillo_to_goal on public.goals;
create trigger trg_attach_armadillo_to_goal
before insert or update of title, outcome, why_it_matters, plan_json
on public.goals
for each row execute function public.attach_armadillo_to_goal();
