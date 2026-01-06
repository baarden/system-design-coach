import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useParams, Navigate, Link } from "react-router-dom";
import { ExcalidrawClient } from "./components/ExcalidrawClient";
import { useAuth } from "./providers/auth";
import { ChatWidget } from "./components/ChatWidget";
import { CoachCommentsPanel } from "./components/CoachCommentsPanel";
import { UserCommentsPanel } from "./components/UserCommentsPanel";
import { ActionButtons } from "./components/ActionButtons";
import { ResizeDivider } from "./components/ResizeDivider";
import { useWebSocketMessages, useFeedbackRequest, useUserCommentSteps, useClaudeFeedbackSteps, useProblemStatementSteps, useYjsComments, useDragResize, useScrollFade, useUnifiedStepNavigation, useDesignPageDialogs } from "./hooks";
import type { CommentStep, FeedbackStep, ProblemStatementStep } from "./hooks";
import {
  Button,
  Box,
  Snackbar,
  Alert,
  useMediaQuery,
  useTheme as useMuiTheme,
} from "@mui/material";
import { AppBar } from "./components/AppBar";
import { TutorialDialog } from "./components/TutorialDialog";
import { ResetProblemDialog } from "./components/ResetProblemDialog";
import { useTheme } from "./providers/theme";
import { fetchProblem, getServerUrl } from "./api";
import { YjsProvider, useYjs } from "./providers/yjs";
import type { ExcalidrawMessage } from "@shared/types/excalidraw";

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
  const muiTheme = useMuiTheme();
  const isSmallScreen = useMediaQuery(muiTheme.breakpoints.down('sm'));

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

  // Unified step navigation across all panels
  const {
    viewingStepNumber,
    totalRounds,
    isViewingCurrent,
    displayedCommentContent,
    displayedFeedbackContent,
    originalProblemStatement,
    activeCoachTab,
    setActiveCoachTab,
    isFeedbackTabEnabled,
    selectStep,
    resetToCurrentStep,
  } = useUnifiedStepNavigation({
    commentSteps,
    feedbackSteps,
    problemSteps,
    currentComments: yjsComments,
  });

  // Reset to current step after submit
  const handleResetAfterSubmit = useCallback(() => {
    resetAfterSubmit(submittedCommentsRef.current);
    submittedCommentsRef.current = '';
    resetToCurrentStep();
    setYjsComments('');
  }, [resetAfterSubmit, resetToCurrentStep, setYjsComments]);

  // Dialog state management
  const {
    tutorialOpen,
    handleTutorialClose,
    openTutorial,
    resetDialogOpen,
    isResetting,
    openResetDialog,
    closeResetDialog,
    handleResetProblem,
    errorMessage,
    setErrorMessage,
    clearError,
  } = useDesignPageDialogs({ roomId });

  const [chatMessageQueue, setChatMessageQueue] = useState<unknown[]>([]);
  const [isApiReady, setIsApiReady] = useState<boolean>(false);

  // Clear chat message queue when room changes
  useEffect(() => {
    setChatMessageQueue([]);
  }, [roomId]);
  const [keepAlive, setKeepAlive] = useState(false);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const coachPanelRef = useRef<HTMLDivElement>(null);
  const commentsPanelRef = useRef<HTMLDivElement>(null);
  const submittedCommentsRef = useRef<string>('');

  // Resizable panel hooks
  const initialHeight = isSmallScreen ? 80 : 120;
  const coachDrag = useDragResize({
    containerRef,
    targetRef: coachPanelRef,
    initialHeight,
    minHeight: 80,
    maxHeightRatio: 0.4,
    direction: 'fromTop',
  });
  const commentsDrag = useDragResize({
    containerRef,
    targetRef: commentsPanelRef,
    initialHeight,
    minHeight: 80,
    maxHeightRatio: 0.4,
    direction: 'fromBottom',
  });

  // Scroll fade hooks
  const coachScroll = useScrollFade();

  const excalidrawApiRef = useRef<{
    send: (message: unknown) => void;
    syncToBackend: () => Promise<void>;
    reconnect: () => void;
  } | null>(null);

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
    handleGetFeedback: sendFeedbackRequest,
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

  // Wrapper to capture comments before sending feedback request
  const handleGetFeedback = useCallback(async () => {
    submittedCommentsRef.current = yjsComments;
    await sendFeedbackRequest();
  }, [yjsComments, sendFeedbackRequest]);

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

  // Re-check scroll state when content changes
  useEffect(() => {
    coachScroll.checkScroll();
  }, [displayedFeedbackContent, originalProblemStatement, activeCoachTab, coachScroll]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <AppBar
        title={title}
        connectionState={connectionState}
        roomId={roomId}
        isOwner={isOwner}
        onTutorialClick={openTutorial}
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
        }}
      >
        {/* Coach Comments (feedback + problem statement) */}
        <Box ref={coachPanelRef} sx={{ height: `${coachDrag.height}px` }}>
          <CoachCommentsPanel
            activeTab={activeCoachTab}
            onTabChange={setActiveCoachTab}
            isFeedbackTabEnabled={isFeedbackTabEnabled}
            problemStatementContent={originalProblemStatement}
            feedbackContent={displayedFeedbackContent}
            scrollRef={coachScroll.scrollRef}
            hasScrollTop={coachScroll.hasScrollTop}
            hasScrollBottom={coachScroll.hasScrollBottom}
            steps={feedbackSteps}
            totalSteps={totalRounds}
            currentStep={isViewingCurrent ? totalRounds : viewingStepNumber!}
            isViewingLatest={isViewingCurrent}
            onStepSelect={selectStep}
          />
        </Box>
        <ResizeDivider
          onMouseDown={coachDrag.handleMouseDown}
          onTouchStart={coachDrag.handleTouchStart}
          isDragging={coachDrag.isDragging}
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
        <ResizeDivider
          onMouseDown={commentsDrag.handleMouseDown}
          onTouchStart={commentsDrag.handleTouchStart}
          isDragging={commentsDrag.isDragging}
        />

        {/* User Comments */}
        <Box ref={commentsPanelRef} sx={{ height: `${commentsDrag.height}px` }}>
          <UserCommentsPanel
            content={displayedCommentContent}
            onChange={setYjsComments}
            isEditable={isViewingCurrent}
            steps={commentSteps}
            totalSteps={totalRounds}
            currentStep={viewingStepNumber}
            isViewingLatest={isViewingCurrent}
            onStepSelect={selectStep}
          />
        </Box>

        {/* Action buttons - only visible to room owner */}
        {isOwner && (
          <Box sx={{ mt: 2 }}>
            <ActionButtons
              onGetFeedback={handleGetFeedback}
              onResetProblem={openResetDialog}
              isFeedbackLoading={isFeedbackLoading}
              isResetting={isResetting}
            />
          </Box>
        )}
      </Box>

      {/* Error Snackbar */}
      <Snackbar
        open={!!errorMessage}
        autoHideDuration={6000}
        onClose={clearError}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={clearError}
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

      {/* Reset Problem Dialog */}
      <ResetProblemDialog
        open={resetDialogOpen}
        onClose={closeResetDialog}
        onConfirm={handleResetProblem}
        isLoading={isResetting}
      />
    </Box>
  );
}

export default DesignPage;
