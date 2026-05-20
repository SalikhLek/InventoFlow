import { AppBar, Box, CssBaseline, Drawer, IconButton, List, ListItemButton, ListItemIcon, ListItemText, Toolbar, Typography, Chip, useTheme, useMediaQuery, Avatar, Button } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/Dashboard';
import InventoryIcon from '@mui/icons-material/Inventory';
import SettingsIcon from '@mui/icons-material/Settings';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import HistoryIcon from '@mui/icons-material/History';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import Tooltip from '@mui/material/Tooltip';
import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useThemeMode } from '../theme/ThemeContext';

const drawerWidth = 280;

const roleLabels = {
  admin: 'админ',
  manager: 'менеджер',
  user: 'пользователь',
};
const roleColors = {
  admin: 'error',
  manager: 'warning',
  user: 'info',
};

export default function AppLayout() {
  const [open, setOpen] = useState(true);
  const [mini, setMini] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const { mode, toggleTheme } = useThemeMode();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));

  const handleMenuClick = (to) => {
    navigate(to);
    if (!isMdUp) setOpen(false);
  };

  const menuItems = [
    { to: '/', label: 'Панель управления', icon: <DashboardIcon /> },
    { to: '/items', label: 'Товары', icon: <InventoryIcon /> },
    { to: '/analytics', label: 'Аналитика', icon: <AnalyticsIcon /> },
    { to: '/transactions', label: 'История операций', icon: <HistoryIcon /> },
    { to: '/settings', label: 'Настройки', icon: <SettingsIcon /> },
  ];

  const isDark = mode === 'dark';

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <CssBaseline />
      <AppBar 
        position="fixed" 
        sx={{ 
          zIndex: 1300,
          width: '100%',
          '& .MuiToolbar-root': {
            px: { xs: 2, md: 4 },
          },
        }}
      >
        <Toolbar>
          <IconButton 
            color="inherit" 
            edge="start" 
            onClick={() => setOpen(!open)} 
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1, fontWeight: 600 }}>
            InventoFlow
          </Typography>
          <Tooltip title={isDark ? 'Светлая тема' : 'Темная тема'}>
            <IconButton 
              onClick={toggleTheme} 
              sx={{ 
                mr: 1, 
                color: 'inherit',
                bgcolor: 'action.hover',
                '&:hover': {
                  bgcolor: 'action.selected',
                },
              }}
            >
              {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
          </Tooltip>
          {user && (
            mini ? (
              <Tooltip title={<span><b>{user.username}</b><br/>роль: {roleLabels[user.role]||user.role}</span>} arrow placement="bottom">
                <Avatar sx={{ bgcolor: 'primary.main', width: 40, height: 40, ml: 0.2 }}>
                  {user.username[0]?.toUpperCase()}
                </Avatar>
              </Tooltip>
            ) : (
              <Chip
                avatar={<Avatar sx={{ bgcolor: 'primary.main' }}>{user.username[0].toUpperCase()}</Avatar>}
                label={<><span style={{ fontWeight:600 }}>{user.username}</span> <Typography component="span" sx={{ ml:1, color: 'text.secondary', fontWeight: 500, fontSize: 13 }}>{roleLabels[user.role] ?? user.role}</Typography></>}
                color={roleColors[user.role]}
                variant="outlined"
                sx={{ 
                  borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)', 
                  color: 'inherit', 
                  ml: 1 
                }}
              />
            )
          )}
        </Toolbar>
      </AppBar>
      <Drawer
        variant="temporary"
        open={open}
        onClose={() => setOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{ 
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { width: drawerWidth, boxSizing: 'border-box' },
        }}
      >
        <Toolbar sx={{ borderBottom: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.08)' }}>
          <Typography variant="h6" sx={{ fontWeight: 700, background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            InventoFlow
          </Typography>
        </Toolbar>
        <List sx={{ px: 2, py: 2 }}>
          {menuItems.map((item) => (
            <ListItemButton 
              key={item.to} 
              component={Link} 
              to={item.to} 
              selected={location.pathname === item.to}
              onClick={() => handleMenuClick(item.to)}
              sx={{
                mb: 1,
                borderRadius: 2,
                '&.Mui-selected': {
                  bgcolor: 'rgba(99, 102, 241, 0.15)',
                  borderLeft: '3px solid #6366f1',
                  '&:hover': {
                    bgcolor: 'rgba(99, 102, 241, 0.2)',
                  },
                },
                '&:hover': {
                  bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                },
              }}
            >
              <ListItemIcon sx={{ color: location.pathname === item.to ? 'primary.main' : 'text.secondary', minWidth: 40 }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          ))}
        </List>
      </Drawer>
      <Drawer
        variant="persistent"
        sx={{ 
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': {
            width: mini ? 72 : drawerWidth,
            transition: 'width 0.3s',
            overflowX: 'hidden',
            overflowY: 'auto',
            boxSizing: 'border-box',
            position: 'relative',
            height: '100vh',
          },
        }}
        open
      >
        <Toolbar sx={{ borderBottom: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.08)' }}>
          {mini ? (
            <Typography variant="h3" sx={{ fontWeight:900, fontSize:'2rem', background:'linear-gradient(135deg,#6366f1 0%, #ec4899 100%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', ml:0.7, transition:'all 0.2s' }}>I</Typography>
          ) : (
            <Typography variant="h6" sx={{ fontWeight: 700, background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              InventoFlow
            </Typography>
          )}
        </Toolbar>

        <List sx={{ px: 2, py: 2 }}>
          {menuItems.map((item) => (
            <Tooltip key={item.to} title={mini ? item.label : ''} placement="right" arrow disableInteractive>
              <ListItemButton
                component={Link}
                to={item.to}
                selected={location.pathname === item.to}
                sx={{
                  mb: 1,
                  borderRadius: 2,
                  flexDirection: 'row',
                  justifyContent: mini ? 'center' : 'flex-start',
                  pl: mini ? 1 : 2,
                  minHeight: 48,
                  '&.Mui-selected': {
                    bgcolor: 'rgba(99, 102, 241, 0.15)',
                    borderLeft: mini ? undefined : '3px solid #6366f1',
                    '&:hover': { bgcolor: 'rgba(99, 102, 241, 0.2)' },
                  },
                  '&:hover': { 
                    bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' 
                  },
                  transition: 'all 0.2s',
                }}
              >
                <ListItemIcon sx={{ color: location.pathname === item.to ? 'primary.main' : 'text.secondary', minWidth: mini ? 0 : 40, justifyContent: 'center' }}>
                  {item.icon}
                </ListItemIcon>
                {!mini && <ListItemText primary={item.label} />}
              </ListItemButton>
            </Tooltip>
          ))}
        </List>
        {user && (
          <Box sx={{ px: 2, pb: mini ? 0 : 2, pt: 0, position: 'relative', minHeight: 64 }}>
            <Tooltip title={mini ? user.username : ''} placement="right" arrow disableInteractive>
              <Avatar 
                sx={{ 
                  bgcolor: 'primary.main', 
                  width: mini ? 40 : 48, 
                  height: mini ? 40 : 48, 
                  fontSize: mini ? 18 : 24,
                  mx: 'auto',
                }}
              >
                {user.username[0]?.toUpperCase()}
              </Avatar>
            </Tooltip>
            {/* Logout button */}
            <Box sx={{ mt: 1, display: 'flex', justifyContent: 'center' }}>
              <Button 
                size="small"
                variant="outlined" 
                color="error" 
                startIcon={<ExitToAppIcon />} 
                onClick={logout}
                sx={{ borderRadius: 2, fontWeight: 600 }}
              >
                {mini ? '' : 'Выйти'}
              </Button>
            </Box>
          </Box>
        )}
        {/* Кнопка сворачивания/разворачивания */}
        <Box sx={{ 
          position: 'absolute', 
          bottom: 16, 
          left: mini ? '50%' : 'auto',
          right: mini ? 'auto' : 8,
          transform: mini ? 'translateX(-50%)' : 'none',
          width: mini ? 'auto' : 'calc(100% - 16px)', 
          display: 'flex', 
          justifyContent: mini ? 'center' : 'flex-end',
          zIndex: 1000,
          pointerEvents: 'auto'
        }}>
          <Tooltip title={mini ? 'Развернуть' : 'Свернуть'} placement="right">
            <IconButton 
              onClick={() => setMini(!mini)} 
              sx={{ 
                color: 'text.secondary', 
                background: isDark ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.1)', 
                borderRadius: 2, 
                transition: 'all 0.2s',
                border: isDark ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid rgba(99, 102, 241, 0.2)',
                '&:hover': {
                  background: isDark ? 'rgba(99, 102, 241, 0.3)' : 'rgba(99, 102, 241, 0.2)',
                  transform: 'scale(1.05)',
                },
              }}
            >
              {mini ? <ChevronRightIcon /> : <ChevronLeftIcon />}
            </IconButton>
          </Tooltip>
        </Box>
      </Drawer>
      <Box 
        component="main" 
        sx={{ 
          flexGrow: 1, 
          p: { xs: 2, md: 4 },
          width: { 
            xs: '100%',
            md: mini ? `calc(100% - 72px)` : `calc(100% - ${drawerWidth}px)` 
          },
          transition: 'width 0.3s',
          bgcolor: 'background.default',
          height: '100vh',
          overflowY: 'auto',
          overflowX: 'hidden',
          position: 'relative',
        }}
      >
        <Toolbar />
        <Box sx={{ pb: 6, minHeight: 'calc(100% - 64px)' }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}


