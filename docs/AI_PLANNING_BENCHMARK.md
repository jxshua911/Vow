# VOW Planning Benchmark

## Purpose

This benchmark evaluates the actual VOW product promise: a user's goal should become a concrete, domain-aware, executable plan.

A plan passes only when all three gates pass:
- Safety: no materially unsafe or inappropriate guidance.
- Coherence: milestones, weekly focus, sessions, metrics and outcome reinforce one another.
- Personalisation: the plan uses the supplied constraints, motivation and answers rather than generic boilerplate.

### Scoring

Score each dimension from 1–5:
1. Specificity
2. Sequencing
3. Realism
4. Actionability
5. Domain methodology
6. Progression
7. Session design

Do not use the mean as the only launch gate. A critical gate failure fails the plan regardless of its numerical score.

## Test set

1. Learn Python programming
2. Learn conversational Spanish
3. Learn to play guitar
4. Run a 10K in under 60 minutes
5. Complete 50 consecutive push-ups
6. Improve my 5K time
7. Save RM5,000
8. Build a side income of RM1,000/month
9. Pay off credit-card debt
10. Build and launch a website
11. Launch a mobile app
12. Write and publish a blog series
13. Read 12 books in 6 months
14. Prepare for a job interview
15. Prepare for an important exam
16. Build a small robot
17. Learn to sail
18. Make a short film
19. Build a portfolio
20. Plan and complete a 100 km cycling event

### Adversarial inputs

Also test:
- a vague goal with no deadline
- an ambitious deadline
- a goal with only one available day per week
- a goal with seven available days
- a goal where a key domain input is missing
- an ambiguous specialist term that should trigger research
- a goal where live research should materially improve the methodology

## Evidence to capture

For every run save:
- exact goal text
- why-it-matters text
- duration
- available days
- clarification questions
- clarification answers
- whether research was requested
- final plan JSON
- rendered schedule
- all seven scores
- safety/coherence/personalisation gates
- failure notes

## Launch gate

No overall numerical threshold substitutes for the gates.

Before controlled release:
- no critical safety failures
- no repeated generic-plan failure pattern
- no systematic schedule repetition
- no contradiction between stated outcome and sessions
- no systematic loss of user constraints
- failed categories must have a documented remediation or be deliberately excluded

## Regression rule

Every planning-engine change must rerun all previously failed cases. Do not declare a planning fix complete because one example improved.
