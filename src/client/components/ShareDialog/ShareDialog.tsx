import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  IconButton,
  Box,
  Typography,
  Snackbar,
  Alert,
  Tooltip,
  FormControlLabel,
  Switch,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import RefreshIcon from '@mui/icons-material/Refresh';
import { getRoom, regenerateToken, type RoomResponse } from '../../api';

interface ShareDialogProps {
  open: boolean;
  onClose: () => void;
  roomId: string;
  keepAlive?: boolean;
  onKeepAliveChange?: (keepAlive: boolean) => void;
}

export function ShareDialog({
  open,
  onClose,
  roomId,
  keepAlive,
  onKeepAliveChange,
}: ShareDialogProps) {
  const [shareUrl, setShareUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    if (!open || !roomId) return;

    setLoading(true);
    setError(null);

    getRoom(roomId)
      .then((data: RoomResponse) => {
        if (data.success && data.room?.shareUrl) {
          // Replace server origin with client origin for dev mode compatibility
          const serverUrl = new URL(data.room.shareUrl);
          const clientUrl = `${window.location.origin}${serverUrl.pathname}`;
          setShareUrl(clientUrl);
        } else {
          setError(data.error || 'Failed to get share URL');
        }
      })
      .catch((err: Error) => {
        console.error('Error fetching share URL:', err);
        setError('Failed to load share URL');
      })
      .finally(() => setLoading(false));
  }, [open, roomId]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const data = await regenerateToken(roomId);
      if (data.success && data.shareUrl) {
        // Replace server origin with client origin for dev mode compatibility
        const serverUrl = new URL(data.shareUrl);
        const clientUrl = `${window.location.origin}${serverUrl.pathname}`;
        setShareUrl(clientUrl);
      } else {
        setError(data.error || 'Failed to regenerate token');
      }
    } catch (err) {
      console.error('Error regenerating token:', err);
      setError('Failed to regenerate share link');
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>Share Room</DialogTitle>
        <DialogContent>
          {loading ? (
            <Typography>Loading...</Typography>
          ) : error ? (
            <Alert severity="error">{error}</Alert>
          ) : (
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Share this link with others to let them view and collaborate on your design.
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  fullWidth
                  value={shareUrl}
                  InputProps={{ readOnly: true }}
                  size="small"
                />
                <Tooltip title="Copy to clipboard">
                  <IconButton onClick={handleCopy}>
                    <ContentCopyIcon />
                  </IconButton>
                </Tooltip>
              </Box>
              <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Button
                  startIcon={<RefreshIcon />}
                  onClick={handleRegenerate}
                  disabled={regenerating}
                  color="warning"
                  size="small"
                >
                  {regenerating ? 'Regenerating...' : 'Regenerate Link'}
                </Button>
                <Typography variant="caption" color="text.secondary">
                  (Invalidates existing share links)
                </Typography>
              </Box>
              {onKeepAliveChange && (
                <Box sx={{ mt: 3 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={keepAlive ?? false}
                        onChange={(e) => onKeepAliveChange(e.target.checked)}
                      />
                    }
                    label="Keep connection alive"
                  />
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 6 }}>
                    Stay connected while waiting for collaborators to join
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={copied}
        autoHideDuration={2000}
        onClose={() => setCopied(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success">Link copied to clipboard!</Alert>
      </Snackbar>
    </>
  );
}
