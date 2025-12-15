import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useParams, Navigate, Link } from "react-router-dom";
import { ExcalidrawClient } from "./components/ExcalidrawClient";
import { useAuth } from "./providers/auth";
import { ChatWidget } from "./components/ChatWidget";
import { ResizableMarkdownPanel } from "./components/ResizablePanel";
import { useWebSocketMessages, useFeedbackRequest, useUserCommentSteps, useClaudeFeedbackSteps, useProblemStatementSteps, useYjsComments } from "./hooks";
import type { CommentStep, FeedbackStep, ProblemStatementStep } from "./hooks";
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
import { TutorialDialog } from "./components/TutorialDialog";
import { useTheme } from "./providers/theme";
import { fetchProblem, getServerUrl } from "./api";
import { YjsProvider, useYjs } from "./providers/yjs";
import type { ExcalidrawMessage } from "@shared/types/excalidraw";

const TUTORIAL_SEEN_KEY = 'tutorial-seen';

interface DesignPageProps {
  title?: string;
  /** Guest mode - uses token-based access instead of owner access */
  guestMode?: boolean;
  /** Share token for guest access */
  guestToken?: string;
  /** Override the roomId (used when guest mode resolves token to room) */
  overrideRoomId?: string;
}

function DesignPage({
  title = "System Design Coach",
  guestMode = false,
  guestToken,
  overrideRoomId,
}: DesignPageProps) {
  const { user, questionId } = useParams<{
    user: string;
    questionId: string;
  }>();
  const { userId, isLoaded, isSignedIn } = useAuth();

  // Refs for bridging WebSocket messages with YjsProvider
  // IMPORTANT: These must come before any conditional returns (React hooks rules)
  const sendMessageRef = useRef<(msg: unknown) => void>(() => {});
  const yjsMessageHandlerRef = useRef<((payload: number[]) => void) | null>(null);

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
          <Alert severity="error" sx={{ mb: 2 }}>
            You don't have permission to access this room.
          </Alert>
          <Button component={Link} to="/" variant="contained">
            Return to home page
          </Button>
        </Box>
      );
    }
  }

  // Construct roomId from URL params or override (guest mode)
  const roomId = overrideRoomId || (user && questionId ? `${user}/${questionId}` : null);

  // Don't render until we have valid roomId
  if (!roomId) {
    return null;
  }

  return (
    <YjsProvider
      sendMessage={(msg) => sendMessageRef.current(msg)}
      onYjsMessage={(handler) => { yjsMessageHandlerRef.current = handler; }}
    >
      <DesignPageContent
        title={title}
        guestMode={guestMode}
        guestToken={guestToken}
        roomId={roomId}
        sendMessageRef={sendMessageRef}
        yjsMessageHandlerRef={yjsMessageHandlerRef}
      />
    </YjsProvider>
  );
}

interface DesignPageContentProps {
  title: string;
  guestMode: boolean;
  guestToken?: string;
  roomId: string;
  sendMessageRef: React.MutableRefObject<(msg: unknown) => void>;
  yjsMessageHandlerRef: React.MutableRefObject<((payload: number[]) => void) | null>;
}

