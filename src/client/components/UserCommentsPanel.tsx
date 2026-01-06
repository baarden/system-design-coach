import { Box, TextField, Select, MenuItem } from "@mui/material";
import type { CommentStep } from "../hooks";

interface UserCommentsPanelProps {
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
        height: "100%",
        width: "100%",
      }}
    >
      {/* TextField with embedded step selector in border */}
      <Box sx={{ position: "relative", height: "100%" }}>
        {/* Label on left */}
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

        {/* Dropdown on right */}
        {showDropdown && (
          <Select
            size="small"
            value={isViewingLatest ? totalSteps : currentStep}
            onChange={(e) => onStepSelect(Number(e.target.value))}
            variant="standard"
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
