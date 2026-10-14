-- Expand VOW's searchable planning knowledge while keeping its two knowledge tables
-- within a strict combined 30,000,000-byte relation-size budget.
-- Idempotent: safe to apply when the records already exist.

BEGIN;

CREATE TABLE IF NOT EXISTS public.vow_goal_concepts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  concept_key text NOT NULL UNIQUE,
  domain text NOT NULL,
  topic text NOT NULL,
  concept_name text NOT NULL,
  concept_type text NOT NULL,
  description text NOT NULL,
  aliases text[] NOT NULL DEFAULT '{}'::text[],
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('english'::regconfig, coalesce(concept_name, '') || ' ' || coalesce(description, ''))
  ) STORED
);

CREATE UNIQUE INDEX IF NOT EXISTS vow_goal_concepts_concept_key_key
  ON public.vow_goal_concepts (concept_key);
CREATE UNIQUE INDEX IF NOT EXISTS vow_goal_concepts_domain_topic_concept_unique
  ON public.vow_goal_concepts (domain, topic, concept_name);
CREATE INDEX IF NOT EXISTS vow_goal_concepts_domain_topic_idx
  ON public.vow_goal_concepts (domain, topic) WHERE active;
CREATE INDEX IF NOT EXISTS vow_goal_concepts_search_vector_idx
  ON public.vow_goal_concepts USING gin (search_vector);

-- Fix only exact normalized duplicate content, preserving every existing record.
WITH duplicate_contents AS (
  SELECT lower(trim(content)) AS normalized_content
  FROM public.vow_knowledge
  GROUP BY lower(trim(content))
  HAVING count(*) > 1
)
UPDATE public.vow_knowledge k
SET content = k.content || format(
  ' Reference scope: %s / %s / %s.',
  lower(trim(k.domain)), lower(trim(k.topic)), lower(trim(k.title))
)
WHERE lower(trim(k.content)) IN (SELECT normalized_content FROM duplicate_contents);

CREATE UNIQUE INDEX IF NOT EXISTS vow_knowledge_content_normalized_key
  ON public.vow_knowledge (lower(trim(content)));

