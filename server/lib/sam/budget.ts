/**
 * A hard dollar cap on paid model spend. One shared counter atomically reserves a call's cost and
 * refuses if that would pass the cap. Upstash Redis when its variables are set; an in-process
 * counter only when SAM_BUDGET_LOCAL=1 says so (local runs).
 */

/** Each store call gives up after this, so a hung store fails closed quickly instead of at maxDuration. */
const STORE_TIMEOUT_MS = 3000;
const KEY = 'sam:spent_micro_usd';

export class BudgetError extends Error {
  constructor(
    message: string,
    readonly status = 503
  ) {
    super(message);
  }
}

/** Spend in integer micro-dollars, shared by every caller of the key. */
export type BudgetStore = {
  /** Adds `amount` if the total stays at or under `cap`; false (and nothing added) otherwise. */
  reserve(amount: number, cap: number): Promise<boolean>;
  adjust(amount: number): Promise<void>;
  spent(): Promise<number>;
};

/** One process only: for `npm run dev` and tests, never the deployed site. */
export function memoryStore(): BudgetStore {
  let total = 0;
  return {
    async reserve(amount, cap) {
      if (total + amount > cap) return false;
      total += amount;
      return true;
    },
    async adjust(amount) {
      total += amount;
    },
    async spent() {
      return total;
    }
  };
}

// Check and add in one step: Redis runs a script atomically, so concurrent reservations can't overshoot.
const RESERVE = "local c=tonumber(redis.call('GET',KEYS[1]) or '0'); local a=tonumber(ARGV[1]); if c+a>tonumber(ARGV[2]) then return -1 end; return redis.call('INCRBY',KEYS[1],a)";

/** Upstash Redis over its REST API with plain fetch. Any failure throws, so callers fail closed. */
export function upstashStore(url: string, token: string, fetchImpl: typeof fetch = fetch, key: string = KEY): BudgetStore {
  async function send(command: (string | number)[]): Promise<unknown> {
    const r = await fetchImpl(url, {
      method: 'POST',
      headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'},
      body: JSON.stringify(command.map(String)),
      signal: AbortSignal.timeout(STORE_TIMEOUT_MS)
    });
    const body = (await r.json().catch(() => null)) as {result?: unknown; error?: string} | null;
    if (!r.ok || !body || body.error !== undefined) throw new Error(`budget store: ${body?.error ?? `HTTP ${r.status}`}`);
    return body.result;
  }
  return {
    async reserve(amount, cap) {
      // The script returns -1 or the new total; anything else is not a reservation.
      const r = await send(['EVAL', RESERVE, 1, key, amount, cap]);
      if (typeof r !== 'number') throw new Error(`budget store: unexpected reply ${JSON.stringify(r)}`);
      return r !== -1;
    },
    async adjust(amount) {
      if (amount) await send(['INCRBY', key, amount]);
    },
    async spent() {
      return Number((await send(['GET', key])) ?? 0);
    }
  };
}

type BudgetEnv = Record<string, string | undefined>;

/** URL and write-token variable names, as the Vercel Marketplace and Upstash name them. */
const STORE_VARS = [
  ['KV_REST_API_URL', 'KV_REST_API_TOKEN'],
  ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN']
] as const;

/**
 * The store's REST URL and write token. Vercel can connect a store with a custom prefix
 * (`track_KV_REST_API_URL`), so any prefix is accepted, with the token under the same prefix; the
 * read-only token has a different name and is never used. Two different stores is ambiguous: null.
 */
export function storeConfig(env: BudgetEnv): {url: string; token: string} | null {
  const found = new Map<string, {url: string; token: string}>();
  for (const [name, value] of Object.entries(env)) {
    for (const [urlVar, tokenVar] of STORE_VARS) {
      if (!value || !name.endsWith(urlVar)) continue;
      const token = env[name.slice(0, -urlVar.length) + tokenVar];
      if (token) found.set(value, {url: value, token});
    }
  }
  return found.size === 1 ? [...found.values()][0] : null;
}

/** The shared store when its variables are set. */
export function storeFromEnv(env: BudgetEnv, key?: string): BudgetStore | null {
  const c = storeConfig(env);
  return c ? upstashStore(c.url, c.token, fetch, key) : null;
}
