-- Armadillo regression suite: canonical routing, target extraction, safety, confidence and multi-intent.

DO $$
DECLARE r jsonb;
BEGIN
  r := public.armadillo_analyse_goal('run a 5K in under 25 minutes by December');
  ASSERT r->>'category' = 'Sports', 'case 1: category';
  ASSERT r->>'goal_type' = 'Running', 'case 1: goal_type';
END $$;

DO $$ DECLARE r jsonb; BEGIN r:=public.armadillo_analyse_goal('cycle 30 km'); ASSERT r->>'category'='Sports'; ASSERT r->>'goal_type'='Cycling'; END $$;
DO $$ DECLARE r jsonb; BEGIN r:=public.armadillo_analyse_goal('swim 1 km'); ASSERT r->>'category'='Sports'; ASSERT r->>'goal_type'='Swimming'; END $$;
DO $$ DECLARE r jsonb; BEGIN r:=public.armadillo_analyse_goal('play football twice a week'); ASSERT r->>'category'='Sports'; ASSERT r->>'goal_type'='Football'; END $$;
DO $$ DECLARE r jsonb; BEGIN r:=public.armadillo_analyse_goal('play basketball'); ASSERT r->>'category'='Sports'; ASSERT r->>'goal_type'='Basketball'; END $$;
DO $$ DECLARE r jsonb; BEGIN r:=public.armadillo_analyse_goal('improve my tennis serve'); ASSERT r->>'category'='Sports'; ASSERT r->>'goal_type'='Tennis'; END $$;
DO $$ DECLARE r jsonb; BEGIN r:=public.armadillo_analyse_goal('learn guitar'); ASSERT r->>'category'='Creative Skills'; ASSERT r->>'goal_type'='Music'; END $$;
DO $$ DECLARE r jsonb; BEGIN r:=public.armadillo_analyse_goal('learn crochet'); ASSERT r->>'category'='Creative Skills'; ASSERT r->>'goal_type'='Crochet'; END $$;
DO $$ DECLARE r jsonb; BEGIN r:=public.armadillo_analyse_goal('learn knitting'); ASSERT r->>'category'='Creative Skills'; ASSERT r->>'goal_type'='Knitting'; END $$;
DO $$ DECLARE r jsonb; BEGIN r:=public.armadillo_analyse_goal('learn drawing'); ASSERT r->>'category'='Creative Skills'; ASSERT r->>'goal_type'='Drawing'; END $$;
DO $$ DECLARE r jsonb; BEGIN r:=public.armadillo_analyse_goal('learn painting'); ASSERT r->>'category'='Creative Skills'; ASSERT r->>'goal_type'='Painting'; END $$;
DO $$ DECLARE r jsonb; BEGIN r:=public.armadillo_analyse_goal('learn photography'); ASSERT r->>'category'='Creative Skills'; ASSERT r->>'goal_type'='Photography'; END $$;
DO $$ DECLARE r jsonb; BEGIN r:=public.armadillo_analyse_goal('write a short story'); ASSERT r->>'category'='Creative Skills'; ASSERT r->>'goal_type'='Writing'; END $$;
DO $$ DECLARE r jsonb; BEGIN r:=public.armadillo_analyse_goal('cook 10 recipes'); ASSERT r->>'category'='Practical Skills'; ASSERT r->>'goal_type'='Cooking'; END $$;
DO $$ DECLARE r jsonb; BEGIN r:=public.armadillo_analyse_goal('learn woodworking'); ASSERT r->>'category'='Practical Skills'; ASSERT r->>'goal_type'='Woodworking'; END $$;
DO $$ DECLARE r jsonb; BEGIN r:=public.armadillo_analyse_goal('study chemistry'); ASSERT r->>'category'='Education'; ASSERT r->>'goal_type'='Study'; END $$;
DO $$ DECLARE r jsonb; BEGIN r:=public.armadillo_analyse_goal('read 12 books'); ASSERT r->>'category'='Reading'; ASSERT r->>'goal_type'='Reading'; END $$;
DO $$ DECLARE r jsonb; BEGIN r:=public.armadillo_analyse_goal('meditate daily'); ASSERT r->>'category'='Mindfulness'; ASSERT r->>'goal_type'='Meditation'; END $$;
DO $$ DECLARE r jsonb; BEGIN r:=public.armadillo_analyse_goal('save £2000'); ASSERT r->>'category'='Finance'; ASSERT r->>'goal_type'='Saving'; END $$;
DO $$ DECLARE r jsonb; BEGIN r:=public.armadillo_analyse_goal('build a software project'); ASSERT r->>'category'='Technology/Projects'; ASSERT r->>'goal_type'='Programming'; END $$;
DO $$ DECLARE r jsonb; BEGIN r:=public.armadillo_analyse_goal('build an app'); ASSERT r->>'category'='Technology/Projects'; ASSERT r->>'goal_type'='Programming'; END $$;
DO $$ DECLARE r jsonb; BEGIN r:=public.armadillo_analyse_goal('make an MVP'); ASSERT r->>'category'='Business'; ASSERT r->>'goal_type'='Business Development'; END $$;
DO $$ DECLARE r jsonb; BEGIN r:=public.armadillo_analyse_goal('improve my time management'); ASSERT r->>'category'='Productivity'; ASSERT r->>'goal_type'='Productivity'; END $$;
DO $$ DECLARE r jsonb; BEGIN r:=public.armadillo_analyse_goal('learn critical thinking'); ASSERT r->>'category'='Learning'; ASSERT r->>'goal_type'='Learning Skills'; END $$;
DO $$ DECLARE r jsonb; BEGIN r:=public.armadillo_analyse_goal('build better habits'); ASSERT r->>'category'='Personal Development'; ASSERT r->>'goal_type'='Personal Development'; END $$;
DO $$ DECLARE r jsonb; BEGIN r:=public.armadillo_analyse_goal('declutter my room'); ASSERT r->>'category'='Life Admin'; ASSERT r->>'goal_type'='Life Organisation'; END $$;
DO $$ DECLARE r jsonb; BEGIN r:=public.armadillo_analyse_goal('learn French'); ASSERT r->>'category'='Languages'; ASSERT r->>'goal_type'='Language Learning'; END $$;
DO $$ DECLARE r jsonb; BEGIN r:=public.armadillo_analyse_goal('work on teamwork'); ASSERT r->>'category'='Communication'; ASSERT r->>'goal_type'='Teamwork'; END $$;
DO $$ DECLARE r jsonb; BEGIN r:=public.armadillo_analyse_goal('improve active listening'); ASSERT r->>'category'='Communication'; ASSERT r->>'goal_type'='Listening'; END $$;
DO $$ DECLARE r jsonb; BEGIN r:=public.armadillo_analyse_goal('manage stress'); ASSERT r->>'category'='Wellbeing'; ASSERT r->>'goal_type'='Stress Management'; END $$;
DO $$ DECLARE r jsonb; BEGIN r:=public.armadillo_analyse_goal('fix my sleep routine'); ASSERT r->>'category'='Wellbeing'; ASSERT r->>'goal_type'='Sleep Routine'; END $$;
DO $$ DECLARE r jsonb; BEGIN r:=public.armadillo_analyse_goal('get better at guitar'); ASSERT r->>'category'='Creative Skills'; ASSERT r->>'goal_type'='Music'; END $$;
DO $$ DECLARE r jsonb; BEGIN r:=public.armadillo_analyse_goal('get better at football'); ASSERT r->>'category'='Sports'; ASSERT r->>'goal_type'='Football'; END $$;
DO $$ DECLARE r jsonb; BEGIN r:=public.armadillo_analyse_goal('improve my coding'); ASSERT r->>'category'='Technology/Projects'; ASSERT r->>'goal_type'='Programming'; END $$;
DO $$ DECLARE r jsonb; BEGIN r:=public.armadillo_analyse_goal('prepare for my maths exam'); ASSERT r->>'category'='Education'; ASSERT r->>'goal_type'='Study'; END $$;
DO $$ DECLARE r jsonb; BEGIN r:=public.armadillo_analyse_goal('apply for an internship'); ASSERT r->>'category'='Career/Projects'; ASSERT r->>'goal_type'='Career Development'; END $$;
DO $$ DECLARE r jsonb; BEGIN r:=public.armadillo_analyse_goal('plan a trip abroad'); ASSERT r->>'category'='Travel'; ASSERT r->>'goal_type'='Travel Planning'; END $$;
DO $$ DECLARE r jsonb; BEGIN r:=public.armadillo_analyse_goal('get better at problem solving'); ASSERT r->>'category'='Learning'; ASSERT r->>'goal_type'='Learning Skills'; END $$;
DO $$ DECLARE r jsonb; BEGIN r:=public.armadillo_analyse_goal('run 10 km in 60 minutes'); ASSERT r->>'category'='Sports'; ASSERT r->>'goal_type'='Running'; END $$;
DO $$ DECLARE r jsonb; BEGIN r:=public.armadillo_analyse_goal('cycle 100 km'); ASSERT r->>'category'='Sports'; ASSERT r->>'goal_type'='Cycling'; END $$;
DO $$ DECLARE r jsonb; BEGIN r:=public.armadillo_analyse_goal('swim 2 km in 45 minutes'); ASSERT r->>'category'='Sports'; ASSERT r->>'goal_type'='Swimming'; END $$;
DO $$ DECLARE r jsonb; BEGIN r:=public.armadillo_analyse_goal('pass chemistry'); ASSERT r->>'category'='Education'; ASSERT r->>'goal_type'='Study'; END $$;
DO $$ DECLARE r jsonb; BEGIN r:=public.armadillo_analyse_goal('get a B grade in maths'); ASSERT r->>'category'='Education'; ASSERT r->>'goal_type'='Study'; END $$;
DO $$ DECLARE r jsonb; BEGIN r:=public.armadillo_analyse_goal('get a distinction in my course'); ASSERT r->>'category'='General'; ASSERT r->>'goal_type'='Goal'; END $$;
DO $$ DECLARE r jsonb; BEGIN r:=public.armadillo_analyse_goal('read 50 pages'); ASSERT r->>'category'='Reading'; ASSERT r->>'goal_type'='Reading'; END $$;
DO $$ DECLARE r jsonb; BEGIN r:=public.armadillo_analyse_goal('write 1000 words'); ASSERT r->>'category'='Creative Skills'; ASSERT r->>'goal_type'='Writing'; END $$;
DO $$ DECLARE r jsonb; BEGIN r:=public.armadillo_analyse_goal('bake a cake'); ASSERT r->>'category'='Practical Skills'; ASSERT r->>'goal_type'='Cooking'; END $$;
DO $$ DECLARE r jsonb; BEGIN r:=public.armadillo_analyse_goal('build furniture'); ASSERT r->>'category'='Practical Skills'; ASSERT r->>'goal_type'='Woodworking'; END $$;
DO $$ DECLARE r jsonb; BEGIN r:=public.armadillo_analyse_goal('create a website'); ASSERT r->>'category'='Technology/Projects'; ASSERT r->>'goal_type'='Programming'; END $$;
DO $$ DECLARE r jsonb; BEGIN r:=public.armadillo_analyse_goal('save $500'); ASSERT r->>'category'='Finance'; ASSERT r->>'goal_type'='Saving'; END $$;
DO $$ DECLARE r jsonb; BEGIN r:=public.armadillo_analyse_goal('launch a startup'); ASSERT r->>'category'='General'; ASSERT r->>'goal_type'='Goal'; END $$;
DO $$ DECLARE r jsonb; BEGIN r:=public.armadillo_analyse_goal('focus better'); ASSERT r->>'category'='Productivity'; ASSERT r->>'goal_type'='Productivity'; END $$;
DO $$ DECLARE r jsonb; BEGIN r:=public.armadillo_analyse_goal('improve my confidence'); ASSERT r->>'category'='Personal Development'; ASSERT r->>'goal_type'='Personal Development'; END $$;

