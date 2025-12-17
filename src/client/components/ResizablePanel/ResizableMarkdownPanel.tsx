import { ReactNode, RefObject } from "react";
import { Box, Typography, useTheme, Select, MenuItem } from "@mui/material";
import ReactMarkdown from "react-markdown";

interface StepInfo {
  stepNumber: number;
  content: string;
}

interface ResizableMarkdownPanelProps {
  label: string;
  content: string;
  height: number;
  scrollRef: RefObject<HTMLDivElement>;
  hasScrollTop: boolean;
  hasScrollBottom: boolean;
  onDragStart: () => void;
  /**
   * Position of the drag handle
   */
  dragHandlePosition?: "top" | "bottom";
  children?: ReactNode;
  /**
   * Optional step navigation - when provided, shows a dropdown instead of static label
   */
  steps?: StepInfo[];
  totalSteps?: number;
  currentStep?: number;
  isViewingLatest?: boolean;
  onStepSelect?: (stepNumber: number) => void;
}

/**
 * A resizable panel that displays markdown content with scroll fade effects.
 */
export function ResizableMarkdownPanel({
  label,
  content,
  height,
  scrollRef,
  hasScrollTop,
  hasScrollBottom,
  onDragStart,
  dragHandlePosition = "bottom",
  steps,
  totalSteps,
  currentStep,
  isViewingLatest,
  onStepSelect,
}: ResizableMarkdownPanelProps) {
  const theme = useTheme();
  const hasContent = content?.trim();
  const showDropdown = steps && totalSteps !== undefined && totalSteps > 0 && onStepSelect;

  const bgColor = theme.palette.background.paper;

  const markdownStyles = {
    flex: 1,
    overflow: "auto",
    p: 2,
    pt: 2.5,
    fontSize: { xs: "0.875rem", sm: "1rem" },
    lineHeight: 1.5,
    "& p": { margin: "0.5em 0" },
    "& p:first-of-type": { marginTop: 0 },
    "& p:last-of-type": { marginBottom: 0 },
    "& ul, & ol": { margin: "0.5em 0", paddingLeft: "1.5em" },
    "& li": { margin: "0.25em 0" },
    "& code": {
      backgroundColor: theme.palette.action.hover,
      padding: "0.2em 0.4em",
      borderRadius: "3px",
      fontSize: "0.875em",
    },
    "& pre": {
      backgroundColor: theme.palette.action.hover,
      padding: "1em",
      borderRadius: "4px",
      overflow: "auto",
    },
  };

  return (
    <Box
      sx={{
        position: "relative",
        border: 1,
        borderColor: "divider",
        borderRadius: 1,
        height: `${height}px`,
        display: "flex",
        flexDirection: "column",
        backgroundColor: hasContent ? "transparent" : "action.hover",
      }}
    >
      {/* Label or Step Dropdown */}
      {showDropdown ? (
        <Select
          size="small"
          value={currentStep}
          onChange={(e) => onStepSelect(Number(e.target.value))}
          variant="standard"
          disableUnderline
          sx={{
            position: "absolute",
            top: -10,
            left: 8,
            zIndex: 2,
            backgroundColor: "background.paper",
            px: 0.5,
            fontSize: "0.75rem",
            "& .MuiSelect-select": {
              py: 0,
              pr: 2,
              color: isViewingLatest ? "text.secondary" : "warning.main",
            },
            "& .MuiSvgIcon-root": {
              fontSize: "1rem",
              color: isViewingLatest ? "text.secondary" : "warning.main",
            },
          }}
        >
          {steps.map((step) => (
            <MenuItem key={step.stepNumber} value={step.stepNumber} sx={{ fontSize: "0.875rem" }}>
              {label} [step {step.stepNumber}]
            </MenuItem>
          ))}
          {/* Current step (if there are historical steps) */}
          {steps.length > 0 && steps.length < totalSteps && (
            <MenuItem value={totalSteps} sx={{ fontSize: "0.875rem" }}>
              {label} [step {totalSteps}] (current)
            </MenuItem>
          )}
        </Select>
      ) : (
        <Typography
          variant="caption"
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
          {label}
        </Typography>
      )}

      {/* Content area */}
      <Box ref={scrollRef} sx={markdownStyles}>
        <ReactMarkdown>{content}</ReactMarkdown>
      </Box>

      {/* Top fade overlay */}
      {hasScrollTop && (
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "40px",
            background: `linear-gradient(to bottom, ${bgColor} 0%, transparent 100%)`,
            pointerEvents: "none",
            borderRadius: "4px 4px 0 0",
          }}
        />
      )}

      {/* Bottom fade overlay */}
      {hasScrollBottom && (
        <Box
          sx={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "40px",
            background: `linear-gradient(to top, ${bgColor} 0%, transparent 100%)`,
            pointerEvents: "none",
            borderRadius: "0 0 4px 4px",
          }}
        />
      )}

      {/* Drag handle */}
      <Box
        onMouseDown={onDragStart}
        onTouchStart={onDragStart}
        sx={{
          position: "absolute",
          ...(dragHandlePosition === "bottom"
            ? { bottom: -4 }
            : { top: -4 }),
          left: 0,
          right: 0,
          height: "12px",
          cursor: "ns-resize",
          zIndex: 1,
          touchAction: "none",
        }}
      />
    </Box>
  );
}
