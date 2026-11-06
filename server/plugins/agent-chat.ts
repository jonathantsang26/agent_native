import { getOrgContext } from "@agent-native/core/org";
import {
  createAgentChatPlugin,
  loadActionsFromStaticRegistry,
} from "@agent-native/core/server";

import actionsRegistry from "../../.generated/actions-registry.js";
import {
  APP_ID,
  FIRE_DATA_ACTIONS,
  INITIAL_TOOL_NAMES,
  SYSTEM_PROMPT,
} from "../lib/fire/agent-config.js";
import { fireAnswerGuard } from "../lib/fire/guard.js";

export default createAgentChatPlugin({
  appId: APP_ID,
  actions: loadActionsFromStaticRegistry(actionsRegistry),
  mcp: { connectorCatalog: FIRE_DATA_ACTIONS, appApprovalPage: true },
  initialToolNames: INITIAL_TOOL_NAMES,
  // The fire data lives in the bundled files, not SQL; the agent works through actions.
  frameworkTools: { database: "off" },
  finalResponseGuard: fireAnswerGuard,
  resolveOrgId: async (event) => (await getOrgContext(event)).orgId,
  systemPrompt: SYSTEM_PROMPT,
});
