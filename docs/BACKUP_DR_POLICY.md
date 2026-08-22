# Valora Backup and Disaster-Recovery Policy

**Phase:** P4 — DB backup & DR policy  
**System of record:** Supabase Postgres and Supabase Storage  
**Status:** BLOCKED - pending budget approval for Supabase Pro plan.

Offline policy work is documented below; P4 is not DONE until live PITR configuration and the first restore drill are evidenced.

## Recovery objectives

These are approved engineering targets for the current product stage, not measured results:

| Asset | Target RPO | Target RTO | Recovery source | Verification required |
|---|---:|---:|---|---|
| Supabase Postgres schema and user data | ≤15 minutes | ≤60 minutes | Supabase PITR, then logical backup if needed | Dashboard setting and timed restore drill |
| Supabase Storage objects and metadata | ≤24 hours | ≤4 hours | Storage backup/export process plus database metadata restore | Object inventory, checksum/sample restore, timed drill |
| Transcoding-provider originals/renditions | Provider contract target; must be confirmed before P10 | ≤24 hours after provider recovery | Provider retention/export or re-upload from source | Provider retention evidence and drill plan |
| App configuration and migrations | Same commit / release | ≤30 minutes | GitHub `main`, migrations, environment-secret inventory | Clean checkout and migration replay |

If a target cannot be met, the affected capability is **BLOCKED** until the owner accepts a revised target and documents the trade-off.

## What is backed up

1. **Database:** all Supabase Postgres tables, functions, views, indexes, RLS policies, and migration history required to recreate the current schema.
2. **Storage:** every production bucket, object path, object metadata, and a manifest connecting user records to stored objects. Current migrations define `avatars` and `post-media`; verify the live project matches them.
3. **Configuration:** Supabase project settings, Auth provider configuration inventory, redirect URLs, storage policies, and environment-variable names. Secret values stay in the provider/dashboard secret store and are never committed.
4. **Code and schema:** GitHub `main`, `supabase/migrations`, `supabase/schema.sql`, and this policy. A Git checkout is not a substitute for a data backup.
5. **Future media pipeline:** before transcoding implementation, record whether the provider retains originals, retention duration, export path, rendition regeneration path, and deletion behavior.

## Required controls

### Supabase PITR

- Enable Supabase Point-in-Time Recovery for the production project when the selected Supabase plan supports it.
- Record the enabled timestamp, retention window, project reference, and dashboard evidence in the restore drill report.
- Confirm the PITR retention window is sufficient for the approved RPO/RTO target; do not assume the plan includes a specific retention period.
- Restrict PITR/restore permissions to the project owner and designated recovery operator.

Official references: [Supabase database backups](https://supabase.com/docs/guides/platform/backups), [PITR usage](https://supabase.com/docs/guides/platform/manage-your-usage/point-in-time-recovery), and [restore a PITR backup](https://supabase.com/docs/reference/api/v1-restore-pitr-backup).

### Logical backups

- Export schema/migrations on every database change through Git review.
- Schedule a logical data backup at least daily once production data exists.
- Store the encrypted backup outside the primary Supabase project/account boundary.
- Retain daily backups for 30 days and monthly snapshots for 12 months unless legal/retention policy requires shorter or longer periods.
- Never place a database password, service-role key, or backup file in GitHub, the app bundle, or `.env.example`.

### Storage backups

- Keep an object manifest with bucket, path, size, content type, checksum, created time, and owning record ID.
- Run a daily incremental object export and a weekly full inventory while user-generated media exists.
- Treat public URLs as delivery addresses, not backups.
- Test restoration of both a representative avatar and a representative post-media object.

### Retention and deletion

- Backup retention does not override account deletion, legal hold, DMCA, or future P47 retention rules.
- A deletion request must remove live database rows and live Storage objects according to the approved deletion workflow; backups expire on their documented schedule.
- Record whether a restore drill uses synthetic, anonymized, or production-like data. Do not copy live personal data into an unapproved environment.

## Restore procedure

1. Declare the incident and freeze destructive changes.
2. Identify the recovery point and record the UTC timestamp, reason, operator, and target project.
3. Restore to a separate non-production project whenever possible; never overwrite production for a first test.
4. Replay migrations and verify schema, extensions, functions, views, indexes, RLS policies, Auth configuration, and Storage buckets.
5. Validate row counts and referential integrity for profiles, posts, likes, comments, follows, conversations, messages, notifications, stories, and story views.
6. Validate object inventory and sample downloads for `avatars` and `post-media`.
7. Run application smoke tests: sign-in/session restore, profile read, post read, upload metadata read, like/comment, and message read/write against the restored target.
8. Measure elapsed time and data loss against the RPO/RTO targets.
9. Record defects and remediation tasks before declaring the drill passed.
10. If production cutover is required, obtain explicit owner approval, communicate downtime/impact, switch configuration, and re-run smoke tests.

## First restore drill — required evidence

P4 cannot be marked DONE until all fields below are completed:

- [ ] Production Supabase project reference recorded privately in the operational record.
- [ ] PITR enabled and retention window recorded.
- [ ] Recovery point selected and UTC timestamp recorded.
- [ ] Separate restore target created.
- [ ] Restore start/end times and elapsed duration recorded.
- [ ] Database schema and RLS checks passed.
- [ ] Storage object inventory and sample restore passed.
- [ ] Application smoke tests passed.
- [ ] Measured RPO and RTO meet the targets, or a blocker/trade-off is approved.
- [ ] Transcoding-provider original retention/backup behavior recorded before P10.
- [ ] Recovery operator and reviewer sign-off recorded.

## Current status and blocker

**BLOCKED - pending budget approval for Supabase Pro plan.** The user has decided not to spend on Supabase Pro at this time, so PITR cannot be enabled and the first restore drill cannot be completed. P4 is intentionally **not DONE**, and P5 must not start until this blocker is cleared.

### Resume TODO after budget approval

> **Supabase Pro plan ($25/month) approve হলে PITR enable করে restore drill সম্পন্ন করতে হবে।**

When the budget is approved:

1. Upgrade the production Supabase project to Pro and record the approval/date in the operational record.
2. Enable PITR and record the enabled timestamp and retention window.
3. Create a separate restore target and select a recovery point.
4. Run the first restore drill using the procedure above; record start/end times, measured RPO/RTO, schema/RLS checks, Storage sample restore, and application smoke-test results.
5. Resolve every unchecked item in the first-restore-drill checklist, then re-verify P4 before considering P5.

The documentation that can be completed without paid infrastructure is preserved: RPO/RTO targets, logical-backup and Storage retention rules, deletion constraints, restore procedure, transcoding-provider retention gate, and the complete first-drill evidence checklist. No production-ready or recovery-ready claim should be made before the live evidence exists.
