import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from "@mui/material";

interface ResetProblemDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
}

export function ResetProblemDialog({
  open,
  onClose,
  onConfirm,
  isLoading = false,
}: ResetProblemDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm">
      <DialogTitle>Reset Problem</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Resetting this problem will cause you to lose your diagram and
          history.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onConfirm} disabled={isLoading} color="error">
          {isLoading ? "Resetting..." : "Reset"}
        </Button>
        <Button onClick={onClose} variant="contained" autoFocus>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
}
