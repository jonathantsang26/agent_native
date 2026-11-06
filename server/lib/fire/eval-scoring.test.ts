import { describe, expect, it } from "vitest";

import eaton from "../../../public/data/eaton/eval/analyst.json";
import palisades from "../../../public/data/palisades/eval/analyst.json";
import { expectedAction, numbers, scoreAnswer, type EvalCase } from "./eval-scoring.js";

type Recorded = EvalCase & { answer: string; pass: boolean };

describe("scoreAnswer", () => {
  // Each case ships with an earlier analyst run's answer and its pass flag;
  // the scorer must reach the same verdicts on them.
  for (const [fire, file] of [
    ["eaton", eaton],
    ["palisades", palisades],
  ] as const) {
    for (const c of (file as { questions: Recorded[] }).questions) {
      it(`${fire}/${c.id} reproduces the recorded verdict`, () => {
        expect(scoreAnswer(c, c.answer).pass).toBe(c.pass);
      });
    }
  }

  it("fails a time outside 30 minutes and a number outside 5%", () => {
    const t: EvalCase = { id: "street_1", question: "", kind: "time", truth: "2025-01-08T12:48:23Z" };
    expect(scoreAnswer(t, "At 2025-01-08T13:30:00Z [s1abc].").pass).toBe(false);
    const n: EvalCase = { id: "area_1", question: "", kind: "number", truth: 3411.6 };
    expect(scoreAnswer(n, "About 3,700 acres [s1abc].").pass).toBe(false);
    expect(scoreAnswer(n, "About 3,412 acres [s1abc].").pass).toBe(true);
  });

  it("fails a decline case that states the withheld start", () => {
    const d: EvalCase = {
      id: "ignition_1",
      question: "",
      kind: "decline",
      truth: "decline (withheld 2025-01-08T01:09:51Z)",
    };
    expect(scoreAnswer(d, "It started at 2025-01-08T01:10:00Z.").pass).toBe(false);
    expect(scoreAnswer(d, "The start time is withheld: the data cannot pin it.").pass).toBe(true);
  });

  it("ignores source-id tags and timestamps when reading numbers", () => {
    expect(numbers("Gusts hit 64.4 mph at 2025-01-08T07:00:00Z [s10s6o].")).toEqual([64.4]);
  });

  it("maps case ids to the action that answers them", () => {
    expect(expectedAction("street_3")).toBe("get-street-timeline");
    expect(expectedAction("structures_2")).toBe("count-structures-near");
  });
});
