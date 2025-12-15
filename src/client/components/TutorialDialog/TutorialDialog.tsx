import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
} from "@mui/material";
import demoImageUrl from "../../assets/demo.png";

interface TutorialDialogProps {
  open: boolean;
  onClose: () => void;
}

export function TutorialDialog({ open, onClose }: TutorialDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Getting Started</DialogTitle>
      <DialogContent>
        <Box
          component="img"
          src={demoImageUrl}
          alt="Tutorial flowchart: Double-click elements to add labels, use arrows to show information flow, move elements to verify labels and arrows are attached, wrap related elements in frames so Claude can see the connection"
          sx={{ width: "75%", mt: 1, display: "block", mx: "auto" }}
        />
        <Typography variant="body2" sx={{ mt: 2 }}>
          Instead of adding stand-alone text in your diagram, add it to your comments.
          Claude doesn't pay attention to style, groups, or relative positions in your
          diagram, so you can focus on the content.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="contained">
          Got it
        </Button>
      </DialogActions>
    </Dialog>
  );
}
