import { useState, useCallback } from "react";
import { resetRoomContent } from "../api";

const TUTORIAL_SEEN_KEY = 'tutorial-seen';

interface UseDesignPageDialogsOptions {
  roomId: string;
}

interface UseDesignPageDialogsReturn {
  // Tutorial
  tutorialOpen: boolean;
  handleTutorialClose: () => void;
  openTutorial: () => void;

  // Reset
  resetDialogOpen: boolean;
  isResetting: boolean;
  openResetDialog: () => void;
  closeResetDialog: () => void;
  handleResetProblem: () => Promise<void>;

  // Error
  errorMessage: string;
  setErrorMessage: (msg: string) => void;
  clearError: () => void;
}

/**
 * Hook for managing dialog states and handlers in the DesignPage.
 */
export function useDesignPageDialogs({
  roomId,
}: UseDesignPageDialogsOptions): UseDesignPageDialogsReturn {
  // Tutorial state
  const [tutorialOpen, setTutorialOpen] = useState<boolean>(
    () => localStorage.getItem(TUTORIAL_SEEN_KEY) !== 'true'
  );

  // Reset dialog state
  const [resetDialogOpen, setResetDialogOpen] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);

  // Error state
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Tutorial handlers
  const handleTutorialClose = useCallback(() => {
    setTutorialOpen(false);
    localStorage.setItem(TUTORIAL_SEEN_KEY, 'true');
  }, []);

  const openTutorial = useCallback(() => {
    setTutorialOpen(true);
  }, []);

  // Reset dialog handlers
  const openResetDialog = useCallback(() => {
    setResetDialogOpen(true);
  }, []);

  const closeResetDialog = useCallback(() => {
    setResetDialogOpen(false);
  }, []);

  const handleResetProblem = useCallback(async () => {
    setIsResetting(true);
    try {
      const response = await resetRoomContent(roomId);
      if (response.success) {
        window.location.reload();
      } else {
        setErrorMessage(response.error || "Failed to reset problem");
        setResetDialogOpen(false);
      }
    } catch (error) {
      setErrorMessage((error as Error).message);
      setResetDialogOpen(false);
    } finally {
      setIsResetting(false);
    }
  }, [roomId]);

  // Error handlers
  const clearError = useCallback(() => {
    setErrorMessage("");
  }, []);

  return {
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
  };
}
