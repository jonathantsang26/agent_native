import type { AgentLoopFinalResponseGuardContext } from "@agent-native/core/server";
import { describe, expect, it } from "vitest";

import { fireAnswerGuard } from "./guard.js";

const STATE = JSON.stringify({
  fire: "eaton",
  result: { t_local: "Wed, Jan 8, 2025, 4:00 AM PST", area_acres: 3411.6, ros_chains_hr: 6.3 },
  sources: [{ id: "s10s6o", layer: "series", label: "3,411.6 acres burned" }],
});

function ctx(
  text: string,
  results: { name: string; content: string; isError?: boolean }[] = [],
  requestText = "How big was the fire at 4 AM?",
): AgentLoopFinalResponseGuardContext {
  return {
    text,
    requestText,
    messages: [],
    assistantContent: [],
    toolCalls: [],
    toolResults: results.map((r) => ({ isError: false, ...r })),
    retryCount: 0,
    executionMode: "chat",
  } as unknown as AgentLoopFinalResponseGuardContext;
}

describe("fireAnswerGuard", () => {
  it("passes an answer whose figures come from this turn's results, tagged", () => {
    const out = fireAnswerGuard(
      ctx("By 4:00 AM PST about 3,412 acres had burned, spreading at 6.3 chains/h [s10s6o].", [
        { name: "get-fire-state", content: STATE },
      ]),
    );
    expect(out).toBeNull();
  });

  it("sends back a figure no result contains", () => {
    const out = fireAnswerGuard(
      ctx("By 4:00 AM PST 5,200 acres had burned [s10s6o].", [
        { name: "get-fire-state", content: STATE },
      ]),
    );
    expect(out && typeof out === "object" && out.retryMessage).toMatch(/5,200/);
  });

  it("sends back figures stated without any fire action", () => {
    const out = fireAnswerGuard(ctx("About 9,400 structures were destroyed."));
    expect(out && typeof out === "object" && out.retryMessage).toMatch(/without calling any fire action/);
  });

  it("ignores failed results as evidence", () => {
    const out = fireAnswerGuard(
      ctx("3,411.6 acres had burned [s10s6o].", [
        { name: "get-fire-state", content: STATE, isError: true },
      ]),
    );
    expect(out).not.toBeNull();
  });

  it("asks for source tags when fire actions ran", () => {
    const out = fireAnswerGuard(
      ctx("By 4:00 AM PST about 3,412 acres had burned.", [
        { name: "get-fire-state", content: STATE },
      ]),
    );
    expect(out && typeof out === "object" && out.retryMessage).toMatch(/source id/);
  });

  it("sends back cause speculation and addresses", () => {
    const cause = fireAnswerGuard(ctx("It was probably caused by power lines."));
    expect(cause && typeof cause === "object" && cause.retryMessage).toMatch(/caused or started/);
    const address = fireAnswerGuard(ctx("The home at 1234 North Lake Avenue burned."));
    expect(address && typeof address === "object" && address.retryMessage).toMatch(/address/);
  });

  it("leaves plain conversation alone", () => {
    expect(fireAnswerGuard(ctx("I can show you when the fire reached a street.", [], "hi"))).toBeNull();
  });
});
