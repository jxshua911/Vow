-- Armadillo canonicalisation hardening.
-- Extends the existing classifier without replacing its routing catalogue.

ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS armadillo_version text;

DO $migration$
DECLARE
  src text;
BEGIN
  SELECT pg_get_functiondef('public.armadillo_analyse_goal(text,text,text)'::regprocedure)
    INTO src;

  IF src IS NULL THEN
    RAISE EXCEPTION 'armadillo_analyse_goal(text,text,text) not found';
  END IF;

  src := replace(src,
    'confidence numeric:=0.55; safety_flag boolean:=false; safety_note text:=null; target_match text[]; time_match text[];',
    'confidence numeric:=0.55; safety_flag boolean:=false; safety_note text:=null; target_match text[]; time_match text[]; secondary_domains jsonb:=jsonb_build_array(); intents jsonb:=jsonb_build_array(); safety_severity text:=null; has_timeframe boolean:=false; has_target boolean:=false; target_raw text:=null; target_unit text:=null;');

  src := replace(src,
    $$target_match:=regexp_match(t,'([0-9]+([.][0-9]+)?[[:space:]]*(km|kilometres?|kilometers?|miles?|mi|pages?|books?|hours?|hrs?|minutes?|mins?|sessions?|repetitions?|reps?|days?|weeks?))');
 if target_match is not null then target:=target_match[1]; elsif t~'(5k|10k|half marathon|marathon)' then target:=(regexp_match(t,'(5k|10k|half marathon|marathon)'))[1]; end if;
 time_match:=regexp_match(t,'((under|below|within)[[:space:]]+([0-9]+([.][0-9]+)?)[[:space:]]*(hours?|hrs?|minutes?|mins?))');
 if time_match is not null then time_target:=time_match[1];secondary_metric:='time'; elsif t~'under[[:space:]]+(an?|one)[[:space:]]+hour' then time_target:='under 60 minutes';secondary_metric:='time'; end if;$$,
    $$target_match:=regexp_match(t,'([£$€][[:space:]]*[0-9]+(?:[,.][0-9]+)?|[0-9]+(?:[.][0-9]+)?[[:space:]]*(km|kilometres?|kilometers?|miles?|mi|pages?|books?|hours?|hrs?|minutes?|mins?|sessions?|repetitions?|reps?|days?|weeks?|kg|kilograms?|%))');
 if target_match is not null then target:=target_match[1]; elsif t~'(5k|10k|half marathon|marathon)' then target:=(regexp_match(t,'(5k|10k|half marathon|marathon)'))[1]; elsif t~'\\b(?:at least|minimum of)[[:space:]]+[0-9]+(?:[.][0-9]+)?[[:space:]]*(?:times?[[:space:]]+a[[:space:]]+week|sessions?|reps?|repetitions?|pages?|books?|hours?|days?|weeks?)\\b' then target:=(regexp_match(t,'\\b(?:at least|minimum of)[[:space:]]+[0-9]+(?:[.][0-9]+)?[[:space:]]*(?:times?[[:space:]]+a[[:space:]]+week|sessions?|reps?|repetitions?|pages?|books?|hours?|days?|weeks?)\\b'))[0]; elsif t~'\\b(?:an?[[:space:]]+)?[abc](?:[+-])?[[:space:]]*grade\\b|\\bdistinction\\b|\\bpass\\b' then target:=(regexp_match(t,'\\b(?:an?[[:space:]]+)?[abc](?:[+-])?[[:space:]]*grade\\b|\\bdistinction\\b|\\bpass\\b'))[0]; end if;
 time_match:=regexp_match(t,'((?:under|below|sub)[[:space:]]*-?[0-9]+(?:[.][0-9]+)?[[:space:]]*(hours?|hrs?|minutes?|mins?))');
 if time_match is not null then time_target:=time_match[1];secondary_metric:='time';has_timeframe:=true; elsif t~'under[[:space:]]+(an?|one)[[:space:]]+hour' then time_target:='under 60 minutes';secondary_metric:='time';has_timeframe:=true; elsif t~'\\b(?:by|before|within|in)[[:space:]]+(?:tomorrow|today|this year|next year|christmas|january|february|march|april|may|june|july|august|september|october|november|december|[0-9]+[[:space:]]+(?:days?|weeks?|months?))\\b' then has_timeframe:=true; end if;
 if target is not null then has_target:=true; end if;
 if target is not null then target_raw:=target; target_unit:=case when target~*'£|\\$|€' then 'currency' when target~*'%' then 'percent' when target~*'\\bkg|kilograms?\\b' then 'kg' when target~*'times?[[:space:]]+a[[:space:]]+week' then 'times/week' when target~*'\\bminutes?|mins?\\b' then 'minutes' when target~*'\\bhours?|hrs?\\b' then 'hours' when target~*'\\bkm|kilometres?|kilometers?\\b' then 'km' when target~*'\\bmiles?|mi\\b' then 'miles' when target~*'\\bpages?\\b' then 'pages' when target~*'\\bbooks?\\b' then 'books' when target~*'\\bsessions?\\b' then 'sessions' when target~*'\\breps?|repetitions?\\b' then 'repetitions' when target~*'\\bdays?\\b' then 'days' when target~*'\\bweeks?\\b' then 'weeks' else null end; end if;$$
  );

  src := replace(src,
    $$target_match:=regexp_match(t,$$,
    $$-- Detect secondary domains without changing primary routing.
 if t~'\\b(?:football|soccer|match|dribbling|passing|shooting|defending)\\b' and goal_type<>'Football' then secondary_domains:=secondary_domains||jsonb_build_array('Football'); end if;
 if t~'\\b(?:run|running|5k|5 km|10k|10 km|marathon|half marathon|jog)\\b' and goal_type<>'Running' then secondary_domains:=secondary_domains||jsonb_build_array('Running'); end if;
 if t~'\\b(?:cycle|cycling|bike|biking|ride|riding|kilometre|kilometer)\\b' and goal_type<>'Cycling' then secondary_domains:=secondary_domains||jsonb_build_array('Cycling'); end if;
 if t~'\\b(?:swim|swimming|pool|freestyle|backstroke|breaststroke|butterfly|laps)\\b' and goal_type<>'Swimming' then secondary_domains:=secondary_domains||jsonb_build_array('Swimming'); end if;
 if t~'\\b(?:bulk|muscle|strength|dumbbell|dumbbells|resistance training|weight training|hypertrophy)\\b' and goal_type<>'Strength Training' then secondary_domains:=secondary_domains||jsonb_build_array('Strength'); end if;
 if t~'\\b(?:python|javascript|typescript|programming|coding|code|app development|build an app|software)\\b' and goal_type<>'Programming' then secondary_domains:=secondary_domains||jsonb_build_array('Programming'); end if;
 if t~'\\b(?:study|studying|revise|revision|exam|homework|maths|mathematics|physics|chemistry|biology)\\b' and goal_type<>'Study' then secondary_domains:=secondary_domains||jsonb_build_array('Study'); end if;
 if t~'\\b(?:save|saving|savings|money|budget|financial|finance|£|\\$|€)\\b' and goal_type<>'Saving' then secondary_domains:=secondary_domains||jsonb_build_array('Saving'); end if;
 if t~'\\b(?:learn|learning|master|mastery|practice|practise|skill)\\b' and goal_type<>'Skill Acquisition' and goal_type<>'Study' then secondary_domains:=secondary_domains||jsonb_build_array('Learning'); end if;
 if t~'\\b(?:and|while|as well as)\\b' and jsonb_array_length(secondary_domains)>0 then intents:=jsonb_build_array(jsonb_build_object('domain',category,'type',goal_type)); FOR i IN 0..jsonb_array_length(secondary_domains)-1 LOOP intents:=intents||jsonb_build_array(jsonb_build_object('domain',secondary_domains->>i,'type',secondary_domains->>i)); END LOOP; end if;
 target_match:=regexp_match(t,$$
  );

  src := replace(src,
    $$if goal_type in ('Running','Cycling','Swimming') and t~'(marathon|half marathon|10k|10 km|5k|5 km|50 km|100 km)' and t~'(in[[:space:]]+([1-3][[:space:]]+(days?|weeks?)|a[[:space:]]+few[[:space:]]+days))' then safety_flag:=true;safety_note:='The timeframe is aggressive for an endurance target. Keep the goal visible but prioritise a realistic workload and avoid sudden increases.'; end if;$$,
    $$if goal_type in ('Running','Cycling','Swimming') and t~'\\bmarathon\\b' and t~'\\b(?:tomorrow|today)\\b' then safety_flag:=true;safety_severity:='high';safety_note:='This target is physiologically unsafe on the stated timeframe, especially without training. The planner must not prescribe an attempt at the target and should restructure around a safer progression.'; elsif goal_type in ('Running','Cycling','Swimming') and t~'\\b(?:marathon|half marathon|10k|10 km|5k|5 km|50 km|100 km)\\b' and t~'\\b(?:in[[:space:]]+([1-3][[:space:]]+(?:days?|weeks?))|a[[:space:]]+few[[:space:]]+days)\\b' then safety_flag:=true;safety_severity:='moderate';safety_note:='The timeframe is aggressive for an endurance target. The planner should constrain workload, add checkpoints and avoid sudden increases.'; end if;$$
  );

  src := replace(src,
    $$return jsonb_build_object('category',category,'goal_type',goal_type,'metric',metric,'target',target,'direction',direction,'secondary_metric',secondary_metric,'time_target',time_target,'evidence',evidence,'evidence_source',evidence_source,'integration',integration,'planning_strategy',planning_strategy,'needs_clarification',true,'clarification_reasons',jsonb_build_array('Ask 2–3 goal-specific questions about starting level, desired outcome and practical constraints. Blank answers mean Level 1 beginner assumptions.'),'safety_flag',safety_flag,'safety_note',safety_note,'fallback','If follow-up answers are blank, generate a sensible Level 1 beginner plan rather than inventing experience.','confidence',confidence);$$,
    $$if t~'\\b(?:by|before|within|in|tomorrow|today)\\b' then has_timeframe:=true; end if;
 if length(trim(t))<5 then confidence:=greatest(0.5,confidence-0.1); end if;
 if not has_target then confidence:=greatest(0.5,confidence-0.1); end if;
 if not has_timeframe then confidence:=greatest(0.5,confidence-0.1); end if;
 if jsonb_array_length(intents)>0 then confidence:=greatest(0.5,confidence-0.1); end if;
 if category='General' then confidence:=least(0.5,confidence); end if;
 if safety_severity is null and safety_flag=false and t~'\\b(?:ambitious|challenging|stretch)\\b' then safety_severity:='low'; end if;
 return jsonb_build_object('category',category,'goal_type',goal_type,'metric',metric,'target',target,'target_raw',target_raw,'target_unit',target_unit,'direction',direction,'secondary_metric',secondary_metric,'time_target',time_target,'evidence',evidence,'evidence_source',evidence_source,'integration',integration,'planning_strategy',planning_strategy,'needs_clarification',true,'clarification_reasons',jsonb_build_array('Ask 2–3 goal-specific questions about starting level, desired outcome and practical constraints. Blank answers mean Level 1 beginner assumptions.'),'safety_flag',safety_flag,'safety_note',safety_note,'safety_severity',safety_severity,'multi_intent',jsonb_array_length(intents)>0,'intents',intents,'secondary_domains',secondary_domains,'fallback','If follow-up answers are blank, generate a sensible Level 1 beginner plan rather than inventing experience.','confidence',confidence);$$
  );

  EXECUTE src;
END
$migration$;
