# Valora Incident Runbook

**Phase:** P3 — Alerting & incident response  
**Provider:** Sentry  
**Audience:** The responder who first acknowledges a Valora alert.

## Before an incident

- Keep the Sentry project URL and the current release identifier available.
- Confirm the primary and backup on-call routes are filled in in [`ALERTING.md`](./ALERTING.md).
- Never paste DSNs, auth tokens, user data, or stack traces containing secrets into chat or public tickets.
- Treat `VALORA_SENTRY_TEST` events as ingestion checks, not incidents.

## First five minutes: common procedure

1. **Acknowledge the alert** in Sentry and record the UTC time, issue fingerprint, environment, release, and responder.
2. **Classify impact:** authentication, app startup, feed, upload, messaging, profile, or another path.
3. **Check scope:** affected release, platform, first-seen time, event count, and whether the issue is still increasing.
4. **Preserve evidence:** Sentry issue URL, event IDs, stack trace, breadcrumbs, and the last known-good release. Do not copy secrets or raw personal data.
5. **Choose containment:** pause rollout, roll back the release, disable the affected operation if a safe server-side flag exists, or continue monitoring for isolated Medium events.

## If X fires, do Y

### Critical — fatal crash

**If:** a new production fatal/crash issue fires.

**Do:**

1. Acknowledge within 5 minutes and page the backup if not acknowledged.
2. Stop any staged rollout of the affected release.
3. Compare the first-seen release with the last known-good release; reproduce on the affected platform if possible.
4. If release-specific, roll back or halt distribution. If not release-specific, contain the affected flow and keep the incident commander informed.
5. Keep the incident open until a patched build or confirmed mitigation is deployed and the crash trend stops.

### High — repeated error

**If:** one fingerprint reaches 5 events in 10 minutes in production.

**Do:**

1. Acknowledge within 15 minutes.
2. Identify the affected operation, platform, release, and user segment.
3. Check whether the error is caused by a dependency, Supabase response, auth state, or client regression.
4. Create a focused fix task; escalate to the incident commander if the count continues rising or user actions are blocked.
5. Verify the fix in a release build and watch the same fingerprint for at least one threshold window.

### High — session restore failure

**If:** `operation=restore_session` reaches 5 events in 10 minutes.

**Do:**

1. Treat as an authentication/startup incident.
2. Check Supabase Auth health, environment variables, redirect configuration, and the affected app release.
3. If only the newest release is affected, stop rollout and restore the last known-good release.
4. If the provider is degraded, show the existing signed-out/error path and communicate the dependency incident; do not claim a successful login.
5. Resolve only after a clean cold start and session restore are observed on the affected platform.

### High — new release regression

**If:** a new issue reaches 3 events in 30 minutes after a production release.

**Do:**

1. Compare the issue against the previous release and release notes.
2. Halt further rollout and assign an owner to reproduce.
3. Roll back if the issue affects startup, authentication, data writes, or a broad user path.
4. Ship a focused patch only after typecheck, tests, and a manual regression pass.
5. Re-enable rollout gradually and monitor the issue for another threshold window.

### Medium — isolated non-fatal error

**If:** one isolated production event occurs without a rising fingerprint.

**Do:**

1. Review the stack trace and breadcrumbs during business hours.
2. Link it to a follow-up issue if actionable; do not page.
3. Watch for recurrence. Promote to High response if it reaches the repeated-error threshold.

### Info — Sentry test event

**If:** `verification=VALORA_SENTRY_TEST` appears.

**Do:**

1. Confirm the event is in the expected project and environment.
2. Confirm the configured route did not page anyone.
3. Resolve or ignore the test issue and record the verification time.
4. Do not roll back, communicate a customer incident, or modify production code.

## Recovery and closure

An incident may be closed only when:

- The user-impacting path is restored or a documented mitigation is active.
- The issue trend is flat or declining for at least one threshold window.
- The current release/rollback decision is recorded.
- The incident commander confirms closure for Critical and High incidents.
- A follow-up task exists for the root cause, tests, and any missing observability.

Within one business day, record: impact, timeline, trigger, root cause, mitigation, permanent fix, detection gap, and one prevention action. Never mark an external alert-routing test as complete based only on local logs; verify receipt at the configured human route.