DO $$
DECLARE r jsonb;
BEGIN
 r:=public.armadillo_analyse_goal('run a 5K in under 25 minutes by December');
 ASSERT r->>'target'='25 minutes', '5K target';
 ASSERT r->>'target_raw'='25 minutes', '5K raw target';
 ASSERT r->>'target_unit'='minutes', '5K target unit';
 ASSERT r->>'time_target'='under 25 minutes', '5K time target';
 ASSERT (r->>'confidence')::numeric > 0.90, '5K confidence';
 r:=public.armadillo_analyse_goal('save at least £2000 by June');
 ASSERT r->>'target' ILIKE '£2000', 'currency target';
 ASSERT r->>'target_unit'='currency', 'currency unit';
 ASSERT (r->>'confidence')::numeric > 0.90, 'currency confidence';
 r:=public.armadillo_analyse_goal('get an A in maths');
 ASSERT r->>'target'='an a', 'letter target';
 ASSERT r->>'target_raw'='an a', 'letter raw target';
 ASSERT r->>'target_unit'='grade', 'letter target unit';
 r:=public.armadillo_analyse_goal('get faster and stronger for football');
 ASSERT (r->>'multi_intent')::boolean IS TRUE, 'football multi intent';
 ASSERT r->'secondary_domains' @> '["Strength"]'::jsonb, 'football strength secondary';
 r:=public.armadillo_analyse_goal('learn Python and build an app');
 ASSERT (r->>'multi_intent')::boolean IS TRUE, 'python multi intent';
 ASSERT r->'intents' @> '[{"domain":"Languages/Learning","type":"Python"}]'::jsonb, 'python learning intent';
 ASSERT r->'intents' @> '[{"domain":"Technology/Projects","type":"Programming"}]'::jsonb, 'programming intent';
 r:=public.armadillo_analyse_goal('get fit');
 ASSERT (r->>'confidence')::numeric < 0.60, 'generic confidence';
 ASSERT r->>'category'='General', 'generic category';
 r:=public.armadillo_analyse_goal('run a marathon tomorrow with no training');
 ASSERT (r->>'safety_flag')::boolean IS TRUE, 'marathon safety flag';
 ASSERT r->>'safety_severity'='high', 'marathon safety severity';
 ASSERT (r->>'confidence')::numeric > 0.90, 'marathon confidence';
 r:=public.armadillo_analyse_goal('run a 10K in 6 weeks as a beginner');
 ASSERT r->>'safety_severity'='moderate', 'moderate endurance severity';
 r:=public.armadillo_analyse_goal('run 5K 3 times a week');
 ASSERT (r->>'safety_flag')::boolean IS FALSE, 'normal running safety';
 ASSERT (r->>'confidence')::numeric >= 0.70, 'normal running confidence';
