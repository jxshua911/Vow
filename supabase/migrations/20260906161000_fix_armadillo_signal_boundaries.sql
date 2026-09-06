DO $migration$
DECLARE src text; pos integer; inject text;
BEGIN
 SELECT pg_get_functiondef('public.armadillo_analyse_goal(text,text,text)'::regprocedure) INTO src;
 pos:=strpos(src,'target_match:=regexp_match(t,');
 IF pos=0 THEN RAISE EXCEPTION 'Armadillo target extraction anchor not found'; END IF;
 inject:=$inject$
if t~'(^|[^a-z])(football|soccer|match|dribbling|passing|shooting|defending)([^a-z]|$)' and goal_type<>'Football' then secondary_domains:=secondary_domains||jsonb_build_array('Football'); end if;
if t~'(^|[^a-z])(run|running|5k|5 km|10k|10 km|marathon|half marathon|jog)([^a-z]|$)' and goal_type<>'Running' then secondary_domains:=secondary_domains||jsonb_build_array('Running'); end if;
if t~'(^|[^a-z])(cycle|cycling|bike|biking|ride|riding|kilometre|kilometer)([^a-z]|$)' and goal_type<>'Cycling' then secondary_domains:=secondary_domains||jsonb_build_array('Cycling'); end if;
if t~'(^|[^a-z])(swim|swimming|pool|freestyle|backstroke|breaststroke|butterfly|laps)([^a-z]|$)' and goal_type<>'Swimming' then secondary_domains:=secondary_domains||jsonb_build_array('Swimming'); end if;
if t~'(^|[^a-z])(bulk|muscle|strength|dumbbell|dumbbells|resistance training|weight training|hypertrophy)([^a-z]|$)' and goal_type<>'Strength Training' then secondary_domains:=secondary_domains||jsonb_build_array('Strength'); end if;
if t~'(^|[^a-z])(python|javascript|typescript|programming|coding|code|app development|build an app|software)([^a-z]|$)' and goal_type<>'Programming' then secondary_domains:=secondary_domains||jsonb_build_array('Programming'); end if;
if t~'(^|[^a-z])(study|studying|revise|revision|exam|homework|maths|mathematics|physics|chemistry|biology)([^a-z]|$)' and goal_type<>'Study' then secondary_domains:=secondary_domains||jsonb_build_array('Study'); end if;
if t~'(^|[^a-z])(save|saving|savings|money|budget|financial|finance|£|\$|€)([^a-z]|$)' and goal_type<>'Saving' then secondary_domains:=secondary_domains||jsonb_build_array('Saving'); end if;
if t~'(^|[^a-z])(learn|learning|master|mastery|practice|practise|skill)([^a-z]|$)' and goal_type<>'Skill Acquisition' and goal_type<>'Study' then secondary_domains:=secondary_domains||jsonb_build_array('Learning'); end if;
if t~'(^|[^a-z])(and|while|as well as)([^a-z]|$)' and jsonb_array_length(secondary_domains)>0 then intents:=jsonb_build_array(jsonb_build_object('domain',category,'type',goal_type)); FOR i IN 0..jsonb_array_length(secondary_domains)-1 LOOP intents:=intents||jsonb_build_array(jsonb_build_object('domain',secondary_domains->>i,'type',secondary_domains->>i)); END LOOP; end if;
if target is null and t~'(^|[^a-z])(at least|minimum of)[[:space:]]+[0-9]+([.][0-9]+)?[[:space:]]*(times?[[:space:]]+a[[:space:]]+week|sessions?|reps?|repetitions?|pages?|books?|hours?|days?|weeks?)([^a-z]|$)' then target:=(regexp_match(t,'(^|[^a-z])((at least|minimum of)[[:space:]]+[0-9]+([.][0-9]+)?[[:space:]]*(times?[[:space:]]+a[[:space:]]+week|sessions?|reps?|repetitions?|pages?|books?|hours?|days?|weeks?))([^a-z]|$)'))[2]; end if;
if target is null and t~'(^|[^a-z])(an?[[:space:]]+)?[abc](?:[+-])?[[:space:]]*grade([^a-z]|$)|(^|[^a-z])(distinction|pass)([^a-z]|$)' then target:=coalesce((regexp_match(t,'(^|[^a-z])((?:an?[[:space:]]+)?[abc](?:[+-])?[[:space:]]*grade)([^a-z]|$)'))[2],(regexp_match(t,'(^|[^a-z])(distinction|pass)([^a-z]|$)'))[2]); end if;
if target is not null then target_raw:=target; if target~*'£|\$|€' then target_unit:='currency'; elsif target~*'%' then target_unit:='percent'; elsif target~*'kg|kilograms?' then target_unit:='kg'; elsif target~*'times?[[:space:]]+a[[:space:]]+week' then target_unit:='times/week'; elsif target~*'minutes?|mins?' then target_unit:='minutes'; elsif target~*'hours?|hrs?' then target_unit:='hours'; elsif target~*'km|kilometres?|kilometers?' then target_unit:='km'; elsif target~*'miles?|mi' then target_unit:='miles'; elsif target~*'pages?' then target_unit:='pages'; elsif target~*'books?' then target_unit:='books'; elsif target~*'sessions?' then target_unit:='sessions'; elsif target~*'reps?|repetitions?' then target_unit:='repetitions'; elsif target~*'days?' then target_unit:='days'; elsif target~*'weeks?' then target_unit:='weeks'; elsif target~*'grade|distinction|pass' then target_unit:='grade'; end if; has_target:=true; end if;
if goal_type in ('Running','Cycling','Swimming') and t~'(^|[^a-z])marathon([^a-z]|$)' and t~'(^|[^a-z])(tomorrow|today)([^a-z]|$)' then safety_flag:=true; safety_severity:='high'; safety_note:='This target is physiologically unsafe on the stated timeframe. The planner must restructure around a safer progression rather than prescribe the target attempt.'; elsif goal_type in ('Running','Cycling','Swimming') and t~'(^|[^a-z])(marathon|half marathon|10k|10 km|5k|5 km|50 km|100 km)([^a-z]|$)' and t~'(^|[^a-z])in[[:space:]]+([1-3][[:space:]]+(days?|weeks?)|a[[:space:]]+few[[:space:]]+days)([^a-z]|$)' then safety_flag:=true; safety_severity:='moderate'; safety_note:='The timeframe is aggressive for an endurance target. Constrain workload, add checkpoints and avoid sudden increases.'; end if;
if t~'(^|[^a-z])(by|before|within|in|tomorrow|today)([^a-z]|$)' then has_timeframe:=true; end if;
if length(trim(t))<5 then confidence:=greatest(0.5,confidence-0.1); end if;
if not has_target then confidence:=greatest(0.5,confidence-0.1); end if;
if not has_timeframe then confidence:=greatest(0.5,confidence-0.1); end if;
if jsonb_array_length(intents)>0 then confidence:=greatest(0.5,confidence-0.1); end if;
if category='General' then confidence:=0.5; end if;
$inject$;
 src:=left(src,pos-1)||inject||substring(src from pos);
 EXECUTE src;
END $migration$;
