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
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import GitHubIcon from '@mui/icons-material/GitHub';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import { AuthUI } from '../../providers/auth';
import { useTheme } from '../../providers/theme';

interface AppBarProps {
  title?: string;
  isConnected?: boolean;
  position?: 'fixed' | 'static';
}

export function AppBar({
  title = 'System Design Coach',
  isConnected,
  position = 'static',
}: AppBarProps) {
  const navigate = useNavigate();
  const { mode, toggleTheme } = useTheme();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
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
        <Typography
          variant="h6"
          component="div"
          onClick={() => navigate('/')}
          sx={{ flexGrow: 1, cursor: 'pointer', '&:hover': { opacity: 0.8 } }}
        >
          {title}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {isConnected !== undefined && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: isConnected ? '#4caf50' : '#f44336',
                }}
              />
              <Typography variant="body2">
                {isConnected ? 'Connected' : 'Disconnected'}
              </Typography>
            </Box>
          )}
          <AuthUI />
        </Box>
      </Toolbar>
    </MuiAppBar>
  );
}
