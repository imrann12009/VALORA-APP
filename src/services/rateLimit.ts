import { hasSupabaseConfig, supabase } from '../lib/supabase';

export type RateLimitScope = 'account' | 'device' | 'ip';

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  resetAt: string;
};

type RpcRow = {
  allowed: boolean;
  remaining: number;
  retry_after_seconds: number;
  reset_at: string;
};

export type RateLimitCall =
  | { scope: 'account'; windowSeconds?: number; limit?: number }
  | { scope: 'device'; key: string; windowSeconds?: number; limit?: number }
  | { scope: 'ip'; trustedKey: string; windowSeconds?: number; limit?: number };

type RateLimitResponse = { ok: true; data: RateLimitResult } | { ok: false; error: string };

function isRpcRow(value: unknown): value is RpcRow {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.allowed === 'boolean' &&
    typeof row.remaining === 'number' &&
    typeof row.retry_after_seconds === 'number' &&
    typeof row.reset_at === 'string'
  );
}

export async function consumeRateLimit(call: RateLimitCall): Promise<RateLimitResponse> {
  if (!hasSupabaseConfig || !supabase) {
    return { ok: false, error: 'Supabase is not configured; rate limit could not be checked.' };
  }

  const key = call.scope === 'account' ? '' : call.scope === 'device' ? call.key.trim() : call.trustedKey.trim();
  if (call.scope !== 'account' && !key) {
    return { ok: false, error: `${call.scope} rate limit requires a non-empty key.` };
  }

  const { data, error } = await supabase.rpc('consume_rate_limit', {
    p_scope: call.scope,
    p_key: key,
    p_window_seconds: call.windowSeconds ?? 60,
    p_limit: call.limit ?? 10
  });

  if (error) return { ok: false, error: `Rate-limit check failed: ${error.message}` };

  const row = Array.isArray(data) ? data[0] : data;
  if (!isRpcRow(row)) {
    return { ok: false, error: 'Rate-limit check returned an invalid response.' };
  }

  return {
    ok: true,
    data: {
      allowed: row.allowed,
      remaining: row.remaining,
      retryAfterSeconds: row.retry_after_seconds,
      resetAt: row.reset_at
    }
  };
}

export function consumeAccountRateLimit(options: Omit<Extract<RateLimitCall, { scope: 'account' }>, 'scope'> = {}) {
  return consumeRateLimit({ scope: 'account', ...options });
}

export function consumeDeviceRateLimit(key: string, options: Omit<Extract<RateLimitCall, { scope: 'device' }>, 'scope' | 'key'> = {}) {
  return consumeRateLimit({ scope: 'device', key, ...options });
}

/** Only call this from a trusted service-role/edge boundary with a server-derived IP key. */
export function consumeTrustedIpRateLimit(trustedKey: string, options: Omit<Extract<RateLimitCall, { scope: 'ip' }>, 'scope' | 'trustedKey'> = {}) {
  return consumeRateLimit({ scope: 'ip', trustedKey, ...options });
}
