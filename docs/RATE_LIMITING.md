# Valora Rate-Limiting Primitive

**Phase:** P5 — Rate-limiting/abuse core infrastructure  
**Status:** DONE — live migration and all required rate-limit verification tests passed, including stable pooled-connection concurrency evidence.

## One-time phase override

P5 started on **2026-08-22 Asia/Dhaka** **despite P4 being blocked, with explicit user override**. Reason: budget is not currently available for the Supabase Pro plan required for PITR. P4 remains `BLOCKED - pending budget approval for Supabase Pro plan`; it is neither done nor skipped. This override applies only to starting P5 and does not authorize P6, P7, or any later phase while P4 remains blocked.

## Primitive contract

The migration `supabase/migrations/20260822090000_rate_limits.sql` adds an atomic fixed-window counter:

- `account`: key is derived from `auth.uid()`; the client cannot choose another account key.
- `device`: key is namespaced under `auth.uid()`; a device identifier cannot become a global shared bucket.
- `ip`: accepted only for a trusted `service_role` caller. A mobile client cannot prove its source IP to Postgres and receives an explicit permission error for this scope.
- Inputs are bounded: window 1–86,400 seconds; limit 1–10,000.
- Return fields are `allowed`, `remaining`, `retry_after_seconds`, and `reset_at`.
- State is stored in the private schema and direct table access is revoked from public/anonymous/authenticated roles.
- The security-definer RPC has an explicit search path and only authenticated/service-role execution grants.

## Typed application boundary

`src/services/rateLimit.ts` exposes:

- `consumeAccountRateLimit()`
- `consumeDeviceRateLimit(key)`
- `consumeTrustedIpRateLimit(trustedKey)` — trusted edge/service-role use only
- `consumeRateLimit(call)` for typed dispatch

Every unavailable-Supabase, RPC, malformed-response, or invalid-key path returns an explicit error. No caller receives a fake `allowed: true` result.

## Integration rules

Before a mutating endpoint is considered protected:

1. Call the appropriate scope before the mutation.
2. If the result is `ok: false`, return an operational error and do not proceed silently.
3. If `data.allowed` is false, reject the mutation with a retry-after response/message.
4. Log the scope, endpoint, decision, and reset time without logging raw secrets or full IP addresses.
5. Add a real burst test for the endpoint and record the result in the P50/P18/P26 endpoint audit.

P5 provides the reusable primitive; applying it to signup, comments, and DMs is owned by P7, P18, and P26 respectively.

## Live verification evidence

**Project:** supplied Supabase project ref `xyxgwlthbjezslloysgd`

**Migration applied:** `20260822090000_rate_limits.sql` via linked Supabase CLI `db query --linked`

**Evidence windows:** 2026-08-22 09:10–09:28 UTC and 2026-08-22 10:11:30–10:11:34 UTC

**Connection evidence:** final concurrency run used a stable direct Supabase pooler connection; credentials are not recorded here.

| Test | Result | Timestamp/evidence |
|---|---|---|
| Migration/table/RPC existence | PASS | 2026-08-22 09:10 UTC; `private.rate_limit_buckets` and `consume_rate_limit(text,text,integer,integer)` returned by live query |
| Account burst, limit 3/60s | PASS | 09:16:16 UTC; calls 1–3 `allowed=true` with remaining 2/1/0; call 4 `allowed=false`, retry-after 60s |
| Device burst and key isolation | PASS | 09:17:14 UTC; device A calls a1/a2 allowed, a3 denied; device B call b1 allowed |
| Trusted IP burst, limit 2/60s | PASS | 09:17:19 UTC; calls 1–2 allowed with remaining 1/0; call 3 denied, retry-after 60s |
| Client IP rejection | PASS | 09:18 UTC; authenticated caller received SQLSTATE `42501`: IP rate limits require a trusted service-role caller |
| Window rollover, limit 1/1s | PASS | 09:21:34–09:21:36 UTC; before allowed, immediate call denied with retry-after 1s, after 2s allowed |
| Persistent state across calls | PASS | 09:20:34/09:20:39 UTC; second account call denied with retry-after 56s; private state showed request_count=1 |
| Concurrent calls | PASS | 2026-08-22 10:11:30–10:11:34 UTC; 10 simultaneous pooler calls returned exactly 3 `allowed=true` and 7 `allowed=false`; all 10 subprocesses exited zero; JSON errors=0; connection errors=0. |

### P5 completion status

All required live migration, sequential burst, rejection, rollover, persistence, and stable pooled-connection concurrency tests passed with timestamped RPC evidence. P5 is **DONE**. P4 remains `BLOCKED - pending budget approval for Supabase Pro plan`; the one-time override does not authorize P6/P7 or later phases while P4 remains blocked.
