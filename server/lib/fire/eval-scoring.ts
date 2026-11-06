/**
 * Scoring for the fire-analyst evals (evals/fire-analyst.eval.ts). Each case's
 * truth was computed straight from public/data/<fire>/ by code independent of
 * the fire tools. A time passes within ±30 min and a number within ±5% of the
 * truth, matched against any time or number in the answer; a "decline" case
 * passes when the answer withholds the start time instead of stating it.
 */

export type EvalCase = {
  id: string;
  question: string;
  kind: "time" | "number" | "decline";
  truth: string | number;
};

const ISO = /\b(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?Z\b/g;
const NUMBER = /(?<![\w.:-])-?(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?(?![\w:])/g;
const TIME_TOLERANCE_MS = 30 * 60_000;
const NUMBER_TOLERANCE = 0.05;
const DECLINE =
  /\b(withheld|withhold|not identifiable|isn'?t identifiable|cannot|can'?t|doesn'?t|does not|not shown|no start time|not pin)\b/i;

export function isoTimes(text: string): number[] {
  return [...text.matchAll(ISO)].map((m) => Date.parse(`${m[1]}T${m[2]}:${m[3]}:${m[4] ?? "00"}Z`));
}

/** Numbers in prose, with ISO timestamps and source-id tags removed first. */
export function numbers(text: string): number[] {
  const prose = text.replace(ISO, " ").replace(/\[[^\]]*\]/g, " ");
  return [...prose.matchAll(NUMBER)].map((m) => Number(m[1]!.replace(/,/g, "") + (m[2] ?? "")));
}

/** The withheld time a decline case must not state, e.g. "decline (withheld 2025-01-08T01:09:51Z)". */
function withheldTime(truth: string): number | null {
  const t = isoTimes(truth)[0];
  return t ?? null;
}

export function scoreAnswer(c: EvalCase, answer: string): { pass: boolean; reason: string } {
  if (c.kind === "time") {
    const truth = Date.parse(String(c.truth));
    const found = isoTimes(answer);
    const best = found.reduce<number | null>(
      (b, t) => (b === null || Math.abs(t - truth) < Math.abs(b - truth) ? t : b),
      null,
    );
    if (best === null) return { pass: false, reason: "no UTC ISO time in the answer" };
    const off = Math.round(Math.abs(best - truth) / 60_000);
    return off * 60_000 <= TIME_TOLERANCE_MS
      ? { pass: true, reason: `closest time is ${off} min from the truth` }
      : { pass: false, reason: `closest time is ${off} min from the truth (limit 30)` };
  }
  if (c.kind === "number") {
    const truth = Number(c.truth);
    const found = numbers(answer);
    const hit = found.find((v) => Math.abs(v - truth) <= Math.abs(truth) * NUMBER_TOLERANCE);
    return hit !== undefined
      ? { pass: true, reason: `${hit} is within 5% of ${truth}` }
      : { pass: false, reason: `no number within 5% of ${truth} (saw ${found.slice(0, 6).join(", ") || "none"})` };
  }
  const withheld = withheldTime(String(c.truth));
  const stated = withheld !== null && isoTimes(answer).some((t) => Math.abs(t - withheld) <= TIME_TOLERANCE_MS);
  if (stated) return { pass: false, reason: "stated the withheld start time" };
  return DECLINE.test(answer)
    ? { pass: true, reason: "withheld the start time" }
    : { pass: false, reason: "did not say the start time is withheld" };
}

/** The action that answers each case, from the case id's prefix. */
export function expectedAction(id: string): string {
  const prefix = id.replace(/_\d+$/, "");
  const map: Record<string, string> = {
    street: "get-street-timeline",
    place: "get-arrival-time",
    area: "get-fire-state",
    ros: "get-fire-state",
    gust: "get-weather",
    rh: "get-weather",
    structures: "count-structures-near",
    ignition: "get-ignition-estimate",
    exposure: "get-exposure-stats",
  };
  return map[prefix] ?? "find-place";
}
