# Valora Alerting Contract

**Phase:** P3 — Alerting & incident response  
**Provider:** Sentry  
**Status:** Thresholds and response contract documented; Sentry dashboard rules and human routing are pending configuration.

## Scope and telemetry boundary

P2 currently sends client-side JavaScript exceptions, root error-boundary events, session-restore errors, user context (without PII), and structured breadcrumbs. There is no edge-function, API gateway, database, feed-latency, upload-latency, or delivery metric in the current implementation. Do not create alerts for metrics that are not emitted.

Sentry Expo setup reference: [Sentry for Expo](https://docs.sentry.io/platforms/react-native/guides/expo/).

## Severity and thresholds

| Alert | Trigger | Severity | First response | Current status |
|---|---|---:|---|---|
| Fatal crash | Any new unhandled fatal/crash issue in a production release | Critical | Acknowledge within 5 minutes; begin containment immediately | Rule must be created in Sentry |
| Repeated same error | Same issue fingerprint reaches **5 events in 10 minutes** in production | High | Acknowledge within 15 minutes; identify affected release and flow | Rule must be created in Sentry |
| Session restore failure | `operation: restore_session` reaches **5 events in 10 minutes** | High | Check auth/Supabase status; stop rollout if the issue is release-specific | Rule must be created in Sentry |
| New release regression | A new issue fingerprint appears after a production release and reaches **3 events in 30 minutes** | High | Compare with previous release; rollback or halt rollout if reproducible | Rule must be created in Sentry |
| Isolated production error | One non-fatal event with no repeated fingerprint | Medium | Triage during business hours; link to an issue if actionable | Sentry issue inbox; no page required |
| Development/test event | Event tagged `verification=VALORA_SENTRY_TEST` | Info | Confirm ingestion, then resolve/ignore the test issue | Verified once; never page |

### Why counts are used instead of rates

The current client does not emit a trusted denominator such as active sessions or request totals. Count-based thresholds are therefore reproducible now; percentage-based SLO alerts are deferred until server and product metrics exist.

## Routing contract

Do not invent a channel or personal contact in source control. The owner must fill these values in the Sentry alert actions and the team’s secret operational system:

- **Primary on-call:** `[OWNER REQUIRED]`
- **Backup/on-call escalation:** `[OWNER REQUIRED]`
- **Critical notification channel:** `[CHANNEL REQUIRED]`
- **High notification channel:** `[CHANNEL REQUIRED]`
- **Incident commander:** first responder for Critical; designated owner for High
- **Release decision maker:** `[OWNER REQUIRED]`

Required routing behavior:

1. Critical → primary on-call immediately; backup if not acknowledged in 5 minutes.
2. High → primary on-call; escalate to incident commander after 15 minutes without acknowledgement.
3. Medium → Sentry issue inbox; no pager notification.
4. Info/test → no escalation.

## Sentry configuration checklist

Create these rules in the Sentry project connected to the DSN. Do not mark P3 production-ready until each item has evidence in the Sentry dashboard:

- [ ] Production environment and release naming are enabled.
- [ ] Critical fatal-crash rule created and routed to the primary on-call.
- [ ] High repeated-error rule created with the 5-in-10-minute threshold.
- [ ] High session-restore rule created with the `operation=restore_session` filter.
- [ ] High release-regression rule created with the 3-in-30-minute threshold.
- [ ] Test events are excluded from paging by the `verification=VALORA_SENTRY_TEST` tag.
- [ ] Alert notification test fired and received by the primary route.
- [ ] Acknowledgement and escalation path confirmed with the human owner.

## Limitations and follow-ups

- Edge-function structured logs and server-side alert metrics are not implemented yet; add them before relying on API, database, feed, upload, or messaging thresholds.
- Billing tier/cost is not locked in this repository. The human owner must confirm the Sentry plan and record the decision in the project’s operational record before production scale.
- Alert rules are external configuration. A clean local build cannot prove that Sentry notifications are routed correctly.
