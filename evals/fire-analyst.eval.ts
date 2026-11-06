/**
 * Fire-analyst evals: 33 questions with answers computed straight from the fire
 * data, independent of the actions. Run against the live agent with
 * `pnpm eval` (needs a model key); `--json` for CI.
 */
import { createScorer, defineEval, usesTool, type Eval } from "@agent-native/core/eval";

import eaton from "../public/data/eaton/eval/analyst.json";
import palisades from "../public/data/palisades/eval/analyst.json";
import {
  expectedAction,
  scoreAnswer,
  type EvalCase,
} from "../server/lib/fire/eval-scoring.js";

const FIRES = [
  { id: "eaton", name: "Eaton Fire", file: eaton },
  { id: "palisades", name: "Palisades Fire", file: palisades },
] as const;

function matchesTruth(c: EvalCase) {
  return createScorer<{ text: string }, { pass: boolean; reason: string }>({
    name: "matches-truth",
    preprocess: (run) => ({ text: run.text }),
    analyze: ({ text }) => scoreAnswer(c, text),
    generateScore: (a) => (a.pass ? 1 : 0),
    generateReason: ({ analysis }) => analysis.reason,
  });
}

/** Declines carry no figures, so only answers with numbers need a source tag. */
const citesSources = createScorer<{ text: string }, { ok: boolean }>({
  name: "cites-sources",
  preprocess: (run) => ({ text: run.text }),
  analyze: ({ text }) => ({ ok: !/\d/.test(text) || /\[\s*s[0-9a-z]{2,8}/i.test(text) }),
  generateScore: (a) => (a.ok ? 1 : 0),
  generateReason: ({ analysis }) =>
    analysis.ok ? "figures carry source ids" : "figures without a [source id]",
});

const evals: Eval[] = FIRES.flatMap(({ id, name, file }) =>
  (file as { questions: EvalCase[] }).questions.map((c) =>
    defineEval({
      name: `${id}/${c.id}`,
      input: { prompt: `${name} (fire id "${id}"): ${c.question}` },
      scorers: [matchesTruth(c), usesTool(expectedAction(c.id)), citesSources],
      threshold: 1,
    }),
  ),
);

export default evals;
