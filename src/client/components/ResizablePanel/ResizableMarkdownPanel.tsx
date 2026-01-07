import { ReactNode, RefObject } from "react";
import { Box, Typography, useTheme, Select, MenuItem } from "@mui/material";
import ReactMarkdown from "react-markdown";
import type * as Y from "yjs";
import { MilkdownEditor } from "../MilkdownEditor";

interface StepInfo {
  stepNumber: number;
  content: string;
}

interface ResizableMarkdownPanelProps {
  label: string;
  content: string;
  scrollRef: RefObject<HTMLDivElement>;
  hasScrollTop: boolean;
  hasScrollBottom: boolean;
  children?: ReactNode;
  /**
   * Optional step navigation - when provided, shows a dropdown instead of static label
   */
  steps?: StepInfo[];
  totalSteps?: number;
  currentStep?: number;
  isViewingLatest?: boolean;
  onStepSelect?: (stepNumber: number) => void;
  /**
   * Whether to show square (non-rounded) top corners - used when tabs are above
   */
  squareTopCorners?: boolean;
  /**
   * Whether to hide the label/dropdown - used when tabs provide the label
   */
  hideLabel?: boolean;
  /**
   * Whether the content is editable (Milkdown editor) or read-only (ReactMarkdown)
   */
  editable?: boolean;
  /**
   * Yjs Y.Text for collaborative editing (required when editable=true)
   */
  yText?: Y.Text | null;
  /**
   * Callback when markdown content changes in editor
   */
  onContentChange?: (content: string) => void;
}

/**
 * A resizable panel that displays markdown content with scroll fade effects.
 */
export function ResizableMarkdownPanel({
  label,
  content,
  scrollRef,
  hasScrollTop,
  hasScrollBottom,
  steps,
  totalSteps,
  currentStep,
  isViewingLatest,
  onStepSelect,
  squareTopCorners = false,
  hideLabel = false,
  editable = false,
  yText,
  onContentChange,
}: ResizableMarkdownPanelProps) {
  const theme = useTheme();
  const showDropdown = steps && totalSteps !== undefined && totalSteps > 0 && onStepSelect;

  const bgColor = theme.palette.background.paper;

  const markdownStyles = {
    flex: 1,
    overflow: "auto",
    px: 2,
    pt: '10px',
    pb: 0,
    fontSize: { xs: "0.875rem", sm: "1rem" },
    // Let CSS classes (markdown.css, MilkdownEditor.css) control line-height and spacing
    // to ensure consistency between ReactMarkdown and Milkdown editor
  };

  return (
    <Box
      sx={{
        position: "relative",
        border: 1,
        borderColor: "divider",
        borderRadius: squareTopCorners ? '0 0 4px 4px' : 1,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: editable ? "transparent" : "action.hover",
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
            top: { xs: 8, sm: -10 },
            left: 8,
            zIndex: 2,
            backgroundColor: "background.paper",
            px: 0.5,
            fontSize: "0.75rem",
            // Add visual prominence on mobile
            border: { xs: 1, sm: 0 },
            borderColor: { xs: "divider", sm: "transparent" },
            borderRadius: { xs: 1, sm: 0 },
            "& .MuiSelect-select": {
              py: { xs: 0.5, sm: 0 },
              pr: 2,
              color: isViewingLatest ? "text.secondary" : "warning.main",
            },
            "& .MuiSvgIcon-root": {
              fontSize: "1rem",
              color: isViewingLatest ? "text.secondary" : "warning.main",
            },
          }}
        >
          {steps!.map((step) => (
            <MenuItem key={step.stepNumber} value={step.stepNumber} sx={{ fontSize: "0.875rem" }}>
              {label} [step {step.stepNumber}]
            </MenuItem>
          ))}
          {/* Current step (if there are historical steps) */}
          {steps!.length > 0 && steps!.length < totalSteps! && (
            <MenuItem value={totalSteps} sx={{ fontSize: "0.875rem" }}>
              {label} [step {totalSteps}] (current)
            </MenuItem>
          )}
        </Select>
      ) : (
        !hideLabel && (
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
        )
      )}

      {/* Content area */}
      <Box ref={scrollRef} sx={markdownStyles}>
        <div className="markdown-content">
          {editable && yText ? (
            <MilkdownEditor yText={yText} onUpdate={onContentChange} />
          ) : (
            <ReactMarkdown>{content}</ReactMarkdown>
          )}
        </div>
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

    </Box>
  );
}
