import type {
  AgentLoopFinalResponseGuardContext,
  AgentLoopFinalResponseGuardResult,
} from "@agent-native/core/server";

import type { Cite } from "./types.js";
import { containsAddress, mentionsCause, ungroundedNumbers } from "./verify.js";

/** Actions whose results count as evidence for figures in an answer. */
export const EVIDENCE_ACTIONS = new Set([
  "find-place",
  "get-arrival-time",
  "get-street-timeline",
  "get-fire-state",
  "get-weather",
  "list-fire-events",
  "count-structures-near",
  "get-ignition-estimate",
  "get-exposure-stats",
  "fire-growth-chart",
  "list-briefs",
  "view-screen",
]);

const SOURCE_TAGS = /\[\s*s[0-9a-z]{2,8}(?:\s*[,;]\s*s[0-9a-z]{2,8})*\s*\]/gi;
const HAS_SOURCE_TAG = /\[\s*s[0-9a-z]{2,8}\b/i;
const ALL: Cite = { id: "turn", layer: "turn", label: "this turn's tool results" };

function parse(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    return content;
  }
}

/**
 * Checks the agent's final answer before the user sees it, the way the map's
 * citation chips used to be checked:
 * - no talk of what caused the fire, and no street addresses;
 * - every number or clock time above 10 must appear in a tool result from this
 *   turn (rounding allowed) or in the user's own question;
 * - when fire actions ran, the answer must tag claims with their source ids.
 * A failing draft is sent back once with the reason.
 */
export function fireAnswerGuard(
  ctx: AgentLoopFinalResponseGuardContext,
): AgentLoopFinalResponseGuardResult | null {
  const text = ctx.text.trim();
  if (!text) return null;

  const evidence = ctx.toolResults.filter(
    (r) => !r.isError && EVIDENCE_ACTIONS.has(r.name),
  );
  const prose = text.replace(SOURCE_TAGS, " ");
  const problems: string[] = [];

  if (mentionsCause(prose)) {
    problems.push(
      "it discusses what caused or started the fire; the data here cannot say, so leave cause out entirely",
    );
  }
  if (containsAddress(prose)) {
    problems.push("it includes a street address; describe locations by street or neighborhood only");
  }

  const bad = ungroundedNumbers(prose, [ALL], {
    evidence: new Map([[ALL.id, evidence.map((r) => parse(r.content))]]),
    question: ctx.requestText ?? "",
  });
  if (bad.length) {
    problems.push(
      evidence.length
        ? `these figures appear in no tool result from this turn: ${bad.slice(0, 6).join(", ")}`
        : `it states figures (${bad.slice(0, 6).join(", ")}) without calling any fire action this turn`,
    );
  }

  const fireCalls = evidence.filter((r) => r.name !== "view-screen");
  if (fireCalls.length && !HAS_SOURCE_TAG.test(text) && /\d/.test(prose)) {
    problems.push("it does not tag its figures with the [source id] the fire actions returned");
  }

  if (!problems.length) return null;
  return {
    retryMessage: `Revise the answer before sending it: ${problems.join("; ")}. Call the fire actions for anything you have not checked, quote only figures they return, and tag each claim with its [source id]. If a figure cannot be grounded, drop it or say it is unknown.`,
    maxRetries: 1,
  };
}
