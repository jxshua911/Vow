# VOW Intelligence 10/10 Audit

Branch: `feat/intelligence-10-10`
Baseline: `4d11502ed3ac395c0af14441a5e1ac87ab3fac3c`

## Current audit

### Armadillo — 8.5/10 baseline

Strengths:
- Structured output includes category, goal type, metric, target, direction, time target, evidence, integrations, planning strategy, clarification, safety and confidence.
- Broad deterministic routing covers sports, study, languages, reading, creative skills, practical skills, programming, communication, projects, finance and mindfulness.
- AI planner receives the canonical Armadillo interpretation instead of having to infer everything from raw text.

Remaining 10/10 gates:
- [ ] Expand adversarial/multi-intent test corpus.
- [ ] Calibrate confidence against test outcomes.
- [ ] Improve ambiguity detection for goals with missing baseline/target/timeframe.
- [ ] Verify all specialist routes have matching knowledge topics and evidence sources.
- [ ] Add regression tests for numeric and natural-language target extraction.

### Anteater — 8/10 baseline

Strengths:
- The goal-AI edge function already contains an execution layer that validates structured session templates, supplies fallback execution instructions, equipment, quality cues, alternatives and demonstrations, and enriches generated plans.
- `AnteaterGuide` renders those execution details with validated YouTube/Vimeo embedding.
- Plan schema requires activity type, equipment, instructions, form cues, alternatives and demonstration data.

Remaining 10/10 gates:
- [ ] Make execution guidance a single shared contract rather than duplicated client/edge types.
- [ ] Add deterministic validation for unsafe/empty/generic execution instructions.
- [ ] Add session-level evidence/checkpoint requirements to the plan contract.
- [ ] Add tests covering no-equipment, limited-time and skill-level alternatives.
- [ ] Validate demonstrations before persistence rather than only at render time.

### Raven — 8.5/10 engine baseline; integration previously ~5.5/10

Findings:
- Raven has dedicated scoring, weekly snapshots, streaks, awards and goal-progress functions.
- The original streak implementation used scheduled date for completed sessions; it now uses `completed_at` when available.
- The original weekly builder omitted completely empty weeks; it now fills the observed historical range so missing weeks cannot silently inflate a consistency average.
- Raven now incorporates completion reliability and movement/skipping signals into its score and signals.
- Dashboard previously calculated its own progress independently; the branch now surfaces Raven's score and first behavioural signal from the same Raven engine.

Remaining 10/10 gates:
- [ ] Make Weekly Review consume the Raven snapshot as its progress source of truth.
- [ ] Persist snapshots after review generation/confirmation idempotently.
- [ ] Persist newly earned awards idempotently.
- [ ] Add goal-level trend signals and personal-best detection.
- [ ] Add regression tests for moved sessions, completion dates, empty weeks and score deltas.

### Database — structurally strong, behaviourally immature

Live audit findings:
- All inspected public base tables have RLS enabled.
- Raven snapshots have a unique `(user_id, week_start)` constraint.
- Raven awards have a unique `(user_id, award_key)` constraint.
- Sessions have a unique scheduled-time constraint for scheduled rows and goal/user indexes.
- Knowledge has domain/topic indexes, a GIN search index and an HNSW vector index.
- `vow_knowledge.embedding` is a vector column, but the current live knowledge corpus has no populated embeddings.
- `moderation_events`, `moderation_ip_bans` and `vow_knowledge` intentionally have zero direct client policies; these are service-side/internal data surfaces and should remain inaccessible through ordinary client RLS paths.
- Current live behavioural volume is small (only a handful of goals/sessions and no stored Raven snapshots/awards yet), so effectiveness cannot be proven from production history alone.

Remaining 10/10 gates:
- [ ] Add composite `(user_id, scheduled_at)` index for common calendar/progress queries.
- [ ] Verify every foreign key has intentional delete/update semantics.
- [ ] Add migration-level orphan/data-quality checks.
- [ ] Make Raven snapshot/award writes idempotent and transactional where possible.
- [ ] Run RLS policy tests against cross-user access attempts.

### Knowledge base — broad but retrieval is currently lexical

Live audit findings:
- 1,939 active knowledge entries across 19 domains.
- 19 domains are populated, but Reading is materially thinner than the others.
- Every active row has a search vector, but no active row currently has an embedding.
- An HNSW vector index already exists, so the database is prepared for semantic retrieval.
- Current planner retrieval calls the keyword RPC and returns a small ranked set.

Remaining 10/10 gates:
- [ ] Populate embeddings through a controlled server-side embedding job.
- [ ] Add hybrid semantic + lexical retrieval and reranking.
- [ ] Add source/freshness metadata and stale-content handling.
- [ ] Audit duplicates and low-information entries.
- [ ] Build a fixed retrieval evaluation set with paraphrased queries.
- [ ] Expand thin domains only where evaluation shows actual coverage gaps.

## Implementation completed in this branch

- Hardened Raven scoring, streak semantics, historical week handling and behavioural signals.
- Surfaced Raven score/signals on Dashboard so progress is no longer exclusively computed by a separate dashboard path.
- Created this audit as the canonical 10/10 checklist and evidence record.

## Verification gate

The branch must not be called 10/10 until all of the following pass:

- [ ] Typecheck
- [ ] Lint
- [ ] Web build
- [ ] Capacitor sync
- [ ] Android APK build
- [ ] APK verification
- [ ] Supabase migration verification
- [ ] Armadillo regression corpus
- [ ] Anteater execution validation corpus
- [ ] Raven regression corpus
- [ ] Knowledge retrieval evaluation
- [ ] Cross-user RLS tests

## Definition of done

A component is 10/10 only when implementation, integration, data quality and verification all pass. A green build alone is not evidence that the intelligence is correct.
