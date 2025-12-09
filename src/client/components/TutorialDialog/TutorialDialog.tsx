import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
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
          alt="Tutorial: Double-click to add labels, use arrows to show flow, move elements to verify connections"
          sx={{ width: "75%", mt: 1, display: "block", mx: "auto" }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="contained">
          Got it
        </Button>
      </DialogActions>
    </Dialog>
  );
}