function DesignPageContent({
  title,
  guestMode,
  guestToken,
  roomId,
  sendMessageRef,
  yjsMessageHandlerRef,
}: DesignPageContentProps) {
  const { userId, reloadUser, onUnavailable } = useAuth();
  const { mode } = useTheme();

  // Get Yjs context for collaborative sync
  const { yElements, yComments, requestSync } = useYjs();

  // Use Yjs-backed comments for real-time collaboration
  const { comments: yjsComments, setComments: setYjsComments } = useYjsComments(yComments);

  // UI state
  const [connectionState, setConnectionState] = useState<'connected' | 'idle' | 'disconnected'>('disconnected');

  // User comment steps management (for history navigation)
  const {
    steps: commentSteps,
    initializeFromHistory,
    resetAfterSubmit,
  } = useUserCommentSteps();

  // Claude feedback steps management (for history navigation)
  const {
    steps: feedbackSteps,
    initializeFromHistory: initFeedbackHistory,
    addNewFeedback,
  } = useClaudeFeedbackSteps();

  // Problem statement steps management (for history navigation)
  const {
    steps: problemSteps,
    initializeFromHistory: initProblemHistory,
    setInitialProblem,
    addNextPrompt,
  } = useProblemStatementSteps();

  // Shared step navigation - all sections sync to same step
  // null = viewing current/latest, number = viewing historical step
  const [viewingStepNumber, setViewingStepNumber] = useState<number | null>(null);

  // Total rounds based on user comments (which drives interaction rounds)
  // +1 for the current editable step
  const totalRounds = commentSteps.length + 1;

  // Are we viewing the current/latest step?
  const isViewingCurrent = viewingStepNumber === null || viewingStepNumber >= totalRounds;

  // Derive displayed content for each section based on shared step
  const displayedCommentContent = useMemo(() => {
    if (isViewingCurrent) return yjsComments;
    return commentSteps[viewingStepNumber! - 1]?.content ?? '';
  }, [isViewingCurrent, viewingStepNumber, commentSteps, yjsComments]);

  const displayedFeedbackContent = useMemo(() => {
    if (feedbackSteps.length === 0) return '';
    if (isViewingCurrent) return feedbackSteps[feedbackSteps.length - 1]?.content ?? '';
    // Step 1 has no feedback (feedback comes after first submission)
    if (viewingStepNumber === 1) return '';
    // Show feedback for this step (step N corresponds to feedback N-1), or latest available
    const stepIndex = Math.min(viewingStepNumber! - 2, feedbackSteps.length - 1);
    return stepIndex >= 0 ? feedbackSteps[stepIndex]?.content ?? '' : '';
  }, [isViewingCurrent, viewingStepNumber, feedbackSteps]);

  const displayedProblemContent = useMemo(() => {
    if (problemSteps.length === 0) return '';
    if (isViewingCurrent) return problemSteps[problemSteps.length - 1]?.content ?? '';
    // Show problem statement for this step, or latest available if step doesn't exist
    const stepIndex = Math.min(viewingStepNumber! - 1, problemSteps.length - 1);
    return problemSteps[stepIndex]?.content ?? '';
  }, [isViewingCurrent, viewingStepNumber, problemSteps]);

  // Unified step selector
  const selectStep = useCallback((stepNumber: number) => {
    if (stepNumber >= totalRounds) {
      setViewingStepNumber(null); // Current
    } else {
      setViewingStepNumber(stepNumber);
    }
  }, [totalRounds]);

  // Reset to current step after submit
  const handleResetAfterSubmit = useCallback(() => {
    resetAfterSubmit();
    setViewingStepNumber(null);
    setYjsComments('');
  }, [resetAfterSubmit, setYjsComments]);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [chatMessageQueue, setChatMessageQueue] = useState<unknown[]>([]);
  const [isApiReady, setIsApiReady] = useState<boolean>(false);

  // Clear chat message queue when room changes
  useEffect(() => {
    setChatMessageQueue([]);
  }, [roomId]);
  const [tutorialOpen, setTutorialOpen] = useState<boolean>(
    () => localStorage.getItem(TUTORIAL_SEEN_KEY) !== 'true'
  );
  const [keepAlive, setKeepAlive] = useState(false);

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
    reconnect: () => void;
  } | null>(null);
  const feedbackScrollRef = useRef<HTMLDivElement>(null);
  const problemScrollRef = useRef<HTMLDivElement>(null);

  // Derived values from props
  const problemIdFromRoom = roomId.split('/')[1];
  // Auth checks above ensure we're signed in with a valid userId that matches URL user.
  // NoopAuthProvider returns "default-user"; real auth returns the actual user ID.
  const effectiveUserId = userId!;
  // Owner if accessing via owner route (not guest mode)
  const isOwner = !guestMode;

  // Construct WebSocket path based on access mode
  const wsPath = guestMode && guestToken
    ? `/ws/guest/${guestToken}`
    : `/ws/owner/${roomId}`;

  // Tutorial dialog handler
  const handleTutorialClose = useCallback(() => {
    setTutorialOpen(false);
    localStorage.setItem(TUTORIAL_SEEN_KEY, 'true');
  }, []);

  // Keep alive handler (session only, resets on page reload)
  const handleKeepAliveChange = useCallback((value: boolean) => {
    setKeepAlive(value);
  }, []);

  // Reconnect handler for manual reconnection
  const handleReconnect = useCallback(() => {
    excalidrawApiRef.current?.reconnect();
  }, []);

  // Memoize sendMessage to prevent unnecessary re-renders of ChatWidget
  const sendChatMessage = useCallback((message: unknown) => {
    excalidrawApiRef.current?.send(message);
  }, []);

  // Feedback request hook - use Yjs-synced comments
  const {
    handleGetFeedback,
    isFeedbackLoading,
    setIsFeedbackLoading,
    pendingEventIdRef,
  } = useFeedbackRequest({
    excalidrawApiRef,
    roomId,
    userId: effectiveUserId,
    userComments: yjsComments,
    onError: setErrorMessage,
  });

  // WebSocket message handlers
  const messageHandlers = useMemo(
    () => ({
      onChatMessage: (data: unknown) => {
        setChatMessageQueue(prev => [...prev, data]);
      },
      onClaudeFeedback: (feedback: string) => {
        addNewFeedback(feedback);
      },
      onNextPrompt: (prompt: string) => {
        addNextPrompt(prompt);
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
        handleResetAfterSubmit();
      },
      onUserCommentHistory: (comments: CommentStep[]) => {
        initializeFromHistory(comments);
      },
      onClaudeFeedbackHistory: (feedbackItems: FeedbackStep[]) => {
        initFeedbackHistory(feedbackItems);
      },
      onProblemStatementHistory: (statements: ProblemStatementStep[]) => {
        initProblemHistory(statements);
      },
      reloadUser,
    }),
    [reloadUser, setIsFeedbackLoading, handleResetAfterSubmit, initializeFromHistory, onUnavailable, addNewFeedback, addNextPrompt, initFeedbackHistory, initProblemHistory]
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
          setInitialProblem(data.problem.statement);
        }
      })
      .catch((error) => {
        console.error("Error fetching problem:", error);
      });
  }, [problemIdFromRoom, setInitialProblem]);

  // Handle incoming yjs-sync messages from WebSocket
  const handleIncomingMessage = useCallback(
    (data: ExcalidrawMessage) => {
      // Route yjs-sync messages to the Yjs handler
      if (data.type === 'yjs-sync' && yjsMessageHandlerRef.current) {
        const payload = (data as { type: 'yjs-sync'; payload: number[] }).payload;
        yjsMessageHandlerRef.current(payload);
      }
      // Also pass to the regular message handler for other message types
      handleWebSocketMessage(data);
    },
    [handleWebSocketMessage, yjsMessageHandlerRef]
  );

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
  }, [displayedFeedbackContent, handleFeedbackScroll]);

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
  }, [displayedProblemContent, handleProblemStatementScroll]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <AppBar
        title={title}
        connectionState={connectionState}
        roomId={roomId}
        isOwner={isOwner}
        onTutorialClick={() => setTutorialOpen(true)}
        onReconnect={handleReconnect}
        keepAlive={keepAlive}
        onKeepAliveChange={handleKeepAliveChange}
      />

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
          content={displayedFeedbackContent}
          height={feedbackHeight}
          scrollRef={feedbackScrollRef}
          hasScrollTop={hasScrollTop}
          hasScrollBottom={hasScrollBottom}
          onDragStart={handleFeedbackMouseDown}
          steps={totalRounds >= 2 ? commentSteps : undefined}
          totalSteps={totalRounds >= 2 ? totalRounds : undefined}
          currentStep={totalRounds >= 2 ? (isViewingCurrent ? totalRounds : viewingStepNumber!) : undefined}
          isViewingLatest={isViewingCurrent}
          onStepSelect={totalRounds >= 2 ? selectStep : undefined}
        />

        {/* Problem Statement */}
        <ResizableMarkdownPanel
          label="Problem Statement"
          content={displayedProblemContent}
          height={problemStatementHeight}
          scrollRef={problemScrollRef}
          hasScrollTop={hasProblemScrollTop}
          hasScrollBottom={hasProblemScrollBottom}
          onDragStart={handleProblemStatementMouseDown}
          steps={totalRounds >= 2 ? commentSteps : undefined}
          totalSteps={totalRounds >= 2 ? totalRounds : undefined}
          currentStep={totalRounds >= 2 ? (isViewingCurrent ? totalRounds : viewingStepNumber!) : undefined}
          isViewingLatest={isViewingCurrent}
          onStepSelect={totalRounds >= 2 ? selectStep : undefined}
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
            wsPath={wsPath}
            theme={mode}
            yElements={yElements}
            keepAlive={keepAlive}
            onConnect={() => setConnectionState('connected')}
            onDisconnect={() => setConnectionState('disconnected')}
            onIdle={() => setConnectionState('idle')}
            onReady={(api) => {
              excalidrawApiRef.current = api;
              sendMessageRef.current = api.send;
              setIsApiReady(true);
              // Request full Yjs state from server now that WebSocket is ready
              requestSync();
            }}
            onMessage={handleIncomingMessage}
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
            {/* Step Dropdown - only shown when there are historical steps (totalRounds >= 2) */}
            {totalRounds >= 2 ? (
              <Select
                size="small"
                value={isViewingCurrent ? totalRounds : viewingStepNumber}
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
                    color: isViewingCurrent ? "text.secondary" : "warning.main",
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
                <MenuItem value={totalRounds} sx={{ fontSize: "0.875rem" }}>
                  User comments [step {totalRounds}] (current)
                </MenuItem>
              </Select>
            ) : (
              <Box
                component="span"
                sx={{
                  position: "absolute",
                  top: -9,
                  left: 8,
                  px: 0.5,
                  backgroundColor: "background.paper",
                  color: "text.secondary",
                  fontSize: "0.75rem",
                  zIndex: 1,
                }}
              >
                User comments
              </Box>
            )}

            {/* TextField - uses Yjs for real-time collaboration */}
            <TextField
              multiline
              value={displayedCommentContent}
              onChange={(e) => {
                if (isViewingCurrent) {
                  setYjsComments(e.target.value);
                }
              }}
              disabled={!isViewingCurrent}
              placeholder={isViewingCurrent ? "Add your notes and comments here..." : ""}
              sx={{
                width: "100%",
                height: "100%",
                "& .MuiInputBase-root": {
                  height: "100%",
                  overflow: "auto",
                  alignItems: "flex-start",
                  pt: 1.5,
                },
                "& .MuiOutlinedInput-notchedOutline": {
                  "& legend": {
                    maxWidth: 0,
                  },
                },
              }}
              slotProps={{
                input: {
                  readOnly: !isViewingCurrent,
                },
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
          key={roomId}
          sendMessage={sendChatMessage}
          userId={effectiveUserId}
          onUnavailable={onUnavailable}
          incomingMessage={chatMessageQueue[0] as Parameters<typeof ChatWidget>[0]["incomingMessage"]}
          onMessageConsumed={() => setChatMessageQueue(prev => prev.slice(1))}
        />
      )}

      {/* Tutorial Dialog */}
      <TutorialDialog open={tutorialOpen} onClose={handleTutorialClose} />
    </Box>
  );
}

export default DesignPage;
