import { Box, TextField, Select, MenuItem } from "@mui/material";
import type { CommentStep } from "../hooks";

interface UserCommentsPanelProps {
  height: number;
  onDragStart: () => void;
  onTouchStart: () => void;
  content: string;
  onChange: (value: string) => void;
  isEditable: boolean;
  steps: CommentStep[];
  totalSteps: number;
  currentStep: number | null;
  isViewingLatest: boolean;
  onStepSelect: (stepNumber: number) => void;
}

/**
 * A panel for displaying and editing user comments with step navigation.
 */
export function UserCommentsPanel({
  height,
  onDragStart,
  onTouchStart,
  content,
  onChange,
  isEditable,
  steps,
  totalSteps,
  currentStep,
  isViewingLatest,
  onStepSelect,
}: UserCommentsPanelProps) {
  const showDropdown = totalSteps >= 2;

  return (
    <Box
      sx={{
        position: "relative",
        height: `${height}px`,
        width: "100%",
      }}
    >
      {/* Drag handle overlay on top border */}
      <Box
        onMouseDown={onDragStart}
        onTouchStart={onTouchStart}
        sx={{
          position: "absolute",
          top: -4,
          left: 0,
          right: 0,
          height: "12px",
          cursor: "ns-resize",
          zIndex: 1,
          touchAction: "none",
        }}
      />

      {/* TextField with embedded step selector in border */}
      <Box sx={{ position: "relative", height: "100%" }}>
        {/* Step Dropdown - only shown when there are historical steps */}
        {showDropdown ? (
          <Select
            size="small"
            value={isViewingLatest ? totalSteps : currentStep}
            onChange={(e) => onStepSelect(Number(e.target.value))}
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
                color: isViewingLatest ? "text.secondary" : "warning.main",
              },
              "& .MuiSvgIcon-root": {
                fontSize: "1rem",
                right: 0,
              },
            }}
          >
            {steps.map((step) => (
              <MenuItem key={step.stepNumber} value={step.stepNumber} sx={{ fontSize: "0.875rem" }}>
                User comments [step {step.stepNumber}]
              </MenuItem>
            ))}
            <MenuItem value={totalSteps} sx={{ fontSize: "0.875rem" }}>
              User comments [step {totalSteps}] (current)
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
          value={content}
          onChange={(e) => {
            if (isEditable) {
              onChange(e.target.value);
            }
          }}
          disabled={!isEditable}
          placeholder={isEditable ? "Add your notes and comments here..." : ""}
          sx={{
            width: "100%",
            height: "100%",
            "& .MuiInputBase-root": {
              height: "100%",
              overflow: "auto",
              alignItems: "flex-start",
              pt: 1.5,
              fontSize: { xs: "0.875rem", sm: "1rem" },
            },
            "& .MuiOutlinedInput-notchedOutline": {
              "& legend": {
                maxWidth: 0,
              },
            },
          }}
          slotProps={{
            input: {
              readOnly: !isEditable,
            },
          }}
        />
      </Box>
    </Box>
  );
}
