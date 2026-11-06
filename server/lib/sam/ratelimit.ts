/**
 * Two sliding windows in this instance's memory: one per visitor (client IP) and one for everyone.
 * Memory is per server instance, so a cold start or a second instance starts fresh; the hard cap
 * on total spend across instances is budget.ts.
 */

export type Limit = {max: number; windowMs: number};

/** Visitors tracked at once; past this the oldest are dropped (a flood of new IPs still meets GLOBAL). */
const MAX_VISITORS = 10_000;

type Refusal = {
  ok: false;
  scope: 'visitor' | 'global';
  limit: Limit;
  /** Seconds until this request (at its cost) would fit in both windows. */
  retryAfterS: number;
  cost: number;
  /** Hits still free right now in the binding window: a cheaper request may fit. */
  left: number;
};
export type Verdict = {ok: true} | Refusal;

export function createLimiter(perVisitor: Limit, global: Limit, now: () => number = Date.now) {
  const visitors = new Map<string, number[]>();
  const all: number[] = [];

  const prune = (hits: number[], windowMs: number, t: number) => {
    while (hits.length && hits[0] <= t - windowMs) hits.shift();
  };
  // Seconds until enough of the oldest hits leave the window for `cost` more to fit.
  const wait = (hits: number[], limit: Limit, cost: number, t: number) => {
    if (!hits.length) return Math.ceil(limit.windowMs / 1000);
    const i = Math.min(hits.length - 1, hits.length + cost - limit.max - 1);
    return Math.max(1, Math.ceil((hits[i] + limit.windowMs - t) / 1000));
  };

  return {
    /** Spends `cost` hits for `visitor` if both windows have room; otherwise spends nothing. */
    take(visitor: string, cost = 1): Verdict {
      const t = now();
      prune(all, global.windowMs, t);
      let hits = visitors.get(visitor);
      if (hits) prune(hits, perVisitor.windowMs, t);
      else hits = [];
      // Check both windows and report the one that frees up last, so the advertised wait is enough.
      const refusals: Refusal[] = [];
      if (hits.length + cost > perVisitor.max) {
        refusals.push({ok: false, scope: 'visitor', limit: perVisitor, retryAfterS: wait(hits, perVisitor, cost, t), cost, left: perVisitor.max - hits.length});
      }
      if (all.length + cost > global.max) {
        refusals.push({ok: false, scope: 'global', limit: global, retryAfterS: wait(all, global, cost, t), cost, left: global.max - all.length});
      }
      if (refusals.length) return refusals.reduce((a, b) => (b.retryAfterS > a.retryAfterS ? b : a));
      for (let i = 0; i < cost; i++) {
        hits.push(t);
        all.push(t);
      }
      visitors.delete(visitor); // re-insert so Map order is least recently used first
      visitors.set(visitor, hits);
      if (visitors.size > MAX_VISITORS) visitors.delete(visitors.keys().next().value!);
      return {ok: true};
    }
  };
}

export type Limiter = ReturnType<typeof createLimiter>;
