/**
 * Runs `pnpm eval` through the same agent the chat uses: the read-only action
 * registry, the framework prompt plus this app's system prompt, the starting
 * tools, the response guard and the shared agent loop.
 */
import type {
  AgentRunOutput,
  EvalProductionChatPath,
  EvalProductionContext,
  EvalProductionIdentity,
} from "@agent-native/core/eval";
import {
  actionsToEngineTools,
  attachToolSearch,
  buildFrameworkPrompts,
  generateActionsPrompt,
  loadActionsFromStaticRegistry,
  runAgentLoop,
  TOOL_SEARCH_ACTION_NAME,
  type ActionEntry,
  type AgentChatEvent,
  type AgentLoopFinalResponseGuard,
} from "@agent-native/core/server";

import actionsRegistry from "../.generated/actions-registry.js";
import {
  APP_ID,
  FIRE_DATA_ACTIONS,
  INITIAL_TOOL_NAMES,
  SYSTEM_PROMPT,
} from "../server/lib/fire/agent-config.js";
import { fireAnswerGuard } from "../server/lib/fire/guard.js";

type RunArgs = Parameters<EvalProductionChatPath["run"]>[0];

function toMessages(input: RunArgs["input"]): Parameters<typeof runAgentLoop>[0]["messages"] {
  const messages: Parameters<typeof runAgentLoop>[0]["messages"] = [];
  for (const turn of input.history ?? []) {
    messages.push({ role: turn.role, content: [{ type: "text", text: turn.text }] });
  }
  messages.push({ role: "user", content: [{ type: "text", text: input.prompt }] });
  return messages;
}

