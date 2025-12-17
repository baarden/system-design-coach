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
import { AuthUI, AuthMenuItems } from '../../providers/auth';
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
  onReconnect?: () => void;
  keepAlive?: boolean;
  onKeepAliveChange?: (keepAlive: boolean) => void;
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
  onReconnect,
  keepAlive,
  onKeepAliveChange,
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
          sx={{ mr: { xs: 0.5, sm: 2 } }}
        >
          <MenuIcon />
        </IconButton>
        <Menu
          anchorEl={anchorEl}
          open={menuOpen}
          onClose={handleMenuClose}
        >
          {connectionState !== undefined && (
            <MenuItem
              onClick={connectionState !== 'connected' && onReconnect ? () => { onReconnect(); handleMenuClose(); } : handleMenuClose}
              sx={{ display: { xs: 'flex', sm: 'none' } }}
            >
              <ListItemIcon>
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    backgroundColor: connectionConfig[connectionState].color,
                    ml: 0.5,
                  }}
                />
              </ListItemIcon>
              <ListItemText>{connectionConfig[connectionState].label}</ListItemText>
            </MenuItem>
          )}
          <AuthMenuItems onClose={handleMenuClose} />
          {onTutorialClick && (
            <MenuItem
              onClick={() => { onTutorialClick(); handleMenuClose(); }}
              sx={{ display: { xs: 'flex', sm: 'none' } }}
            >
              <ListItemIcon>
                <InfoOutlinedIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>How to use</ListItemText>
            </MenuItem>
          )}
          {isOwner && roomId && (
            <MenuItem
              onClick={() => { setShareOpen(true); handleMenuClose(); }}
              sx={{ display: { xs: 'flex', sm: 'none' } }}
            >
              <ListItemIcon>
                <ShareIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Share room</ListItemText>
            </MenuItem>
          )}
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
              sx={mode === 'dark' ? {
                '& .MuiSwitch-switchBase.Mui-checked': {
                  color: '#fff',
                },
                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                  backgroundColor: '#90caf9',
                  opacity: 0.7,
                },
                '& .MuiSwitch-switchBase': {
                  color: '#e0e0e0',
                },
                '& .MuiSwitch-track': {
                  backgroundColor: '#aaa',
                  opacity: 0.5,
                },
              } : undefined}
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
          <Typography
            variant="h6"
            component="div"
            sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}
          >
            {title}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {onTutorialClick && (
            <Box sx={{ display: { xs: 'none', sm: 'flex' } }}>
              <Tooltip title="How to use">
                <IconButton
                  color="inherit"
                  onClick={onTutorialClick}
                  aria-label="How to use"
                >
                  <InfoOutlinedIcon />
                </IconButton>
              </Tooltip>
            </Box>
          )}
          {isOwner && roomId && (
            <Box sx={{ display: { xs: 'none', sm: 'flex' } }}>
              <Tooltip title="Share room">
                <IconButton
                  color="inherit"
                  onClick={() => setShareOpen(true)}
                  aria-label="Share room"
                >
                  <ShareIcon />
                </IconButton>
              </Tooltip>
            </Box>
          )}
          {connectionState !== undefined && (
            <Tooltip
              title={connectionState !== 'connected' && onReconnect ? 'Click to reconnect' : ''}
            >
              <Box
                onClick={connectionState !== 'connected' && onReconnect ? onReconnect : undefined}
                sx={{
                  display: { xs: 'none', sm: 'flex' },
                  alignItems: 'center',
                  gap: 1,
                  ...(connectionState !== 'connected' && onReconnect && {
                    cursor: 'pointer',
                    '&:hover': { opacity: 0.8 },
                  }),
                }}
              >
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
            </Tooltip>
          )}
          <AuthUI />
        </Box>
      </Toolbar>

      {roomId && (
        <ShareDialog
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          roomId={roomId}
          keepAlive={keepAlive}
          onKeepAliveChange={onKeepAliveChange}
        />
      )}
    </MuiAppBar>
  );
}
