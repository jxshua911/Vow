-- Widen Armadillo beyond a small fixed hobby list.
-- Specific skill/domain rules run before generic learning language so goals such
-- as "learn crochet" are routed to Creative Skills rather than Education.
-- Every goal remains eligible for the 2-3 question personalisation pass.

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
  planning_strategy text := 'establish a baseline, identify the next prerequisites, then break the outcome into progressive repeatable actions';
  evidence jsonb := jsonb_build_array('manual progress updates','goal milestones','completed sessions or actions');
  evidence_source jsonb := jsonb_build_array('manual tracking');
  confidence numeric := 0.55;
  safety_flag boolean := false;
  safety_note text := null;
begin
  -- Specific practical/creative skills first. Generic words such as "learn"
  -- must never force a skill into Education.
  if t ~ '(crochet|crocheting|crochet hook|amigurumi)' then
    category := 'Creative Skills'; goal_type := 'Crochet'; metric := 'techniques mastered, practice sessions, finished projects';
    evidence := jsonb_build_array('practice sessions','techniques completed','finished projects');
    planning_strategy := 'progress from tools and terminology through foundational stitches, tension, construction techniques, a guided project and independent application'; confidence := 0.96;
  elsif t ~ '(knit|knitting|knitting needles|purl|cast on)' then
    category := 'Creative Skills'; goal_type := 'Knitting'; metric := 'techniques mastered, practice sessions, finished projects';
    evidence := jsonb_build_array('practice sessions','techniques completed','finished projects');
    planning_strategy := 'progress from tools and terminology through cast-on and core stitches, tension, shaping, a guided project and independent application'; confidence := 0.96;
  elsif t ~ '(sew|sewing|seam|sewing machine|embroidery|needlework)' then
    category := 'Creative Skills'; goal_type := 'Sewing'; metric := 'techniques mastered, practice sessions, finished projects';
    evidence := jsonb_build_array('practice sessions','techniques completed','finished projects');
    planning_strategy := 'progress from tools and fabric handling through basic stitches and seams, controlled samples, pattern work and a finished project'; confidence := 0.96;
  elsif t ~ '(pottery|ceramics|clay|wheel throwing|wheel throwing)' then
    category := 'Creative Skills'; goal_type := 'Pottery'; metric := 'techniques mastered, practice sessions, completed pieces';
    evidence := jsonb_build_array('practice sessions','techniques completed','finished pieces');
    planning_strategy := 'progress from materials and studio basics through wedging, forming, controlled exercises, glazing where appropriate and finished pieces'; confidence := 0.96;
  elsif t ~ '(draw|drawing|sketch|sketching|illustration)' then
    category := 'Creative Skills'; goal_type := 'Drawing'; metric := 'practice sessions, exercises completed, finished pieces';
    evidence := jsonb_build_array('drawing sessions','completed exercises','finished pieces');
    planning_strategy := 'progress from observation and control through simple forms, proportion, value, perspective, composition and finished studies'; confidence := 0.96;
  elsif t ~ '(paint|painting|watercolour|watercolor|acrylic painting|oil painting)' then
    category := 'Creative Skills'; goal_type := 'Painting'; metric := 'practice sessions, techniques mastered, finished pieces';
    evidence := jsonb_build_array('painting sessions','techniques completed','finished pieces');
    planning_strategy := 'progress from materials and colour basics through brush control, value, composition, studies and complete works'; confidence := 0.96;
  elsif t ~ '(photography|photograph|photos|camera|portrait photography|street photography)' then
    category := 'Creative Skills'; goal_type := 'Photography'; metric := 'practice sessions, photographs, technique exercises';
    evidence := jsonb_build_array('photo sessions','completed exercises','photo reviews');
    planning_strategy := 'progress from camera or phone controls through focus, exposure and composition, constrained shoots, review, editing and a finished photo set'; confidence := 0.96;
  elsif t ~ '(music|musical instrument|instrument|piano|guitar|keyboard|drums|violin|ukulele|singing|vocals)' then
    category := 'Creative Skills'; goal_type := 'Music'; metric := 'practice sessions, techniques mastered, pieces performed or created';
    evidence := jsonb_build_array('practice sessions','technique exercises','pieces completed');
    planning_strategy := 'progress from setup and fundamentals through technique, rhythm or theory, controlled pieces, transitions and independent performance or creation'; confidence := 0.96;
  elsif t ~ '(write|writing|poetry|story|short story|novel|screenplay|lyrics)' then
    category := 'Creative Skills'; goal_type := 'Writing'; metric := 'writing sessions, drafts, completed pieces';
    evidence := jsonb_build_array('writing sessions','drafts','completed pieces');
    planning_strategy := 'progress from defining the outcome through focused practice, drafting, structural revision, feedback and a complete finished piece'; confidence := 0.96;
  elsif t ~ '(cook|cooking|baking|bake|recipe|culinary)' then
    category := 'Practical Skills'; goal_type := 'Cooking'; metric := 'techniques mastered, dishes completed, consistency';
    evidence := jsonb_build_array('cooking sessions','dishes completed','recipe outcomes');
    planning_strategy := 'progress from kitchen setup and core safety through basic techniques, simple dishes, combined techniques and increasingly independent meals'; confidence := 0.96;
  elsif t ~ '(woodworking|woodwork|carpentry|wood project|build furniture)' then
    category := 'Practical Skills'; goal_type := 'Woodworking'; metric := 'techniques mastered, projects completed, measurements';
    evidence := jsonb_build_array('work sessions','completed projects','project measurements');
    planning_strategy := 'progress from tool familiarity and safety through measurement and joining fundamentals, guided builds and independent projects'; confidence := 0.96;
  elsif t ~ '(programming|coding|code|python|javascript|typescript|java|c\+\+|html|css|software|app development)' then
    category := 'Technology/Projects'; goal_type := 'Programming'; metric := 'concepts mastered, features shipped, working projects';
    evidence := jsonb_build_array('coding sessions','working features','project milestones'); integration := 'GitHub'; evidence_source := jsonb_build_array('GitHub','manual tracking');
    planning_strategy := 'progress from environment and fundamentals through small exercises, debugging, a focused project, testing and shipping'; confidence := 0.96;
  elsif t ~ '(public speaking|speaking|presentation|presenting|speech|debate)' then
    category := 'Communication'; goal_type := 'Public Speaking'; metric := 'practice sessions, speaking duration, delivery quality';
    evidence := jsonb_build_array('speaking practices','rehearsals','feedback');
    planning_strategy := 'progress from message structure and short rehearsals through timed practice, feedback and complete delivery'; confidence := 0.96;
  elsif t ~ '(french|spanish|german|italian|portuguese|arabic|swahili|japanese|korean|mandarin|chinese|language|learn a language|learn french|learn spanish)' then
    category := 'Languages'; goal_type := 'Language Learning'; metric := 'vocabulary, comprehension, speaking and writing ability';
    evidence := jsonb_build_array('language practice sessions','vocabulary recall','speaking or writing samples'); integration := 'Google Calendar'; evidence_source := jsonb_build_array('Google Calendar','manual tracking');
    planning_strategy := 'progress from pronunciation and high-value vocabulary through sentence formation, comprehension, guided production and real-world use'; confidence := 0.96;
  elsif t ~ '(run|running|5k|5 km|10k|10 km|marathon|half marathon|mile|miles|jog)' then
    category := 'Sports'; goal_type := 'Running'; metric := 'distance, pace, time';
    evidence := jsonb_build_array('activity distance','activity pace','activity time'); integration := 'Strava'; evidence_source := jsonb_build_array('Strava','manual tracking');
    planning_strategy := 'progressive running from baseline through aerobic development, goal-specific work, recovery and measurable checkpoints'; confidence := 0.96;
  elsif t ~ '(cycle|cycling|bike|biking|ride|riding|kilometre|kilometer)' then
    category := 'Sports'; goal_type := 'Cycling'; metric := 'distance, duration, speed';
    evidence := jsonb_build_array('ride distance','ride duration','ride speed'); integration := 'Strava'; evidence_source := jsonb_build_array('Strava','manual tracking');
    planning_strategy := 'progressive cycling from an achievable baseline through endurance, technique, varied effort and recovery'; confidence := 0.96;
  elsif t ~ '(swim|swimming|pool|freestyle|backstroke|breaststroke|butterfly|laps)' then
    category := 'Sports'; goal_type := 'Swimming'; metric := 'distance, duration, technique';
    evidence := jsonb_build_array('swim distance','swim duration','completed skills','completed sessions'); integration := 'Strava'; evidence_source := jsonb_build_array('Strava','manual tracking');
    planning_strategy := 'progressive swimming from water confidence and technique through repeatable distance, efficiency and endurance'; confidence := 0.96;
  elsif t ~ '(football|soccer|match|dribbling|passing|shooting|defending)' then
    category := 'Sports'; goal_type := 'Football'; metric := 'sessions, minutes, skill performance';
    evidence := jsonb_build_array('training sessions','match activity','manual performance notes'); integration := 'Strava'; evidence_source := jsonb_build_array('Strava','manual tracking');
    planning_strategy := 'progressive football practice from technical foundations through position-specific work, decision making and match application'; confidence := 0.96;
  elsif t ~ '(basketball|shooting hoops|layup|free throw|dribble)' then
    category := 'Sports'; goal_type := 'Basketball'; metric := 'sessions, repetitions, skill performance';
    evidence := jsonb_build_array('practice sessions','made shots or repetitions','manual performance notes'); integration := 'Strava'; evidence_source := jsonb_build_array('Strava','manual tracking');
    planning_strategy := 'progressive basketball practice from fundamentals through controlled repetition, game-speed application and review'; confidence := 0.96;
  elsif t ~ '(tennis|serve|forehand|backhand|racket)' then
    category := 'Sports'; goal_type := 'Tennis'; metric := 'sessions, repetitions, skill performance';
    evidence := jsonb_build_array('practice sessions','rally or serve practice','manual performance notes'); integration := 'Strava'; evidence_source := jsonb_build_array('Strava','manual tracking');
    planning_strategy := 'progressive tennis practice from technique through drills, movement, point play and review'; confidence := 0.96;
  elsif t ~ '(golf|putting|driving range|golf swing)' then
    category := 'Sports'; goal_type := 'Golf'; metric := 'practice sessions, shots, scoring';
    evidence := jsonb_build_array('practice sessions','shots or rounds','score records'); integration := 'Strava'; evidence_source := jsonb_build_array('Strava','manual tracking');
    planning_strategy := 'progressive golf practice from fundamentals through repeatable technique, short game, course application and scoring review'; confidence := 0.96;
  elsif t ~ '(surf|surfing|surfboard|wave|waves)' then
    category := 'Sports'; goal_type := 'Surfing'; metric := 'sessions, time in water, skills completed';
    evidence := jsonb_build_array('surf sessions','time in water','skills completed'); integration := 'Strava'; evidence_source := jsonb_build_array('Strava','manual tracking');
    planning_strategy := 'progressive surfing from water and board fundamentals through positioning, paddling, safe take-offs, wave selection and controlled riding'; confidence := 0.96;
  elsif t ~ '(dance|dancing|hip hop dance|ballet|salsa|contemporary dance)' then
    category := 'Sports'; goal_type := 'Dance'; metric := 'practice sessions, routines completed, technique';
    evidence := jsonb_build_array('dance sessions','routines completed','practice notes');
    planning_strategy := 'progressive dance from fundamentals through isolated movements, combinations, choreography and performance practice'; confidence := 0.96;
  elsif t ~ '(study|studying|revise|revision|exam|homework|schoolwork|physics|chemistry|biology|maths|mathematics|algebra|calculus|geography|history|economics|computer science)' then
    category := 'Education'; goal_type := 'Study'; metric := 'study time, task completion, accuracy';
    evidence := jsonb_build_array('study sessions','completed tasks','practice results'); integration := 'Google Calendar'; evidence_source := jsonb_build_array('Google Calendar','manual tracking');
    planning_strategy := 'structured study from baseline diagnosis through active practice, spaced review, testing and closing gaps'; confidence := 0.96;
  elsif t ~ '(read|reading|book|books|pages)' then
    category := 'Reading'; goal_type := 'Reading'; metric := 'pages, books, reading time, comprehension';
    evidence := jsonb_build_array('pages read','books completed','reading sessions');
    planning_strategy := 'consistent reading with suitable pacing, comprehension checks and progressively more demanding material'; confidence := 0.96;
  elsif t ~ '(meditate|meditation|mindfulness)' then
    category := 'Mindfulness'; goal_type := 'Meditation'; metric := 'sessions, duration, consistency';
    evidence := jsonb_build_array('meditation sessions','meditation duration'); integration := 'Medito'; evidence_source := jsonb_build_array('Medito','manual tracking');
    planning_strategy := 'short repeatable sessions with gradual consistency building and reflection'; confidence := 0.96;
  elsif t ~ '(github|commit|commits|pull request|contribution)' then
    category := 'Technology/Projects'; goal_type := 'GitHub Contributions'; metric := 'contributions, pull requests, commits';
    evidence := jsonb_build_array('GitHub activity','pull requests','commits'); integration := 'GitHub'; evidence_source := jsonb_build_array('GitHub','manual tracking');
    planning_strategy := 'break the technical outcome into concrete deliverables, skills and shipped increments'; confidence := 0.96;
  elsif t ~ '(portfolio|project|career|cv|resume|job|application|internship|business|startup)' then
    category := 'Career/Projects'; goal_type := 'Project'; metric := 'deliverables, milestones, completion';
    evidence := jsonb_build_array('project milestones','completed deliverables','project review'); integration := 'Google Calendar'; evidence_source := jsonb_build_array('Google Calendar','manual tracking');
    planning_strategy := 'sequence concrete deliverables into weekly execution blocks, review dependencies and verify the finished outcome'; confidence := 0.96;
  elsif t ~ '(save|saving|savings|money|budget|financial|finance)' then
    category := 'Finance'; goal_type := 'Saving'; metric := 'money saved, contribution consistency';
    evidence := jsonb_build_array('manual savings updates','milestones'); evidence_source := jsonb_build_array('manual tracking');
    planning_strategy := 'establish a baseline, define a realistic target, create repeatable saving actions and review progress'; confidence := 0.96;
  elsif t ~ '(learn|learning|master|mastery|teach myself|practice|practise|skill|improve my skills|develop a skill)' then
    category := 'Skill Development'; goal_type := 'Skill Acquisition'; metric := 'skills mastered, practice sessions, completed applications or projects';
    evidence := jsonb_build_array('practice sessions','skills completed','real-world applications or finished projects');
    planning_strategy := 'identify the skill baseline, teach fundamentals, practise progressively, apply the skill and assess against the desired outcome'; confidence := 0.82;
  end if;

  if t ~ '(\\d+(?:\\.\\d+)?)\\s*(km|kilometres?|kilometers?|miles?|mi|pages?|books?|hours?|hrs?|minutes?|mins?|sessions?|repetitions?|reps?|days?|weeks?)' then
    target := (regexp_match(t, '(\\d+(?:\\.\\d+)?)\\s*(km|kilometres?|kilometers?|miles?|mi|pages?|books?|hours?|hrs?|minutes?|mins?|sessions?|repetitions?|reps?|days?|weeks?)'))[1] || ' ' || (regexp_match(t, '(\\d+(?:\\.\\d+)?)\\s*(km|kilometres?|kilometers?|miles?|mi|pages?|books?|hours?|hrs?|minutes?|mins?|sessions?|repetitions?|reps?|days?|weeks?)'))[2];
  end if;
  if t ~ '\\b(5k|10k|half marathon|marathon)\\b' then target := coalesce(target,(regexp_match(t,'\\b(5k|10k|half marathon|marathon)\\b'))[1]); end if;
  if t ~ '\\b(?:under|below|within)\\s+(\\d+(?:\\.\\d+)?)\\s*(hours?|hrs?|minutes?|mins?)\\b' then time_target := (regexp_match(t,'\\b(?:under|below|within)\\s+(\\d+(?:\\.\\d+)?)\\s*(hours?|hrs?|minutes?|mins?)\\b'))[0]; secondary_metric := 'time'; elsif t ~ '\\b(?:under|below|within)\\s+(?:an?|one)\\s+hour\\b' then time_target := 'under 60 minutes'; secondary_metric := 'time'; end if;
  if t ~ '\\b(?:reduce|decrease|lower|cut|spend less)\\b' then direction := 'decrease';
  elsif t ~ '\\b(?:maintain|keep|sustain)\\b' then direction := 'maintain';
  elsif t ~ '\\b(?:finish|complete|ship|submit|deliver|make|create)\\b' then direction := 'complete';
  elsif t ~ '\\b(?:improve|increase|grow|raise|more|faster|better)\\b' then direction := 'increase';
  elsif t ~ '\\b(?:build|develop|establish|learn|practice|practise|master)\\b' then direction := 'build';
  end if;

  if category in ('Sports') and goal_type in ('Running','Cycling','Swimming') and t ~ '\\b(?:marathon|half marathon|10k|10 km|5k|5 km|50 km|100 km)\\b' and t ~ '\\bin\\s+(?:[1-3]\\s+(?:days?|weeks?)|a\\s+few\\s+days)\\b' then
    safety_flag := true; safety_note := 'The timeframe is aggressive for an endurance target. VOW should preserve the stated outcome but prioritise a realistic workload and avoid sudden increases.';
  end if;

  return jsonb_build_object(
    'category',category,'goal_type',goal_type,'metric',metric,'target',target,'direction',direction,
    'secondary_metric',secondary_metric,'time_target',time_target,'evidence',evidence,'evidence_source',evidence_source,
    'integration',integration,'planning_strategy',planning_strategy,'needs_clarification',true,
    'clarification_reasons',jsonb_build_array('Ask 2–3 goal-specific questions about starting level, desired outcome and practical constraints. Blank answers mean Level 1 beginner assumptions.'),
    'safety_flag',safety_flag,'safety_note',safety_note,
    'fallback','If follow-up answers are blank, generate a sensible Level 1 beginner plan rather than inventing experience.',
    'confidence',confidence
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
declare analysis jsonb;
begin
  analysis := public.armadillo_analyse_goal(NEW.title,NEW.outcome,NEW.why_it_matters);
  NEW.plan_json := coalesce(NEW.plan_json,'{}'::jsonb) || jsonb_build_object('armadillo',analysis);
  return NEW;
end;
$$;

drop trigger if exists trg_attach_armadillo_to_goal on public.goals;
create trigger trg_attach_armadillo_to_goal
before insert or update of title,outcome,why_it_matters,plan_json
on public.goals for each row execute function public.attach_armadillo_to_goal();