function systemPromptFor(actions: Record<string, ActionEntry>, initialToolNames: string[]): string {
  return [
    buildFrameworkPrompts(undefined, {}).PROD_FRAMEWORK_PROMPT_COMPACT,
    generateActionsPrompt(actions, "tool", initialToolNames),
    SYSTEM_PROMPT,
    "This eval runs without a browser: there is no screen to read or change. Pass the fire id the question names.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function allowed(registry: Record<string, ActionEntry>, allowlist: readonly string[]) {
  const unknown = allowlist.filter((name) => !registry[name]);
  if (unknown.length) throw new Error(`Eval action allowlist has unknown actions: ${unknown.join(", ")}.`);
  const names = new Set(allowlist);
  const actions = Object.fromEntries(
    Object.entries(registry).filter(([name]) => names.has(name) && name !== TOOL_SEARCH_ACTION_NAME),
  );
  if (names.has(TOOL_SEARCH_ACTION_NAME)) attachToolSearch(actions);
  return actions;
}

const startingTools = (actions: Record<string, ActionEntry>) =>
  [...new Set([...INITIAL_TOOL_NAMES, TOOL_SEARCH_ACTION_NAME])].filter((name) => Boolean(actions[name]));

async function runProductionPath(
  args: RunArgs & { actions: Record<string, ActionEntry>; initialToolNames: string[] },
): Promise<Awaited<ReturnType<EvalProductionChatPath["run"]>>> {
  const runId = `eval:${crypto.randomUUID()}`;
  const prompt = systemPromptFor(args.actions, args.initialToolNames);
  const availableTools = actionsToEngineTools(args.actions);
  const initial = new Set(args.initialToolNames);
  const availableActionNames = Object.keys(args.actions);

  const calls: Array<NonNullable<AgentRunOutput["toolCallDetails"]>[number]> = [];
  const pending: Array<{ id?: string; name: string; input: unknown; startedAtEventIndex: number } & Record<string, unknown>> = [];
  let text = "";
  let error: string | undefined;
  let eventIndex = 0;
  let guardApplied = false;
  const guard: AgentLoopFinalResponseGuard = async (context) => {
    guardApplied = true;
    return fireAnswerGuard(context);
  };
  const send = (event: AgentChatEvent) => {
    const index = eventIndex++;
    if (event.type === "text") text += event.text;
    else if (event.type === "tool_start") {
      pending.push({ id: event.id, name: event.tool, input: event.input, startedAtEventIndex: index });
    } else if (event.type === "tool_done") {
      const call = event.id
        ? pending.find((c) => c.id === event.id)
        : pending.find((c) => c.name === event.tool && !c.completed);
      if (call) {
        Object.assign(call, {
          completed: true,
          completedAtEventIndex: index,
          completedSideEffect: event.completedSideEffect,
          isError: event.isError === true,
          result: event.result,
        });
      }
    } else if (event.type === "error") error = event.error;
  };

  const receipt = {
    productionAgentLoopInvoked: false,
    requestPreparationInvoked: true,
    systemPromptBuilt: Boolean(prompt.trim()),
    finalResponseGuardInstalled: true,
    finalResponseGuardApplied: false,
    usageCaptured: false,
    prefetchStatus: "empty" as const,
    ownerEmail: args.identity.ownerEmail,
    orgId: args.identity.orgId,
    initialToolNames: args.initialToolNames,
    availableActionNames,
    readOnlyActionNames: availableActionNames.filter((n) => args.actions[n]?.readOnly === true),
  };

  const started = Date.now();
  let ok = true;
  let usage: Awaited<ReturnType<typeof runAgentLoop>> | undefined;
  try {
    receipt.productionAgentLoopInvoked = true;
    usage = await runAgentLoop({
      engine: args.engine,
      model: args.model,
      systemPrompt: prompt,
      tools: availableTools.filter((tool) => initial.has(tool.name)),
      availableTools,
      messages: toMessages(args.input),
      actions: args.actions,
      send,
      signal: args.signal,
      onUsage: args.onUsage,
      ownerEmail: args.identity.ownerEmail,
      orgId: args.identity.orgId,
      appId: APP_ID,
      actionCaller: "tool",
      finalResponseGuard: guard,
      finalResponseGuardRequestText: args.input.prompt,
      runId,
    });
  } catch (cause) {
    ok = false;
    error = cause instanceof Error ? cause.message : String(cause);
  }
  receipt.finalResponseGuardApplied = guardApplied;
  receipt.usageCaptured = Boolean(usage);
  calls.push(...pending.map(({ id: _id, ...call }) => call as (typeof calls)[number]));

  const output: AgentRunOutput = {
    text,
    toolCalls: calls.map((call) => call.name),
    toolCallDetails: calls,
    ok: ok && !error && !args.signal.aborted,
    ...(error ? { error } : {}),
    runId,
    durationMs: Date.now() - started,
    ...(usage ? { usage } : {}),
  };
  return { output, receipt };
}

/** The fire evals' agent: read-only actions only, so an eval never writes app data. */
export function resolveProductionEvalContext(identity: EvalProductionIdentity): EvalProductionContext {
  const ownerEmail = identity.ownerEmail.trim();
  const orgId = identity.orgId.trim();
  if (!ownerEmail || !orgId) throw new Error("Evals need a non-empty owner email and org id.");

  const actions = Object.fromEntries(
    Object.entries(loadActionsFromStaticRegistry(actionsRegistry)).filter(
      ([, action]) => action.readOnly === true && action.agentTool !== false,
    ),
  );
  const missing = FIRE_DATA_ACTIONS.filter((name) => !actions[name]);
  if (missing.length) throw new Error(`Eval registry is missing fire actions: ${missing.join(", ")}.`);
  attachToolSearch(actions);
  const initialToolNames = startingTools(actions);

  const productionChatPath: EvalProductionChatPath = {
    run: (args) => {
      const evalActions = allowed(actions, args.actionAllowlist);
      return runProductionPath({ ...args, actions: evalActions, initialToolNames: startingTools(evalActions) });
    },
  };

  return {
    actions,
    systemPrompt: systemPromptFor(actions, initialToolNames),
    finalResponseGuard: fireAnswerGuard,
    ownerEmail,
    orgId,
    appId: APP_ID,
    initialToolNames,
    productionChatPath,
  };
}
