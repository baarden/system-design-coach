import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material';

interface CustomProblemDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (statement: string) => Promise<void>;
}

const MIN_LENGTH = 20;
const MAX_LENGTH = 2000;

export function CustomProblemDialog({
  open,
  onClose,
  onSubmit,
}: CustomProblemDialogProps) {
  const [statement, setStatement] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedLength = statement.trim().length;
  const isTooShort = trimmedLength > 0 && trimmedLength < MIN_LENGTH;
  const isTooLong = trimmedLength > MAX_LENGTH;
  const isValid = trimmedLength >= MIN_LENGTH && trimmedLength <= MAX_LENGTH;

  const handleSubmit = async () => {
    if (!isValid) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onSubmit(statement.trim());
      setStatement('');
    } catch (err) {
      console.error('Error creating custom room:', err);
      setError('Failed to create custom exercise. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setStatement('');
      setError(null);
      onClose();
    }
  };

  const getHelperText = () => {
    if (isTooShort) {
      return `Problem statement must be at least ${MIN_LENGTH} characters`;
    }
    if (isTooLong) {
      return `Problem statement must be no more than ${MAX_LENGTH} characters`;
    }
    return `${trimmedLength} / ${MAX_LENGTH} characters (minimum ${MIN_LENGTH})`;
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Create Custom Exercise</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 1 }}>
          {loading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
              <CircularProgress size={48} sx={{ mb: 2 }} />
              <Typography variant="body1" color="text.secondary">
                Creating your custom exercise...
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Please wait while we set up your problem statement
              </Typography>
            </Box>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Enter your own system design problem statement. Be as detailed as you'd like.
              </Typography>

              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}

              <TextField
                autoFocus
                fullWidth
                multiline
                rows={6}
                value={statement}
                onChange={(e) => setStatement(e.target.value)}
                placeholder="Example: Design a real-time collaborative document editing system like Google Docs. Consider how multiple users can edit the same document simultaneously, how to handle conflicts, and how to ensure low latency for a good user experience."
                error={isTooShort || isTooLong}
                helperText={getHelperText()}
                disabled={loading}
              />
            </>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!isValid || loading}
          variant="contained"
        >
          {loading ? 'Creating...' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
