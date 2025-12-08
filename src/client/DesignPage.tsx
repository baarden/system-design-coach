import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useParams, Navigate } from "react-router-dom";
import { ExcalidrawClient } from "./components/ExcalidrawClient";
import { useAuth } from "./providers/auth";
import { ChatWidget } from "./components/ChatWidget";
import { ResizableMarkdownPanel } from "./components/ResizablePanel";
import { useWebSocketMessages, useFeedbackRequest, useDemoImage, useUserCommentSteps } from "./hooks";
import type { CommentStep } from "./hooks";
import {
  TextField,
  Button,
  Box,
  CircularProgress,
  Snackbar,
  Alert,
  Select,
  MenuItem,
} from "@mui/material";
import { AppBar } from "./components/AppBar";
import { useTheme } from "./providers/theme";
import { fetchProblem, getServerUrl } from "./api";

interface DesignPageProps {
  title?: string;
  claudeFeedback?: string;
  /** Guest mode - uses token-based access instead of owner access */
  guestMode?: boolean;
  /** Share token for guest access */
  guestToken?: string;
  /** Override the roomId (used when guest mode resolves token to room) */
  overrideRoomId?: string;
}

function DesignPage({
  title = "System Design Coach",
  claudeFeedback = "",
  guestMode = false,
  guestToken,
  overrideRoomId,
}: DesignPageProps) {
  const { user, questionId } = useParams<{
    user: string;
    questionId: string;
  }>();
  const { userId, isLoaded, isSignedIn, reloadUser, onUnavailable } = useAuth();

  // Auth checks for owner routes (not guest mode)
  if (!guestMode) {
    // Redirect to home if not signed in
    if (isLoaded && !isSignedIn) {
      return <Navigate to="/" replace />;
    }

    // Block access if URL user doesn't match authenticated user
    // In NoopAuth mode, userId is "default-user", so only /default-user/* URLs work
    if (isLoaded && isSignedIn && user && userId !== user) {
      return (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Alert severity="error">
            You don't have permission to access this room.
          </Alert>
        </Box>
      );
    }
  }
  const { mode } = useTheme();

  // UI state
  const [problemStatement, setProblemStatement] = useState<string>("");
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [claudeFeedbackText, setClaudeFeedback] = useState<string>(claudeFeedback || "");

  // User comment steps management
  const {
    steps: commentSteps,
    latestDraft,
    currentStepContent,
    isViewingLatestStep,
    totalSteps,
    setLatestDraft,
    selectStep,
    initializeFromHistory,
    resetAfterSubmit,
  } = useUserCommentSteps();
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [incomingChatMessage, setIncomingChatMessage] = useState<unknown | null>(null);
  const [isApiReady, setIsApiReady] = useState<boolean>(false);

  // Panel heights for resizable panels
  const [commentsHeight, setCommentsHeight] = useState<number>(120);
  const [feedbackHeight, setFeedbackHeight] = useState<number>(120);
  const [problemStatementHeight, setProblemStatementHeight] = useState<number>(120);

  // Drag states for resizable panels
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isDraggingFeedback, setIsDraggingFeedback] = useState<boolean>(false);
  const [isDraggingProblemStatement, setIsDraggingProblemStatement] = useState<boolean>(false);

  // Scroll fade states
  const [hasScrollTop, setHasScrollTop] = useState<boolean>(false);
  const [hasScrollBottom, setHasScrollBottom] = useState<boolean>(false);
  const [hasProblemScrollTop, setHasProblemScrollTop] = useState<boolean>(false);
  const [hasProblemScrollBottom, setHasProblemScrollBottom] = useState<boolean>(false);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const excalidrawApiRef = useRef<{
    send: (message: unknown) => void;
    syncToBackend: () => Promise<void>;
  } | null>(null);
  const feedbackScrollRef = useRef<HTMLDivElement>(null);
  const problemScrollRef = useRef<HTMLDivElement>(null);

  // Construct roomId from URL params or override (guest mode)
  const roomId = overrideRoomId || (user && questionId ? `${user}/${questionId}` : null);
  const problemIdFromRoom = roomId?.split('/')[1] ?? questionId;
  // Auth checks above ensure we're signed in with a valid userId that matches URL user.
  // NoopAuthProvider returns "default-user"; real auth returns the actual user ID.
  const effectiveUserId = userId!;
  // Owner if accessing via owner route (not guest mode)
  const isOwner = !guestMode;

  // Construct WebSocket path based on access mode
  const wsPath = guestMode && guestToken
    ? `/ws/guest/${guestToken}`
    : roomId ? `/ws/owner/${roomId}` : null;

  // Demo image loader
  const { loadDemoImageIfEmpty } = useDemoImage();

  // Feedback request hook
  const {
    handleGetFeedback,
    isFeedbackLoading,
    setIsFeedbackLoading,
    pendingEventIdRef,
  } = useFeedbackRequest({
    excalidrawApiRef,
    roomId,
    userId: effectiveUserId,
    userComments: latestDraft,
    onError: setErrorMessage,
  });

  // WebSocket message handlers
  const messageHandlers = useMemo(
    () => ({
      onChatMessage: (data: unknown) => {
        setIncomingChatMessage(data);
      },
      onClaudeFeedback: (feedback: string) => {
        setClaudeFeedback(feedback);
      },
      onNextPrompt: (prompt: string) => {
        setProblemStatement(prompt);
      },
      onFeedbackComplete: () => {
        setIsFeedbackLoading(false);
      },
      onFeedbackError: (message: string, needsCredits?: boolean) => {
        setIsFeedbackLoading(false);
        setErrorMessage(message);
        if (needsCredits) {
          onUnavailable();
        }
      },
      onError: (message: string) => {
        setErrorMessage(message);
      },
      onUserCommentsReset: () => {
        resetAfterSubmit();
      },
      onUserCommentHistory: (comments: CommentStep[]) => {
        initializeFromHistory(comments);
      },
      reloadUser,
    }),
    [reloadUser, setIsFeedbackLoading, resetAfterSubmit, initializeFromHistory, onUnavailable]
  );

  // WebSocket message handler
  const { handleWebSocketMessage } = useWebSocketMessages({
    pendingEventIdRef,
    handlers: messageHandlers,
  });

  // Fetch problem statement on mount
  useEffect(() => {
    const problemId = problemIdFromRoom;
    if (!problemId) return;

    fetchProblem(problemId)
      .then((data) => {
        if (data.success && data.problem) {
          setProblemStatement(data.problem.statement);
        }
      })
      .catch((error) => {
        console.error("Error fetching problem:", error);
      });
  }, [problemIdFromRoom]);

  // Don't render until we have valid roomId
  if (!roomId) {
    return null;
  }


  const handleMouseDown = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleFeedbackMouseDown = useCallback(() => {
    setIsDraggingFeedback(true);
  }, []);

  const handleProblemStatementMouseDown = useCallback(() => {
    setIsDraggingProblemStatement(true);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const minHeight = 80;
      const maxHeight = containerRect.height * 0.4;

      if (isDragging) {
        const bottomOfContainer = containerRect.bottom;
        const newHeight = bottomOfContainer - e.clientY - 56; // Account for button + gaps
        setCommentsHeight(Math.max(minHeight, Math.min(maxHeight, newHeight)));
      }

      if (isDraggingFeedback) {
        const topOfContainer = containerRect.top;
        const newHeight = e.clientY - topOfContainer - 16; // Account for container padding
        setFeedbackHeight(Math.max(minHeight, Math.min(maxHeight, newHeight)));
      }

      if (isDraggingProblemStatement) {
        const topOfContainer = containerRect.top;
        const feedbackOffset = feedbackHeight + 32; // Account for feedback box + gap
        const newHeight = e.clientY - topOfContainer - feedbackOffset;
        setProblemStatementHeight(
          Math.max(minHeight, Math.min(maxHeight, newHeight))
        );
      }
    },
    [isDragging, isDraggingFeedback, isDraggingProblemStatement, feedbackHeight]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsDraggingFeedback(false);
    setIsDraggingProblemStatement(false);
  }, []);

  // Add and remove event listeners
  useEffect(() => {
    if (isDragging || isDraggingFeedback || isDraggingProblemStatement) {
      document.addEventListener("mousemove", handleMouseMove as any);
      document.addEventListener("mouseup", handleMouseUp);
    } else {
      document.removeEventListener("mousemove", handleMouseMove as any);
      document.removeEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove as any);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [
    isDragging,
    isDraggingFeedback,
    isDraggingProblemStatement,
    handleMouseMove,
    handleMouseUp,
  ]);

  // Handle scroll detection for fade effects
  const handleFeedbackScroll = useCallback(() => {
    const element = feedbackScrollRef.current;
    if (!element) return;

    const { scrollTop, scrollHeight, clientHeight } = element;
    setHasScrollTop(scrollTop > 0);
    setHasScrollBottom(scrollTop + clientHeight < scrollHeight - 1);
  }, []);

  // Setup scroll listener and initial check
  useEffect(() => {
    const element = feedbackScrollRef.current;
    if (!element) return;

    // Check initial scroll state
    handleFeedbackScroll();

    element.addEventListener("scroll", handleFeedbackScroll);
    return () => element.removeEventListener("scroll", handleFeedbackScroll);
  }, [handleFeedbackScroll]);

  // Re-check scroll state when feedback text changes
  useEffect(() => {
    handleFeedbackScroll();
  }, [claudeFeedbackText, handleFeedbackScroll]);

  // Handle scroll detection for problem statement fade effects
  const handleProblemStatementScroll = useCallback(() => {
    const element = problemScrollRef.current;
    if (!element) return;

    const { scrollTop, scrollHeight, clientHeight } = element;
    setHasProblemScrollTop(scrollTop > 0);
    setHasProblemScrollBottom(scrollTop + clientHeight < scrollHeight - 1);
  }, []);

  // Setup scroll listener and initial check for problem statement
  useEffect(() => {
    const element = problemScrollRef.current;
    if (!element) return;

    handleProblemStatementScroll();

    element.addEventListener("scroll", handleProblemStatementScroll);
    return () =>
      element.removeEventListener("scroll", handleProblemStatementScroll);
  }, [handleProblemStatementScroll]);

  // Re-check scroll state when problem statement changes
  useEffect(() => {
    handleProblemStatementScroll();
  }, [problemStatement, handleProblemStatementScroll]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <AppBar title={title} isConnected={isConnected} roomId={roomId} isOwner={isOwner} />

      {/* Main Content */}
      <Box
        ref={containerRef}
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          p: 2,
          gap: 2,
        }}
      >
        {/* Claude Feedback */}
        <ResizableMarkdownPanel
          label="Claude Feedback"
          content={claudeFeedbackText}
          height={feedbackHeight}
          scrollRef={feedbackScrollRef}
          hasScrollTop={hasScrollTop}
          hasScrollBottom={hasScrollBottom}
          onDragStart={handleFeedbackMouseDown}
        />

        {/* Problem Statement */}
        <ResizableMarkdownPanel
          label="Problem Statement"
          content={problemStatement}
          height={problemStatementHeight}
          scrollRef={problemScrollRef}
          hasScrollTop={hasProblemScrollTop}
          hasScrollBottom={hasProblemScrollBottom}
          onDragStart={handleProblemStatementMouseDown}
        />

        {/* Excalidraw Canvas - Fills remaining space */}
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            border: 1,
            borderColor: "divider",
            borderRadius: 1,
            overflow: "hidden",
          }}
        >
          <ExcalidrawClient
            serverUrl={getServerUrl()}
            roomId={roomId}
            wsPath={wsPath ?? undefined}
            theme={mode}
            onConnect={() => setIsConnected(true)}
            onDisconnect={() => setIsConnected(false)}
            onReady={(api, initialElements) => {
              excalidrawApiRef.current = api;
              setIsApiReady(true);
              loadDemoImageIfEmpty(api.excalidrawAPI, initialElements.length);
            }}
            onMessage={handleWebSocketMessage}
            onSyncError={(error) => {
              console.error("Sync error:", error);
            }}
          />
        </Box>

        {/* User Comments with draggable top border */}
        <Box
          sx={{
            position: "relative",
            height: `${commentsHeight}px`,
            width: "100%",
          }}
        >
          {/* Drag handle overlay on top border */}
          <Box
            onMouseDown={handleMouseDown}
            sx={{
              position: "absolute",
              top: -4,
              left: 0,
              right: 0,
              height: "12px",
              cursor: "ns-resize",
              zIndex: 1,
            }}
          />
          {/* TextField with embedded step selector in border */}
          <Box sx={{ position: "relative", height: "100%" }}>
            {/* Step Dropdown - embedded in border like a label */}
            <Select
              size="small"
              value={isViewingLatestStep ? totalSteps : (commentSteps.findIndex(s => s.content === currentStepContent) + 1)}
              onChange={(e) => selectStep(Number(e.target.value))}
              variant="standard"
              disableUnderline
              sx={{
                position: "absolute",
                top: -10,
                left: 8,
                zIndex: 1,
                backgroundColor: "background.paper",
                px: 0.5,
                fontSize: "0.75rem",
                "& .MuiSelect-select": {
                  py: 0,
                  pr: "20px !important",
                  fontSize: "0.75rem",
                  color: isViewingLatestStep ? "text.secondary" : "warning.main",
                },
                "& .MuiSvgIcon-root": {
                  fontSize: "1rem",
                  right: 0,
                },
              }}
            >
              {commentSteps.map((step) => (
                <MenuItem key={step.stepNumber} value={step.stepNumber} sx={{ fontSize: "0.875rem" }}>
                  User comments [step {step.stepNumber}]
                </MenuItem>
              ))}
              <MenuItem value={totalSteps} sx={{ fontSize: "0.875rem" }}>
                User comments [step {totalSteps}]{commentSteps.length > 0 ? " (current)" : ""}
              </MenuItem>
            </Select>

            {/* TextField */}
            <TextField
              multiline
              value={currentStepContent}
              onChange={(e) => {
                if (isViewingLatestStep) {
                  setLatestDraft(e.target.value);
                }
              }}
              disabled={!isViewingLatestStep}
              placeholder={isViewingLatestStep ? "Add your notes and comments here..." : ""}
              sx={{
                width: "100%",
                height: "100%",
                "& .MuiInputBase-root": {
                  height: "100%",
                  overflow: "auto",
                  alignItems: "flex-start",
                  pt: 1.5,
                  ...((!isViewingLatestStep) && {
                    backgroundColor: "action.disabledBackground",
                  }),
                },
                "& .MuiOutlinedInput-notchedOutline": {
                  "& legend": {
                    maxWidth: 0,
                  },
                },
              }}
              InputProps={{
                readOnly: !isViewingLatestStep,
              }}
            />
          </Box>
        </Box>

        {/* Get Feedback Button - disabled for guests */}
        <Button
          variant="contained"
          onClick={handleGetFeedback}
          disabled={isFeedbackLoading || !isOwner}
          startIcon={
            isFeedbackLoading ? (
              <CircularProgress size={20} color="inherit" />
            ) : null
          }
          sx={{ alignSelf: "flex-start" }}
        >
          {isFeedbackLoading ? "Getting Feedback..." : "Get Feedback"}
        </Button>
      </Box>

      {/* Error Snackbar */}
      <Snackbar
        open={!!errorMessage}
        autoHideDuration={6000}
        onClose={() => setErrorMessage("")}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setErrorMessage("")}
          severity="error"
          sx={{ width: "100%" }}
        >
          {errorMessage}
        </Alert>
      </Snackbar>

      {/* Chat Widget - only shown to room owner */}
      {isApiReady && isOwner && (
        <ChatWidget
          sendMessage={(message) => excalidrawApiRef.current?.send(message)}
          userId={effectiveUserId}
          onUnavailable={onUnavailable}
          incomingMessage={incomingChatMessage as Parameters<typeof ChatWidget>[0]["incomingMessage"]}
          onMessageConsumed={() => setIncomingChatMessage(null)}
        />
      )}
    </Box>
  );
}

export default DesignPage;