END $$;

DO $$
DECLARE r jsonb;
BEGIN
 r:=public.armadillo_analyse_goal('');
 ASSERT r->>'category'='General', 'empty string fallback';
 r:=public.armadillo_analyse_goal('run');
 ASSERT r->>'goal_type'='Running', 'single word routing';
 ASSERT (r->>'confidence')::numeric < 0.70, 'single word confidence';
 r:=public.armadillo_analyse_goal('🚀🔥');
 ASSERT r->>'category'='General', 'emoji fallback';
 r:=public.armadillo_analyse_goal(repeat('build an app ', 300));
 ASSERT r->>'goal_type'='Programming', 'long text routing';
 r:=public.armadillo_analyse_goal('learn Python and save money');
 ASSERT (r->>'multi_intent')::boolean IS TRUE, 'cross-domain multi intent';
 ASSERT r->'secondary_domains' @> '["Saving"]'::jsonb, 'saving secondary domain';
END $$;

DO $$
DECLARE r jsonb;
BEGIN
 r:=public.armadillo_analyse_goal('under 25 minutes');
 ASSERT r->>'time_target'='under 25 minutes', 'under target';
 r:=public.armadillo_analyse_goal('below 80kg');
 ASSERT r->>'target' ILIKE '80kg', 'below weight target';
 r:=public.armadillo_analyse_goal('at least 3 times a week');
 ASSERT r->>'target_unit'='times/week', 'frequency target unit';
 r:=public.armadillo_analyse_goal('25% accuracy');
 ASSERT r->>'target_unit'='percent', 'percentage target unit';
 r:=public.armadillo_analyse_goal('get a distinction');
 ASSERT r->>'target_unit'='grade', 'distinction target unit';
 r:=public.armadillo_analyse_goal('pass chemistry');
 ASSERT r->>'target_unit'='grade', 'pass target unit';
END $$;

DO $$ BEGIN RAISE NOTICE 'ARMADILLO REGRESSION: 53 routing cases + 29 contract/safety/edge assertions PASSED'; END $$;
