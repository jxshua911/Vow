# VOW Production Backup & Recovery

Last reviewed: 23 September 2026

## Current production backend

- Supabase project: Vow
- Project ref: `vqsrdausvmfjayffxiuh`
- Database: PostgreSQL 17
- Supabase plan: Free
- Storage bucket: `goal-resources` (private)

## Important

Do not store production database dumps, Storage exports, service-role keys, database passwords, OAuth secrets, or Play purchase credentials in GitHub.

The repository is the source of truth for application code and migrations. Production user data must have an off-site backup path.

## Pre-launch backup procedure

Run from a trusted machine with the Supabase CLI installed and the production database URL supplied through a secure environment variable.

1. Create a dated backup directory outside the Git repository.

2. Dump production database roles, schema and data using the Supabase CLI / pg_dump workflow appropriate to the current Supabase project.

3. Export the private Storage bucket `goal-resources` separately. Supabase database backups contain Storage metadata, not the actual Storage objects.

4. Encrypt the resulting database and Storage backup before placing it in external backup storage.

5. Record the backup timestamp, database migration revision and application commit SHA alongside the encrypted backup.

6. Never commit the backup to GitHub and never place credentials inside the backup directory.

## Recovery procedure

1. Provision or select a clean recovery Supabase project.

2. Restore the database dump.

3. Restore the `goal-resources` Storage objects and confirm the bucket remains private.

4. Apply the repository migration state for the exact application commit being recovered.

5. Verify RLS is enabled on user-facing tables and that service-only tables remain inaccessible to client roles.

6. Verify authentication, Edge Functions, AI guardrails, entitlements, Google Calendar connections, Strava connections and account deletion.

7. Run smoke tests against the recovery environment before considering it production-ready.

8. Record the recovery result and the recovered application/database commit pairing.

## Launch cadence

Because the current project is on Supabase Free, maintain regular off-site logical exports rather than assuming paid-plan daily downloadable backups. Increase backup frequency when production usage becomes material.

Recommended starting cadence:

- Before launch: full database + Storage backup.
- After every material production schema migration: full database export.
- Weekly after launch: database export + Storage export.
- Before destructive maintenance: immediate backup.
- Quarterly: perform a restore test in a separate project.

## What is intentionally not automated here

GitHub Actions is not used for production backups. This avoids putting production data into the repository/CI environment and avoids consuming the project's GitHub Actions storage for backup jobs.

## Recovery objective

For launch, the practical goal is:

- Recovery Point Objective: no more than one week for the routine off-site backup cadence.
- Recovery Time Objective: documented and tested manually before launch.

These targets should be tightened as VOW gains real users and production revenue.
