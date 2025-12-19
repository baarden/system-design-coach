import { Box } from "@mui/material";

interface ResizeDividerProps {
  onMouseDown: () => void;
  onTouchStart: () => void;
  isDragging?: boolean;
}

/**
 * A horizontal divider with 3 dots that can be dragged to resize adjacent panels.
 */
export function ResizeDivider({
  onMouseDown,
  onTouchStart,
  isDragging = false,
}: ResizeDividerProps) {
  return (
    <Box
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      sx={{
        height: "15px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "ns-resize",
        touchAction: "none",
        userSelect: "none",
        "&:hover .divider-dots, &:active .divider-dots": {
          opacity: 0.8,
        },
      }}
    >
      <Box
        className="divider-dots"
        sx={{
          display: "flex",
          gap: "4px",
          opacity: isDragging ? 0.8 : 0.4,
          transition: "opacity 0.15s ease",
        }}
      >
        {[0, 1, 2].map((i) => (
          <Box
            key={i}
            sx={{
              width: "4px",
              height: "4px",
              borderRadius: "50%",
              backgroundColor: "text.secondary",
            }}
          />
        ))}
      </Box>
    </Box>
  );
}