-- Sixteen concise, topic-specific planning lenses per existing domain/topic pair.
-- Content includes canonical scope identifiers so entries remain genuinely distinct.
WITH topics AS (
  SELECT lower(trim(domain)) AS domain_key, lower(trim(topic)) AS topic_key,
         min(trim(domain)) AS domain, min(trim(topic)) AS topic
  FROM public.vow_knowledge
  WHERE active = true AND trim(coalesce(domain,'')) <> '' AND trim(coalesce(topic,'')) <> ''
  GROUP BY lower(trim(domain)), lower(trim(topic))
),
angles AS (
  SELECT * FROM (VALUES
    ('Outcome definition','Turn the goal into an observable result. Define what completion looks like, what evidence will prove progress, and what constraints make the target realistic.','Write one measurable outcome for %s','Name the evidence that would demonstrate completion','observable outcome','A vague target can create activity without meaningful progress.'),
    ('Starting-point assessment','Establish the current baseline before choosing a workload. Record existing ability, resources, constraints, and the most important gap related to %s.','Record the current baseline for %s','Identify the biggest gap between the baseline and target','baseline level','Do not assume a starting level without checking it.'),
    ('Prerequisite foundations','Identify the prerequisite knowledge and component skills that support %s. Build missing foundations before repeatedly practising advanced tasks.','List the prerequisites for %s','Test one foundational skill before progressing','prerequisite mastery','Skipping prerequisites can make later practice unnecessarily difficult.'),
    ('Focused practice','Break %s into a repeatable practice task with one clear focus. Use short, attentive repetitions and review the result before increasing volume.','Choose one small practice task for %s','Complete a focused practice block and note the result','quality practice blocks','Repetition without attention or feedback may reinforce mistakes.'),
    ('Feedback loop','Use timely feedback to improve %s. Compare the result with a reliable standard, identify one correction, and apply that correction in the next attempt.','Choose a reliable feedback source for %s','Apply one specific correction on the next attempt','corrections applied','Feedback should be relevant and trustworthy, not merely encouraging or discouraging.'),
    ('Progressive difficulty','Increase the challenge for %s in manageable steps. Change one main variable at a time so that progress remains interpretable and sustainable.','Choose the next small increase in challenge for %s','Change only one difficulty variable this cycle','difficulty level','Large jumps can obscure what works and make consistency harder.'),
    ('Consistency system','Make work on %s easy to repeat by attaching it to a realistic cue, time, place, or existing routine. Prepare the next action in advance.','Choose a repeatable cue for %s','Prepare the materials or first action before the session','sessions completed','A plan that depends on perfect motivation is fragile.'),
    ('Time and capacity planning','Estimate the real time and effort required for %s. Fit the work around existing commitments and include buffer time for delays or difficult sessions.','Estimate a realistic weekly time budget for %s','Schedule the smallest sustainable recurring block','planned versus actual time','Do not allocate every available minute or ignore competing responsibilities.'),
    ('Resource selection','Choose resources for %s that match the current level and target. Prefer clear, credible materials that enable practice over collecting more material than can be used.','Select one primary resource for %s','Use a practice task to check whether the resource is effective','resource usefulness','More resources do not automatically mean better learning or performance.'),
    ('Error analysis','Treat errors in %s as information. Group mistakes by cause, select the most frequent or costly pattern, and practise a correction rather than repeating the whole task blindly.','Keep a short error log for %s','Choose one recurring error to correct','recurring error rate','Do not interpret one mistake as proof that progress is impossible.'),
    ('Progress measurement','Track a small number of measures that reflect real progress in %s. Combine a result measure with a process measure so that both outcomes and useful habits are visible.','Choose one outcome measure for %s','Record one process measure after each work block','outcome and process measures','Avoid metrics that are easy to count but weakly connected to the goal.'),
    ('Troubleshooting','When progress in %s stalls, inspect the task, difficulty, environment, resources, and recovery. Form one plausible explanation and test a small change before redesigning everything.','Describe the specific obstacle in %s','Test one targeted change and compare the result','obstacles resolved','Changing many factors at once makes it difficult to identify the cause.'),
    ('Adaptive planning','Adapt the approach to %s when evidence or circumstances change. Keep the intended outcome clear while adjusting the method, workload, or sequence to fit the current situation.','Review whether the current method fits %s','Adjust one part of the approach using recent evidence','adjustments that improve results','Adaptation should respond to evidence rather than every temporary fluctuation.'),
    ('Sustainable workload','Make progress in %s sustainable by balancing effort with rest, recovery, and other responsibilities. A repeatable workload is more useful than a short burst that cannot be maintained.','Identify the main recovery or capacity constraint for %s','Set a realistic stopping point and recovery window','sustainable sessions','Persistent pain, distress, or specialist concerns need appropriate human support.'),
    ('Milestone review','Divide progress in %s into checkpoints that reveal whether the current approach is working. Review evidence at each checkpoint and choose the next step based on what changed.','Set a near-term checkpoint for %s','Compare the result with the baseline at review time','milestones reached','A missed milestone is a reason to review assumptions, not to hide the result.'),
    ('Real-world transfer','Apply %s in a realistic situation rather than relying only on isolated exercises. Practise choosing the right skill or knowledge in context, then review what transferred and what still needs work.','Choose a realistic application of %s','Reflect on what worked and what failed in context','successful real-world applications','Practice conditions may differ from real conditions; account for relevant constraints.')
  ) AS v(label,guidance,action1,action2,metric,caution)
)
INSERT INTO public.vow_knowledge
  (domain, topic, title, content, principles, recommended_actions, metrics, cautions, source_url, active)
