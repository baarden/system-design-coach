import { Box, Button, CircularProgress } from "@mui/material";

interface ActionButtonsProps {
  onGetFeedback: () => void;
  onResetProblem: () => void;
  isFeedbackLoading: boolean;
  isResetting: boolean;
}

/**
 * Action buttons for getting feedback and resetting the problem.
 */
export function ActionButtons({
  onGetFeedback,
  onResetProblem,
  isFeedbackLoading,
  isResetting,
}: ActionButtonsProps) {
  return (
    <Box sx={{ display: "flex", gap: 2, alignSelf: "flex-start" }}>
      <Button
        variant="contained"
        onClick={onGetFeedback}
        disabled={isFeedbackLoading}
        startIcon={
          isFeedbackLoading ? (
            <CircularProgress size={20} color="inherit" />
          ) : null
        }
      >
        {isFeedbackLoading ? "Getting Feedback..." : "Get Feedback"}
      </Button>
      <Button
        variant="outlined"
        color="inherit"
        onClick={onResetProblem}
        disabled={isFeedbackLoading || isResetting}
        sx={{
          borderColor: "currentColor",
          opacity: 0.8,
          "&:hover": {
            opacity: 1,
            borderColor: "currentColor",
          },
        }}
      >
        Reset Problem
      </Button>
    </Box>
  );
}
