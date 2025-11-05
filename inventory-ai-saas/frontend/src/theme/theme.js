import { createTheme } from '@mui/material/styles';

export const getTheme = (mode) => createTheme({
  palette: {
    mode,
    primary: { 
      main: '#6366f1',
      light: '#818cf8',
      dark: '#4f46e5',
    },
    secondary: { 
      main: '#ec4899',
      light: '#f472b6',
      dark: '#db2777',
    },
    ...(mode === 'dark' ? {
      background: { 
        default: '#0f172a',
        paper: '#1e293b',
      },
      text: {
        primary: '#f1f5f9',
        secondary: '#cbd5e1',
      },
    } : {
      background: { 
        default: '#f8fafc',
        paper: '#ffffff',
      },
      text: {
        primary: '#0f172a',
        secondary: '#475569',
      },
    }),
    success: {
      main: '#10b981',
      light: '#34d399',
    },
    warning: {
      main: '#f59e0b',
      light: '#fbbf24',
    },
    error: {
      main: '#ef4444',
      light: '#f87171',
    },
  },
  shape: {
    borderRadius: 12,
  },
  typography: {
    fontFamily: [
      'Inter',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      'sans-serif',
    ].join(','),
    h4: {
      fontWeight: 700,
      letterSpacing: '-0.02em',
    },
    h5: {
      fontWeight: 600,
      letterSpacing: '-0.01em',
    },
    h6: {
      fontWeight: 600,
    },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: mode === 'dark' 
            ? '1px solid rgba(255, 255, 255, 0.05)' 
            : '1px solid rgba(0, 0, 0, 0.08)',
          boxShadow: mode === 'dark'
            ? '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)'
            : '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 8,
          padding: '10px 24px',
        },
        contained: {
          boxShadow: '0 4px 14px 0 rgba(99, 102, 241, 0.39)',
          '&:hover': {
            boxShadow: '0 6px 20px 0 rgba(99, 102, 241, 0.5)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: mode === 'dark' 
            ? '1px solid rgba(255, 255, 255, 0.05)' 
            : '1px solid rgba(0, 0, 0, 0.08)',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: mode === 'dark'
            ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
            : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          borderBottom: mode === 'dark'
            ? '1px solid rgba(255, 255, 255, 0.05)'
            : '1px solid rgba(0, 0, 0, 0.08)',
          boxShadow: mode === 'dark'
            ? '0 1px 3px 0 rgba(0, 0, 0, 0.3)'
            : '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
          color: mode === 'dark' ? '#f1f5f9' : '#0f172a',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          background: mode === 'dark'
            ? 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)'
            : 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
          borderRight: mode === 'dark'
            ? '1px solid rgba(255, 255, 255, 0.05)'
            : '1px solid rgba(0, 0, 0, 0.08)',
          color: mode === 'dark' ? '#f1f5f9' : '#0f172a',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            '&:hover fieldset': {
              borderColor: 'rgba(99, 102, 241, 0.5)',
            },
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          color: 'inherit',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderColor: mode === 'dark' 
            ? 'rgba(255, 255, 255, 0.2)' 
            : 'rgba(0, 0, 0, 0.2)',
        },
      },
    },
  },
});

const theme = getTheme('dark');
export default theme;