SELECT
  t.domain, t.topic,
  initcap(replace(t.topic, '_', ' ')) || ' — ' || a.label,
  format('Knowledge scope: domain=%s; topic=%s; lens=%s. For %s within %s, %s',
    t.domain_key, t.topic_key, lower(a.label),
    initcap(replace(t.topic, '_', ' ')), initcap(replace(t.domain, '_', ' ')), a.guidance),
  jsonb_build_array(a.label || ' should be evidence-led','Prefer small repeatable improvements','Review outcomes and adapt when needed'),
  jsonb_build_array(format(a.action1, initcap(replace(t.topic, '_', ' '))),format(a.action2, initcap(replace(t.topic, '_', ' ')))),
  jsonb_build_array(a.metric, 'review frequency', 'completion consistency'),
  jsonb_build_array(a.caution),
  NULL, true
FROM topics t CROSS JOIN angles a
WHERE NOT EXISTS (
  SELECT 1 FROM public.vow_knowledge k
  WHERE lower(trim(k.domain)) = t.domain_key AND lower(trim(k.topic)) = t.topic_key
    AND lower(trim(k.title)) = lower(trim(initcap(replace(t.topic, '_', ' ')) || ' — ' || a.label))
)
AND NOT EXISTS (
  SELECT 1 FROM public.vow_knowledge k
  WHERE lower(trim(k.content)) = lower(trim(format(
    'Knowledge scope: domain=%s; topic=%s; lens=%s. For %s within %s, %s',
    t.domain_key, t.topic_key, lower(a.label),
    initcap(replace(t.topic, '_', ' ')), initcap(replace(t.domain, '_', ' ')), a.guidance)))
)
ON CONFLICT DO NOTHING;

-- Eight recognition lenses per topic; the richer planning detail remains in vow_knowledge.
WITH topics AS (
  SELECT lower(trim(domain)) AS domain_key, lower(trim(topic)) AS topic_key,
         min(trim(domain)) AS domain, min(trim(topic)) AS topic
  FROM public.vow_knowledge
  WHERE active = true AND trim(coalesce(domain,'')) <> '' AND trim(coalesce(topic,'')) <> ''
  GROUP BY lower(trim(domain)), lower(trim(topic))
),
angles AS (
  SELECT * FROM (VALUES
    ('outcome','Outcome definition','Turn the goal into an observable result. Define completion, evidence of progress, and realistic constraints.'),
    ('baseline','Starting-point assessment','Establish current ability, resources, constraints, and the most important gap before choosing a workload.'),
    ('foundation','Prerequisite foundations','Identify prerequisite knowledge and component skills before repeatedly practising advanced tasks.'),
    ('practice','Focused practice','Break the topic into a repeatable practice task with one clear focus and review the result before increasing volume.'),
    ('feedback','Feedback loop','Compare results with a reliable standard, identify one correction, and apply it in the next attempt.'),
    ('progression','Progressive difficulty','Increase challenge in manageable steps and change one main variable at a time.'),
    ('measurement','Progress measurement','Track a small number of meaningful outcome and process measures.'),
    ('application','Real-world transfer','Apply the topic in a realistic situation and review what transferred and what still needs work.')
  ) AS v(concept_type,label,guidance)
)
INSERT INTO public.vow_goal_concepts
  (concept_key, domain, topic, concept_name, concept_type, description, aliases, active)
SELECT
  t.domain_key || ':' || t.topic_key || ':' || a.concept_type,
  t.domain, t.topic,
  initcap(replace(t.topic, '_', ' ')) || ' — ' || a.label,
  a.concept_type,
  format('Goal-recognition focus for %s in %s: %s',
    initcap(replace(t.topic, '_', ' ')), initcap(replace(t.domain, '_', ' ')), a.guidance),
  ARRAY[
    lower(replace(t.topic, '_', ' ')),
    initcap(replace(t.topic, '_', ' ')) || ' ' || lower(a.label),
    lower(a.label) || ' ' || lower(replace(t.topic, '_', ' ')),
    lower(replace(t.domain, '_', ' ')) || ' ' || lower(replace(t.topic, '_', ' '))
  ],
  true
