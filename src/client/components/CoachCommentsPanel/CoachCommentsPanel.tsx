import { RefObject } from "react";
import { Box, Tabs, Tab, Select, MenuItem } from "@mui/material";
import { ResizableMarkdownPanel } from "../ResizablePanel";
import type { CoachTab } from "../../hooks/useUnifiedStepNavigation";
import type { FeedbackStep } from "../../hooks/useClaudeFeedbackSteps";

interface CoachCommentsPanelProps {
  // Tab state
  activeTab: CoachTab;
  onTabChange: (tab: CoachTab) => void;
  isFeedbackTabEnabled: boolean;

  // Content for each tab
  problemStatementContent: string;
  feedbackContent: string;

  // Scroll management
  scrollRef: RefObject<HTMLDivElement>;
  hasScrollTop: boolean;
  hasScrollBottom: boolean;

  // Steps dropdown (only for feedback tab)
  steps?: FeedbackStep[];
  totalSteps?: number;
  currentStep?: number;
  isViewingLatest?: boolean;
  onStepSelect?: (step: number) => void;
}

const tabStyles = {
  fontSize: { xs: '0.75rem', sm: '0.875rem' },
  minHeight: { xs: 28, sm: 32 },
  py: { xs: 0.5, sm: 1 },
  px: { xs: 1.5, sm: 2.5 },
  textTransform: 'none',
  fontWeight: 500,
  '&.Mui-selected': {
    fontWeight: 600,
  },
  '&.Mui-disabled': {
    opacity: 0.5,
  },
};

export function CoachCommentsPanel({
  activeTab,
  onTabChange,
  isFeedbackTabEnabled,
  problemStatementContent,
  feedbackContent,
  scrollRef,
  hasScrollTop,
  hasScrollBottom,
  steps,
  totalSteps,
  currentStep,
  isViewingLatest,
  onStepSelect,
}: CoachCommentsPanelProps) {
  // Show steps dropdown only when totalRounds >= 3 and not viewing step 1
  // (step 1 has no coach feedback, so dropdown shouldn't appear)
  const showStepsDropdown =
    totalSteps !== undefined &&
    totalSteps >= 3 &&
    currentStep !== 1 &&
    steps !== undefined &&
    steps.length > 0 &&
    onStepSelect !== undefined;

  const displayedContent = activeTab === 'problem'
    ? problemStatementContent
    : feedbackContent;

  // Custom label for Coach Comments tab with optional dropdown
  const coachCommentsLabel = showStepsDropdown ? (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 1,
      }}
      onClick={(e) => {
        // Prevent tab selection when clicking dropdown
        if ((e.target as HTMLElement).closest('.MuiSelect-root')) {
          e.stopPropagation();
        }
      }}
    >
      <span>Coach Comments</span>
      <Select
        size="small"
        value={currentStep}
        onChange={(e) => {
          e.stopPropagation();
          onStepSelect!(Number(e.target.value));
        }}
        onClick={(e) => e.stopPropagation()}
        variant="standard"
        data-testid="feedback-step-selector"
        sx={{
          fontSize: '0.75rem',
          minWidth: { xs: 70, sm: 80 },
          '& .MuiSelect-select': {
            py: 0,
            color: isViewingLatest ? 'text.secondary' : 'warning.main',
          },
          '& .MuiSvgIcon-root': {
            fontSize: '1rem',
            color: isViewingLatest ? 'text.secondary' : 'warning.main',
          },
          '&:before, &:after': {
            display: 'none',
          },
        }}
      >
        {steps && steps.filter((step) => step.stepNumber >= 2).map((step) => (
          <MenuItem key={step.stepNumber} value={step.stepNumber} sx={{ fontSize: '0.875rem' }}>
            Step {step.stepNumber}
          </MenuItem>
        ))}
        {/* Add current step if it's not in the filtered historical steps */}
        {steps && totalSteps && totalSteps > Math.max(...steps.filter((step) => step.stepNumber >= 2).map(s => s.stepNumber), 1) && totalSteps >= 2 && (
          <MenuItem key="current" value={totalSteps} sx={{ fontSize: '0.875rem' }}>
            Step {totalSteps}
          </MenuItem>
        )}
      </Select>
    </Box>
  ) : (
    'Coach Comments'
  );

  return (
    <Box sx={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Tabs row */}
      <Box sx={{ display: 'flex', justifyContent: 'center', position: 'relative', zIndex: 2 }}>
        <Tabs
          value={activeTab}
          onChange={(_, val) => onTabChange(val)}
          sx={{
            minHeight: 32,
            backgroundColor: 'background.paper',
            borderRadius: '4px 4px 0 0',
            border: 1,
            borderBottom: 0,
            borderColor: 'divider',
            '& .MuiTabs-indicator': {
              backgroundColor: 'primary.main',
            },
          }}
        >
          <Tab
            label="Problem Statement"
            value="problem"
            sx={tabStyles}
          />
          <Tab
            label={coachCommentsLabel}
            value="feedback"
            disabled={!isFeedbackTabEnabled}
            sx={tabStyles}
          />
        </Tabs>
      </Box>

      {/* Resizable panel with content */}
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <ResizableMarkdownPanel
          label={activeTab === 'problem' ? 'Problem Statement' : 'Coach Comments'}
          content={displayedContent}
          scrollRef={scrollRef}
          hasScrollTop={hasScrollTop}
          hasScrollBottom={hasScrollBottom}
          squareTopCorners
          hideLabel
        />
      </Box>
    </Box>
  );
}
