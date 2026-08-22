# Valora Rate-Limiting Primitive

**Phase:** P5 — Rate-limiting/abuse core infrastructure  
**Status:** Primitive implemented and pushed; live migration deployment and real burst verification remain required before P5 can be marked DONE.

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

## Verification still required

The repository can statically verify the migration contract and TypeScript boundary, but it cannot prove live Supabase behavior until the migration is deployed. Before P5 DONE:

- [ ] Apply the migration to the target Supabase project.
- [ ] Authenticated account burst: limit 3 in 60 seconds; calls 1–3 allowed, call 4 denied with retry-after.
- [ ] Authenticated device burst: two different device keys use separate account-scoped buckets.
- [ ] Trusted service-role IP burst: same IP key is denied after the configured limit.
- [ ] Anonymous/account-key substitution and client IP scope attempts are rejected.
- [ ] Window rollover resets the counter.
- [ ] Concurrent calls do not exceed the limit.
- [ ] Record SQL/RPC output and timestamp as phase evidence.

Until these live tests pass, P5 is **PARTIAL/BLOCKED**, and no production abuse-prevention claim should be made.
