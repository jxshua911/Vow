-- Fine-tune knowledge retrieval without changing the public return shape.
-- Keeps the planner's existing structured knowledge fields intact while improving routing.
create or replace function public.match_vow_knowledge_keyword(query_text text, domain_filter text default null, match_count integer default 8)
returns table (id uuid, domain text, topic text, title text, content text, principles jsonb, recommended_actions jsonb, metrics jsonb, cautions jsonb, source_url text, score real)
language sql stable security definer set search_path = public, pg_temp
as $$
with raw as (select lower(trim(coalesce(query_text,''))) as q),
intents as (
 select q, array_remove(array[
 case when q ~ '(^|[^a-z])(bulk|muscle|strength|dumbbell|dumbbells|resistance|hypertrophy|weight training|gym|workout)([^a-z]|$)' then 'strength' end,
 case when q ~ '(^|[^a-z])(10k|10 km|run|running|5k|5 km|marathon|jog)([^a-z]|$)' then 'running' end,
 case when q ~ '(^|[^a-z])(cycle|cycling|bike|biking|80km|80 km|ride|riding)([^a-z]|$)' then 'cycling' end,
 case when q ~ '(^|[^a-z])(swim|swimming|pool|freestyle|backstroke|breaststroke|butterfly|laps|1km|1 km)([^a-z]|$)' then 'swimming' end,
 case when q ~ '(^|[^a-z])(football|soccer|dribbling|dribble|passing|shooting|defending)([^a-z]|$)' then 'football' end,
 case when q ~ '(^|[^a-z])(basketball|layup|free throw)([^a-z]|$)' then 'basketball' end,
 case when q ~ '(^|[^a-z])(tennis|serve|forehand|backhand|racket)([^a-z]|$)' then 'tennis' end,
 case when q ~ '(^|[^a-z])(golf|putting|driving range|golf swing)([^a-z]|$)' then 'golf' end,
 case when q ~ '(^|[^a-z])(surf|surfing|surfboard|wave|waves)([^a-z]|$)' then 'surfing' end,
 case when q ~ '(^|[^a-z])(dance|dancing|ballet|salsa|contemporary)([^a-z]|$)' then 'dance' end,
 case when q ~ '(^|[^a-z])(chess|checkmate|opening)([^a-z]|$)' then 'chess' end,
 case when q ~ '(^|[^a-z])(volleyball|serve receive|spike)([^a-z]|$)' then 'volleyball' end,
 case when q ~ '(^|[^a-z])(mathematics|maths|algebra|calculus)([^a-z]|$)' then 'mathematics' end,
 case when q ~ '(^|[^a-z])(exam|exams|revision|revise|study|studying)([^a-z]|$)' then 'exam_preparation' end,
 case when q ~ '(^|[^a-z])(spanish|french|german|italian|portuguese|arabic|swahili|japanese|korean|mandarin|chinese|conversational|language)([^a-z]|$)' then 'language_learning' end,
 case when q ~ '(^|[^a-z])(mobile app|app development)([^a-z]|$)' then 'mobile_development' end,
 case when q ~ '(^|[^a-z])(cybersecurity|cyber security)([^a-z]|$)' then 'cybersecurity_basics' end,
 case when q ~ '(^|[^a-z])(data science|data analysis)([^a-z]|$)' then 'data_science' end,
 case when q ~ '(^|[^a-z])(github|commit|pull request|contribution)([^a-z]|$)' then 'github' end,
 case when q ~ '(^|[^a-z])(programming|coding|code|python|javascript|typescript|java)([^a-z]|$)' then 'programming' end,
 case when q ~ '(^|[^a-z])(read|reading|book|books|pages)([^a-z]|$)' then 'reading' end,
 case when q ~ '(^|[^a-z])(short story|story|writing|write|novel|poetry|screenplay)([^a-z]|$)' then 'story' end,
 case when q ~ '(^|[^a-z])guitar([^a-z]|$)' then 'guitar' end,
 case when q ~ '(^|[^a-z])(music|piano|keyboard|drums|violin|ukulele|instrument|singing|vocals)([^a-z]|$)' then 'music' end,
 case when q ~ '(^|[^a-z])(photograph|photography|camera|portrait)([^a-z]|$)' then 'photography' end,
 case when q ~ '(^|[^a-z])(draw|drawing|sketch|illustration)([^a-z]|$)' then 'drawing' end,
 case when q ~ '(^|[^a-z])(paint|painting|watercolour|watercolor|acrylic|oil painting)([^a-z]|$)' then 'painting' end,
 case when q ~ '(^|[^a-z])(knit|knitting|purl|cast on)([^a-z]|$)' then 'knitting' end,
 case when q ~ '(^|[^a-z])(crochet|crocheting|amigurumi)([^a-z]|$)' then 'crochet' end,
 case when q ~ '(^|[^a-z])(sew|sewing|seam|embroidery|needlework)([^a-z]|$)' then 'sewing' end,
 case when q ~ '(^|[^a-z])(pottery|ceramics|clay|wheel throwing)([^a-z]|$)' then 'pottery' end,
 case when q ~ '(^|[^a-z])(animation|animate)([^a-z]|$)' then 'animation' end,
 case when q ~ '(^|[^a-z])(graphic design|design)([^a-z]|$)' then 'graphic_design' end,
 case when q ~ '(^|[^a-z])(video editing|edit videos)([^a-z]|$)' then 'video_editing' end,
 case when q ~ '(^|[^a-z])(cook|cooking|baking|recipe|meals|culinary)([^a-z]|$)' then 'cooking' end,
 case when q ~ '(^|[^a-z])(woodworking|woodwork|carpentry)([^a-z]|$)' then 'woodworking' end,
 case when q ~ '(^|[^a-z])(electronics|electronic)([^a-z]|$)' then 'electronics' end,
 case when q ~ '(^|[^a-z])(gardening|garden)([^a-z]|$)' then 'gardening' end,
 case when q ~ '(^|[^a-z])(diy|home maintenance|home repair)([^a-z]|$)' then 'diy' end,
 case when q ~ '(^|[^a-z])(save|saving|savings|budget|money|finance|dollars)([^a-z]|$)' then 'saving' end,
 case when q ~ '(^|[^a-z])cashflow([^a-z]|$)' then 'cashflow' end,
 case when q ~ '(^|[^a-z])(meditat|meditation|mindfulness)([^a-z]|$)' then 'mindfulness' end,
 case when q ~ '(^|[^a-z])stress([^a-z]|$)' then 'stress_management' end,
 case when q ~ '(^|[^a-z])sleep([^a-z]|$)' then 'sleep' end,
 case when q ~ '(^|[^a-z])routine([^a-z]|$)' then 'routine' end,
 case when q ~ 'public speaking|public speaker|(^|[^a-z])(presentation|presenting|speech|debate)([^a-z]|$)' then 'public_speaking' end,
 case when q ~ '(^|[^a-z])listening([^a-z]|$)' then 'listening' end,
 case when q ~ '(^|[^a-z])conversation([^a-z]|$)' then 'conversation' end,
 case when q ~ '(^|[^a-z])feedback([^a-z]|$)' then 'feedback' end,
 case when q ~ '(^|[^a-z])negotiation([^a-z]|$)' then 'negotiation' end,
 case when q ~ '(^|[^a-z])teamwork([^a-z]|$)' then 'teamwork' end,
 case when q ~ '(^|[^a-z])(travel|trip abroad|solo trip|itinerary|destination|holiday|flight)([^a-z]|$)' then 'trip_planning' end,
 case when q ~ '(^|[^a-z])(culture|cultural)([^a-z]|$)' then 'cultural_learning' end,
 case when q ~ '(^|[^a-z])mvp([^a-z]|$)' then 'mvp' end,
 case when q ~ '(^|[^a-z])(customer research|customer discovery|customer interviews)([^a-z]|$)' then 'customer_research' end,
 case when q ~ '(^|[^a-z])(marketing|brand)([^a-z]|$)' then 'marketing' end,
 case when q ~ '(^|[^a-z])sales([^a-z]|$)' then 'sales' end,
 case when q ~ '(^|[^a-z])(business model|entrepreneur)([^a-z]|$)' then 'entrepreneurship' end,
 case when q ~ '(^|[^a-z])product management([^a-z]|$)' then 'product_management' end,
 case when q ~ '(^|[^a-z])competitive analysis([^a-z]|$)' then 'competitive_analysis' end,
 case when q ~ '(^|[^a-z])project([^a-z]|$)' then 'project_execution' end,
 case when q ~ '(^|[^a-z])focus([^a-z]|$)' then 'focus' end,
 case when q ~ 'time management' then 'time_management' end,
 case when q ~ 'priorit' then 'prioritisation' end,
 case when q ~ '(^|[^a-z])planning([^a-z]|$)' then 'planning' end,
 case when q ~ '(critical thinking|think critically|critical thinker)' then 'critical_thinking' end,
 case when q ~ 'problem solving' then 'problem_solving' end,
 case when q ~ 'note taking' then 'note_taking' end,
 case when q ~ '(^|[^a-z])memory([^a-z]|$)' then 'memory' end,
 case when q ~ 'deliberate practice' then 'deliberate_practice' end,
 case when q ~ '(^|[^a-z])research([^a-z]|$)' then 'research' end,
 case when q ~ 'skill progression' then 'skill_progression' end,
 case when q ~ 'teaching others' then 'teaching_others' end,
 case when q ~ '(^|[^a-z])habit(s)?([^a-z]|$)' then 'habits' end,
 case when q ~ '(^|[^a-z])discipline([^a-z]|$)' then 'discipline' end,
 case when q ~ '(^|[^a-z])confidence([^a-z]|$)' then 'confidence' end,
 case when q ~ '(decision making|make better decisions|decision)' then 'decision_making' end,
 case when q ~ '(goal setting|goals)' then 'goal_setting' end,
 case when q ~ 'reflection' then 'reflection' end,
 case when q ~ 'declutter' then 'decluttering' end,
 case when q ~ 'school admin' then 'school_admin' end,
 case when q ~ 'digital hygiene' then 'digital_hygiene' end,
 case when q ~ '(job search|career|resume|cv|interview|employment|internship)' then 'job_search' end,
 case when q ~ 'portfolio' then 'portfolio' end,
 case when q ~ 'engineering' then 'engineering' end,
 case when q ~ 'professional skills' then 'professional_skills' end
 ], null) as topics
 from raw
), classified as (
 select i.*, case
  when 'strength'=any(i.topics) then 'fitness'
  when exists(select 1 from unnest(i.topics)t where t in ('running','cycling','swimming','football','basketball','tennis','golf','surfing','dance','chess','volleyball')) then 'sports'
  when exists(select 1 from unnest(i.topics)t where t in ('mathematics','exam_preparation')) then 'education'
  when 'language_learning'=any(i.topics) then 'languages'
  when exists(select 1 from unnest(i.topics)t where t in ('mobile_development','cybersecurity_basics','data_science','github','programming')) then 'technology'
  when 'reading'=any(i.topics) then 'reading'
  when exists(select 1 from unnest(i.topics)t where t in ('story','guitar','music','photography','drawing','painting','knitting','crochet','sewing','pottery','animation','graphic_design','video_editing')) then 'creative'
  when exists(select 1 from unnest(i.topics)t where t in ('cooking','woodworking','electronics','gardening','diy')) then 'practical'
  when exists(select 1 from unnest(i.topics)t where t in ('saving','cashflow')) then 'finance'
  when exists(select 1 from unnest(i.topics)t where t in ('job_search','portfolio','engineering','professional_skills')) then 'career'
  when exists(select 1 from unnest(i.topics)t where t in ('mindfulness','stress_management','sleep','routine')) then 'wellbeing'
  when exists(select 1 from unnest(i.topics)t where t in ('public_speaking','listening','conversation','feedback','negotiation','teamwork')) then 'communication'
  when exists(select 1 from unnest(i.topics)t where t in ('trip_planning','cultural_learning')) then 'travel'
  when exists(select 1 from unnest(i.topics)t where t in ('mvp','customer_research','marketing','sales','entrepreneurship','product_management','competitive_analysis')) then 'business'
  when 'project_execution'=any(i.topics) then 'projects'
  when exists(select 1 from unnest(i.topics)t where t in ('focus','time_management','prioritisation','planning')) then 'productivity'
  when exists(select 1 from unnest(i.topics)t where t in ('critical_thinking','problem_solving','note_taking','memory','deliberate_practice','research','skill_progression','teaching_others')) then 'learning'
  when exists(select 1 from unnest(i.topics)t where t in ('habits','discipline','confidence','decision_making','goal_setting','reflection')) then 'personal_development'
  when exists(select 1 from unnest(i.topics)t where t in ('decluttering','school_admin','digital_hygiene')) then 'life_admin'
  else null end as inferred_domain from intents i
), candidates as (
 select k.*, c.topics,c.inferred_domain,(case when c.inferred_domain is not null and lower(k.domain)=c.inferred_domain then 8 else 0 end + case when lower(k.topic)=any(c.topics) then 25 else 0 end + case when exists(select 1 from unnest(c.topics)t where lower(k.topic) like t||'%') then 8 else 0 end)::real score
 from public.vow_knowledge k cross join classified c
 where k.active=true and (domain_filter is null or lower(k.domain)=lower(domain_filter)) and (domain_filter is not null or c.inferred_domain is null or lower(k.domain)=c.inferred_domain)
), allowed as (
 select * from candidates c where c.inferred_domain is null or lower(c.topic)=any(c.topics) or exists(select 1 from unnest(c.topics)t where lower(c.topic) like t||'%') or (c.inferred_domain='career' and lower(c.topic) in ('job_search','cv_resume','portfolio','engineering','professional_skills')) or (c.inferred_domain='education' and lower(c.topic) in ('mathematics fundamentals','mathematics','exam_preparation','exams','revision','study','study_skills')) or (c.inferred_domain='creative' and lower(c.topic) in ('writing','story structure','finishing work','music','guitar','photography fundamentals','photography')) or (c.inferred_domain='travel' and lower(c.topic) in ('trip planning','travel planning','itinerary','planning','cultural learning'))
)
select id,domain,topic,title,content,principles,recommended_actions,metrics,cautions,source_url,score from allowed where score>0 order by score desc,title asc limit least(greatest(coalesce(match_count,8),1),20);
$$;
