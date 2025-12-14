import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import Chatbot from "react-chatbot-kit";
import "react-chatbot-kit/build/main.css";
import { Box, Fab, Paper, IconButton } from "@mui/material";
import ChatIcon from "@mui/icons-material/Chat";
import CloseIcon from "@mui/icons-material/Close";
import config from "./config";
import ActionProvider from "./ActionProvider";
import { useTheme } from "../../providers/theme";
import "./ChatWidget.css";

interface ChatMessage {
  role: string;
  content: string;
  timestamp: string;
  source: string;
}

interface IncomingChatMessage {
  type: string;
  messages?: ChatMessage[];
  message?: string;
  eventId?: string;
  status?: string;
  needsCredits?: boolean;
}

interface ChatWidgetProps {
  sendMessage: (message: unknown) => void;
  userId: string;
  onUnavailable: () => void;
  incomingMessage?: IncomingChatMessage | null;
  onMessageConsumed?: () => void;
}

interface ChatbotMessage {
  message: string;
  type: "bot" | "user";
  id: number;
}

export default function ChatWidget({
  sendMessage,
  userId,
  onUnavailable,
  incomingMessage,
  onMessageConsumed,
}: ChatWidgetProps) {
  const { mode } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [chatbotKey, setChatbotKey] = useState(0);
  const [messageHistory, setMessageHistory] = useState<ChatbotMessage[] | undefined>(undefined);
  const pendingMessageIdRef = useRef<number | null>(null);
  const pendingEventIdRef = useRef<string | null>(null);
  const actionProviderRef = useRef<ActionProvider | null>(null);

  // Process incoming messages from parent
  useEffect(() => {
    if (!incomingMessage) return;

    const data = incomingMessage;

    if (data.type === "chat-history" && data.messages) {
      // Skip chat-history if we have a pending message - don't clobber current state
      if (pendingMessageIdRef.current) {
        onMessageConsumed?.();
        return;
      }
      // Convert server messages to react-chatbot-kit format
      const formattedMessages: ChatbotMessage[] = data.messages.map((msg, index) => ({
        message: msg.content,
        type: msg.role === "assistant" ? "bot" : "user",
        id: index + 1,
      }));
      setMessageHistory(formattedMessages);
      // Force Chatbot to remount with new history
      setChatbotKey((prev) => prev + 1);
      onMessageConsumed?.();
      return;
    }

    if (data.type === "chat-response" && data.message) {
      if (pendingMessageIdRef.current && actionProviderRef.current) {
        actionProviderRef.current.replaceLoadingMessage(
          pendingMessageIdRef.current,
          data.message
        );
        pendingMessageIdRef.current = null;
      }
      onMessageConsumed?.();
      return;
    }

    // Handle status messages for chat requests
    if (
      data.type === "status" &&
      data.eventId === pendingEventIdRef.current
    ) {
      if (data.status === "error") {
        if (pendingMessageIdRef.current && actionProviderRef.current) {
          actionProviderRef.current.removeLoadingMessage(
            pendingMessageIdRef.current
          );
          actionProviderRef.current.addBotMessage(
            data.needsCredits
              ? "You need more credits to continue chatting."
              : `Error: ${data.message || "An error occurred"}`
          );
          pendingMessageIdRef.current = null;
        }
        if (data.needsCredits) {
          onUnavailable();
        }
      }
      pendingEventIdRef.current = null;
      onMessageConsumed?.();
    }
  }, [incomingMessage, onUnavailable, onMessageConsumed]);

  // Handle user message - called by MessageParser
  const handleUserMessage = useCallback(
    (message: string, actionProvider: ActionProvider) => {
      // Store ref to action provider
      actionProviderRef.current = actionProvider;

      // Add loading message
      const loadingId = actionProvider.addLoadingMessage();
      pendingMessageIdRef.current = loadingId;

      // Send via WebSocket (prefix with "chat-" so App.tsx routes status messages here)
      const eventId = `chat-${crypto.randomUUID()}`;
      pendingEventIdRef.current = eventId;

      sendMessage({
        type: "chat-message",
        eventId,
        message,
        userId,
      });
    },
    [sendMessage, userId]
  );

  // Create MessageParser class with the callback
  const MessageParser = useMemo(() => {
    return class {
      actionProvider: ActionProvider;

      constructor(actionProvider: ActionProvider) {
        this.actionProvider = actionProvider;
      }

      parse = (message: string) => {
        // Don't send empty messages
        if (!message.trim()) {
          return;
        }
        handleUserMessage(message, this.actionProvider);
      };
    };
  }, [handleUserMessage]);

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <Fab
          color="primary"
          aria-label="chat"
          onClick={() => setIsOpen(true)}
          sx={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 1000,
          }}
        >
          <ChatIcon />
        </Fab>
      )}

      {/* Chat Popup - always mounted to preserve state, hidden when closed */}
      <Paper
        elevation={8}
        sx={{
          position: "fixed",
          bottom: 24,
          right: 24,
          width: 380,
          height: 500,
          display: isOpen ? "flex" : "none",
          flexDirection: "column",
          zIndex: 1000,
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
          {/* Header */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              p: 1.5,
              backgroundColor: "primary.main",
              color: "white",
            }}
          >
            <Box sx={{ fontWeight: 600 }}>System Design Assistant</Box>
            <IconButton
              size="small"
              onClick={() => setIsOpen(false)}
              sx={{ color: "white" }}
            >
              <CloseIcon />
            </IconButton>
          </Box>

          {/* Chatbot */}
          <Box sx={{ flex: 1, overflow: "hidden" }} data-theme={mode}>
            <Chatbot
              key={chatbotKey}
              config={config}
              messageParser={MessageParser}
              actionProvider={ActionProvider}
              messageHistory={messageHistory}
              placeholderText="Ask a question..."
            />
          </Box>
        </Paper>
    </>
  );
}