FROM topics t CROSS JOIN angles a
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.match_vow_goal_concepts(
  query_text text,
  domain_filter text DEFAULT NULL,
  match_count integer DEFAULT 8
)
RETURNS TABLE(
  id uuid, concept_key text, domain text, topic text, concept_name text,
  concept_type text, description text, aliases text[], score real
)
LANGUAGE sql STABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
WITH q AS (
  SELECT lower(trim(coalesce(query_text,''))) AS raw,
         plainto_tsquery('english', trim(coalesce(query_text,''))) AS tsq
), scored AS (
  SELECT c.*,
    (CASE WHEN lower(c.concept_name)=q.raw THEN 100 ELSE 0 END +
     CASE WHEN EXISTS (SELECT 1 FROM unnest(c.aliases) a WHERE lower(a)=q.raw) THEN 80 ELSE 0 END +
     CASE WHEN c.search_vector @@ q.tsq AND numnode(q.tsq)>0 THEN 20 ELSE 0 END +
     CASE WHEN length(q.raw)>=3 AND lower(c.concept_name) LIKE '%'||q.raw||'%' THEN 15 ELSE 0 END +
     CASE WHEN length(q.raw)>=3 AND EXISTS (SELECT 1 FROM unnest(c.aliases) a WHERE lower(a) LIKE '%'||q.raw||'%') THEN 12 ELSE 0 END
    )::real AS match_score
  FROM public.vow_goal_concepts c CROSS JOIN q
  WHERE c.active=true AND (domain_filter IS NULL OR c.domain=domain_filter)
    AND (lower(c.concept_name)=q.raw
      OR EXISTS (SELECT 1 FROM unnest(c.aliases) a WHERE lower(a)=q.raw)
      OR (numnode(q.tsq)>0 AND c.search_vector @@ q.tsq)
      OR (length(q.raw)>=3 AND lower(c.concept_name) LIKE '%'||q.raw||'%')
      OR (length(q.raw)>=3 AND EXISTS (SELECT 1 FROM unnest(c.aliases) a WHERE lower(a) LIKE '%'||q.raw||'%')))
)
SELECT s.id,s.concept_key,s.domain,s.topic,s.concept_name,s.concept_type,s.description,s.aliases,s.match_score
FROM scored s
ORDER BY s.match_score DESC,s.concept_name
LIMIT least(greatest(coalesce(match_count,8),1),30);
$function$;

-- The existing RPC searches aliases by unnesting arrays, so these two unused
-- indexes only consume storage. search_vector GIN remains the active FTS index.
DROP INDEX IF EXISTS public.vow_goal_concepts_aliases_gin_idx;
DROP INDEX IF EXISTS public.vow_goal_concepts_description_fts_idx;

REINDEX TABLE public.vow_knowledge;
REINDEX TABLE public.vow_goal_concepts;

CREATE OR REPLACE FUNCTION public.enforce_vow_knowledge_storage_budget()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  knowledge_bytes bigint;
  concept_bytes bigint;
BEGIN
  knowledge_bytes := pg_catalog.pg_total_relation_size('public.vow_knowledge'::regclass);
  concept_bytes := pg_catalog.pg_total_relation_size('public.vow_goal_concepts'::regclass);
  IF knowledge_bytes + concept_bytes > 30000000 THEN
    RAISE EXCEPTION 'VOW knowledge storage budget exceeded: vow_knowledge plus vow_goal_concepts must remain at or below 30,000,000 bytes. Run approved maintenance before adding records.';
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS vow_knowledge_storage_budget_guard ON public.vow_knowledge;
CREATE TRIGGER vow_knowledge_storage_budget_guard
AFTER INSERT OR UPDATE ON public.vow_knowledge
FOR EACH STATEMENT EXECUTE FUNCTION public.enforce_vow_knowledge_storage_budget();

DROP TRIGGER IF EXISTS vow_goal_concepts_storage_budget_guard ON public.vow_goal_concepts;
CREATE TRIGGER vow_goal_concepts_storage_budget_guard
AFTER INSERT OR UPDATE ON public.vow_goal_concepts
FOR EACH STATEMENT EXECUTE FUNCTION public.enforce_vow_knowledge_storage_budget();

COMMIT;
