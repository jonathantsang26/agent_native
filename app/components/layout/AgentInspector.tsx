import { navigateWithAgentChatViewTransition } from "@agent-native/core/client/agent-chat";
import { useT } from "@agent-native/core/client/i18n";
import { focusAgentChat } from "@agent-native/toolkit/app/chat";
import { AgentSidebar } from "@agent-native/toolkit/app/chat";
import { type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";

import { chatThreadPath } from "@/lib/chat-paths";
import { TAB_ID } from "@/lib/tab-id";

/** Starter prompts on the incident map; each exercises the fire actions and update-map. */
const FIRE_SUGGESTIONS = [
  "When did the fire reach Lake Avenue? Show me on the map.",
  "How big was the fire at 4 AM on Jan 8, and what was the wind doing?",
  "Where near Altadena was the damage worst?",
];

interface AgentInspectorProps {
  children: ReactNode;
  chatHomeHandoffActive: boolean;
  chatHomeHandoffPending: boolean;
}

/** Contextual inspector shell used on secondary chat routes. */
export function AgentInspector({
  children,
  chatHomeHandoffActive,
  chatHomeHandoffPending,
}: AgentInspectorProps) {
  const navigate = useNavigate();
  const t = useT();
  const onFireMap = useLocation().pathname.startsWith("/fires/");

  function openAskAgentFullscreen(threadId?: string) {
    focusAgentChat();
    navigateWithAgentChatViewTransition(navigate, chatThreadPath(threadId));
  }

  return (
    <AgentSidebar
      position="right"
      chatViewTransition
      chatViewTransitionHandoff={chatHomeHandoffPending}
      storageKey="chat"
      browserTabId={TAB_ID}
      openOnChatRunning={chatHomeHandoffActive}
      onFullscreenRequest={openAskAgentFullscreen}
      emptyStateText={
        onFireMap
          ? "Ask about the fire on the map. I can read what you see and move the map."
          : t("chat.inspectEmptyState")
      }
      agentPageHref="/settings/agent"
      suggestions={
        onFireMap
          ? FIRE_SUGGESTIONS
          : [
              t("chat.inspectSuggestionCapabilities"),
              t("chat.inspectSuggestionHello"),
              t("chat.inspectSuggestionAction"),
            ]
      }
    >
      {children}
    </AgentSidebar>
  );
}
