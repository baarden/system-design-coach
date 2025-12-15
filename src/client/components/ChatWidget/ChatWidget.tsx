import { useState, useRef, useEffect, useCallback } from "react";
import { Box, Fab, Paper, IconButton } from "@mui/material";
import ChatIcon from "@mui/icons-material/Chat";
import CloseIcon from "@mui/icons-material/Close";
import "@chatscope/chat-ui-kit-styles/dist/default/styles.min.css";
import {
  ChatContainer,
  MessageList,
  Message,
  MessageInput,
  TypingIndicator,
} from "@chatscope/chat-ui-kit-react";
import ReactMarkdown from "react-markdown";
import { useTheme } from "../../providers/theme";
import "./ChatWidget.css";

interface ServerChatMessage {
  role: string;
  content: string;
  timestamp: string;
  source: string;
}

interface IncomingChatMessage {
  type: string;
  messages?: ServerChatMessage[];
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

interface ChatMessage {
  id: number;
  content: string;
  direction: "incoming" | "outgoing";
}

const INITIAL_MESSAGE: ChatMessage = {
  id: 0,
  content:
    "Hi! Feel free to ask me anything. But you should know I can't see your current design until after you've clicked the Get Feedback button.",
  direction: "incoming",
};

export default function ChatWidget({
  sendMessage,
  userId,
  onUnavailable,
  incomingMessage,
  onMessageConsumed,
}: ChatWidgetProps) {
  const { mode } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [isTyping, setIsTyping] = useState(false);
  const nextIdRef = useRef(1);
  const pendingEventIdRef = useRef<string | null>(null);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure the element is visible
      setTimeout(() => {
        const input = document.querySelector<HTMLElement>(
          ".cs-message-input__content-editor"
        );
        input?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Process incoming messages from parent
  useEffect(() => {
    if (!incomingMessage) return;

    const data = incomingMessage;

    if (data.type === "chat-history" && data.messages) {
      // Skip chat-history if we're waiting for a response
      if (pendingEventIdRef.current) {
        onMessageConsumed?.();
        return;
      }
      // Convert server messages to our format
      const formattedMessages: ChatMessage[] = data.messages.map(
        (msg, index) => ({
          id: index + 1,
          content: msg.content,
          direction: msg.role === "assistant" ? "incoming" : "outgoing",
        })
      );
      setMessages([INITIAL_MESSAGE, ...formattedMessages]);
      nextIdRef.current = formattedMessages.length + 1;
      onMessageConsumed?.();
      return;
    }

    if (data.type === "chat-response" && data.message) {
      if (pendingEventIdRef.current) {
        setIsTyping(false);
        setMessages((prev) => [
          ...prev,
          {
            id: nextIdRef.current++,
            content: data.message!,
            direction: "incoming",
          },
        ]);
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
        setIsTyping(false);
        const errorMessage = data.needsCredits
          ? "You need more credits to continue chatting."
          : `Error: ${data.message || "An error occurred"}`;
        setMessages((prev) => [
          ...prev,
          {
            id: nextIdRef.current++,
            content: errorMessage,
            direction: "incoming",
          },
        ]);
        if (data.needsCredits) {
          onUnavailable();
        }
      }
      pendingEventIdRef.current = null;
      onMessageConsumed?.();
    }
  }, [incomingMessage, onUnavailable, onMessageConsumed]);

  const handleSend = useCallback(
    (textContent: string) => {
      const trimmed = textContent.trim();
      if (!trimmed) return;

      // Add user message
      setMessages((prev) => [
        ...prev,
        {
          id: nextIdRef.current++,
          content: trimmed,
          direction: "outgoing",
        },
      ]);

      // Show typing indicator
      setIsTyping(true);

      // Send via WebSocket
      const eventId = `chat-${crypto.randomUUID()}`;
      pendingEventIdRef.current = eventId;

      sendMessage({
        type: "chat-message",
        eventId,
        message: trimmed,
        userId,
      });
    },
    [sendMessage, userId]
  );

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

      {/* Chat Popup */}
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

        {/* Chat Container */}
        <Box sx={{ flex: 1, overflow: "hidden" }} data-theme={mode}>
          <ChatContainer>
            <MessageList
              typingIndicator={
                isTyping ? (
                  <TypingIndicator content="Assistant is typing" />
                ) : null
              }
            >
              {messages.map((msg) => (
                <Message
                  key={msg.id}
                  model={{
                    direction: msg.direction,
                    position: "single",
                  }}
                >
                  {msg.direction === "incoming" ? (
                    <Message.CustomContent>
                      <div className="chat-bot-message-markdown">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    </Message.CustomContent>
                  ) : (
                    <Message.TextContent text={msg.content} />
                  )}
                </Message>
              ))}
            </MessageList>
            <MessageInput
              placeholder="Ask a question..."
              onSend={(_, textContent) => handleSend(textContent)}
              attachButton={false}
            />
          </ChatContainer>
        </Box>
      </Paper>
    </>
  );
}
