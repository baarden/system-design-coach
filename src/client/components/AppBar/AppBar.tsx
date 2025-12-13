import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AppBar as MuiAppBar,
  Toolbar,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Box,
  Switch,
  Tooltip,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import GitHubIcon from '@mui/icons-material/GitHub';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import ShareIcon from '@mui/icons-material/Share';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { AuthUI } from '../../providers/auth';
import iconPng from '../../assets/icon.png';
import { useTheme } from '../../providers/theme';
import { ShareDialog } from '../ShareDialog';

type ConnectionState = 'connected' | 'idle' | 'disconnected';

interface AppBarProps {
  title?: string;
  connectionState?: ConnectionState;
  position?: 'fixed' | 'static';
  roomId?: string | null;
  isOwner?: boolean;
  onTutorialClick?: () => void;
}

const connectionConfig: Record<ConnectionState, { color: string; label: string }> = {
  connected: { color: '#4caf50', label: 'Connected' },
  idle: { color: '#ff9800', label: 'Idle' },
  disconnected: { color: '#f44336', label: 'Disconnected' },
};

export function AppBar({
  title = 'System Design Coach',
  connectionState,
  position = 'static',
  roomId,
  isOwner = false,
  onTutorialClick,
}: AppBarProps) {
  const navigate = useNavigate();
  const { mode, toggleTheme } = useTheme();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const menuOpen = Boolean(anchorEl);

  const handleMenuOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleGitHubClick = () => {
    window.open('https://github.com/baarden/system-design-coach', '_blank');
    handleMenuClose();
  };

  return (
    <MuiAppBar position={position}>
      <Toolbar>
        <IconButton
          edge="start"
          color="inherit"
          aria-label="menu"
          onClick={handleMenuOpen}
          sx={{ mr: 2 }}
        >
          <MenuIcon />
        </IconButton>
        <Menu
          anchorEl={anchorEl}
          open={menuOpen}
          onClose={handleMenuClose}
        >
          <MenuItem onClick={toggleTheme}>
            <ListItemIcon>
              <DarkModeIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Dark mode</ListItemText>
            <Switch
              edge="end"
              checked={mode === 'dark'}
              onChange={toggleTheme}
              onClick={(e) => e.stopPropagation()}
            />
          </MenuItem>
          <MenuItem onClick={handleGitHubClick}>
            <ListItemIcon>
              <GitHubIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>GitHub</ListItemText>
          </MenuItem>
        </Menu>
        <Box
          onClick={() => navigate('/')}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            flexGrow: 1,
            cursor: 'pointer',
            '&:hover': { opacity: 0.8 },
          }}
        >
          <img src={iconPng} alt="" width={28} height={28} style={{ borderRadius: 4 }} />
          <Typography variant="h6" component="div">
            {title}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {onTutorialClick && (
            <Tooltip title="How to use">
              <IconButton
                color="inherit"
                onClick={onTutorialClick}
                aria-label="How to use"
              >
                <InfoOutlinedIcon />
              </IconButton>
            </Tooltip>
          )}
          {isOwner && roomId && (
            <Tooltip title="Share room">
              <IconButton
                color="inherit"
                onClick={() => setShareOpen(true)}
                aria-label="Share room"
              >
                <ShareIcon />
              </IconButton>
            </Tooltip>
          )}
          {connectionState !== undefined && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: connectionConfig[connectionState].color,
                }}
              />
              <Typography variant="body2">
                {connectionConfig[connectionState].label}
              </Typography>
            </Box>
          )}
          <AuthUI />
        </Box>
      </Toolbar>

      {roomId && (
        <ShareDialog
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          roomId={roomId}
        />
      )}
    </MuiAppBar>
  );
}
