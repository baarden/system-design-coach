import { Box, Select, MenuItem } from "@mui/material";
import type * as Y from "yjs";
import type { CommentStep } from "../../hooks";
import { useScrollFade } from "../../hooks";
import { ResizableMarkdownPanel } from "../ResizablePanel/ResizableMarkdownPanel";

interface UserCommentsPanelProps {
  content: string;
  onChange: (value: string) => void;
  isEditable: boolean;
  steps: CommentStep[];
  totalSteps: number;
  currentStep: number | null;
  isViewingLatest: boolean;
  onStepSelect: (stepNumber: number) => void;
  yText: Y.Text | null;
}

/**
 * A panel for displaying and editing user comments with step navigation.
 */
export function UserCommentsPanel({
  content,
  onChange,
  isEditable,
  steps,
  totalSteps,
  currentStep,
  isViewingLatest,
  onStepSelect,
  yText,
}: UserCommentsPanelProps) {
  const { scrollRef, hasScrollTop, hasScrollBottom } = useScrollFade();
  const showDropdown = totalSteps >= 2;

  return (
    <Box
      sx={{
        position: "relative",
        height: "100%",
        width: "100%",
      }}
    >
      {/* Label on left - separate from ResizableMarkdownPanel */}
      <Box
        component="span"
        sx={{
          position: "absolute",
          top: -9,
          left: 8,
          zIndex: 1,
          backgroundColor: "background.paper",
          px: 0.5,
          color: "text.secondary",
          fontSize: "0.75rem",
        }}
      >
        User Comments
      </Box>

      {/* Dropdown on right - separate from ResizableMarkdownPanel */}
      {showDropdown && (
        <Select
          size="small"
          value={isViewingLatest ? totalSteps : currentStep}
          onChange={(e) => onStepSelect(Number(e.target.value))}
          variant="standard"
          data-testid="comment-step-selector"
          sx={{
            position: "absolute",
            top: -9,
            right: 8,
            zIndex: 1,
            backgroundColor: "background.paper",
            px: 0.5,
            fontSize: "0.75rem",
            "& .MuiSelect-select": {
              py: 0,
              color: isViewingLatest ? "text.secondary" : "warning.main",
            },
            "& .MuiSvgIcon-root": {
              fontSize: "1rem",
              color: isViewingLatest ? "text.secondary" : "warning.main",
            },
            "&:before, &:after": {
              display: "none",
            },
          }}
        >
          {steps.map((step) => (
            <MenuItem key={step.stepNumber} value={step.stepNumber} sx={{ fontSize: "0.875rem" }}>
              Step {step.stepNumber}
            </MenuItem>
          ))}
          <MenuItem value={totalSteps} sx={{ fontSize: "0.875rem" }}>
            Step {totalSteps}
          </MenuItem>
        </Select>
      )}

      {/* Markdown editor/viewer */}
      <ResizableMarkdownPanel
        label="User Comments"
        content={content}
        scrollRef={scrollRef}
        hasScrollTop={hasScrollTop}
        hasScrollBottom={hasScrollBottom}
        hideLabel={true}
        editable={isEditable && isViewingLatest}
        yText={yText}
        onContentChange={onChange}
      />
    </Box>
  );
}
