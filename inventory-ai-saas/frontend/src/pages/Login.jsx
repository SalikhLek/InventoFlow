import { useState } from 'react';
import { Button, Container, Paper, Stack, TextField, Typography, Box, Alert } from '@mui/material';
import { useAuth } from '../auth/AuthContext';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import InventoryIcon from '@mui/icons-material/Inventory';
import { useThemeMode } from '../theme/ThemeContext';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Ошибка входа. Проверьте учетные данные.';
      setError(message);
    }
  };

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: isDark
        ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)'
        : 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 50%, #f8fafc 100%)',
      position: 'relative',
      overflow: 'hidden',
      '&::before': {
        content: '""',
        position: 'absolute',
        width: '500px',
        height: '500px',
        background: isDark
          ? 'radial-gradient(circle, rgba(99, 102, 241, 0.1) 0%, transparent 70%)'
          : 'radial-gradient(circle, rgba(99, 102, 241, 0.05) 0%, transparent 70%)',
        top: '-200px',
        right: '-200px',
      },
      '&::after': {
        content: '""',
        position: 'absolute',
        width: '400px',
        height: '400px',
        background: isDark
          ? 'radial-gradient(circle, rgba(236, 72, 153, 0.1) 0%, transparent 70%)'
          : 'radial-gradient(circle, rgba(236, 72, 153, 0.05) 0%, transparent 70%)',
        bottom: '-150px',
        left: '-150px',
      },
    }}>
      <Container maxWidth="xs" sx={{ position: 'relative', zIndex: 1 }}>
        <Paper sx={{ 
          p: 4, 
          borderRadius: 3,
          background: isDark
            ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%)'
            : 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.95) 100%)',
          backdropFilter: 'blur(10px)',
          border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)',
          boxShadow: isDark
            ? '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
            : '0 20px 25px -5px rgba(0, 0, 0, 0.15)',
        }}>
          <Stack spacing={3} component="form" onSubmit={onSubmit}>
            <Box sx={{ textAlign: 'center', mb: 2 }}>
              <InventoryIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
              <Typography variant="h4" sx={{ 
                fontWeight: 700,
                background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                mb: 1,
              }}>
                InventoFlow
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Войдите в систему управления инвентарем
              </Typography>
            </Box>
            <TextField 
              label="Email" 
              type="email"
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required
              fullWidth
              autoComplete="email"
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
            <TextField 
              label="Пароль" 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required
              fullWidth
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
            {error && (
              <Alert severity="error" sx={{ borderRadius: 2 }}>
                {error}
              </Alert>
            )}
            <Button 
              variant="contained" 
              type="submit" 
              fullWidth
              size="large"
              sx={{ 
                mt: 2,
                py: 1.5,
                borderRadius: 2,
                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #818cf8 0%, #6366f1 100%)',
                },
              }}
            >
              Войти
            </Button>
            <Typography variant="body2" align="center" color="text.secondary">
              Нет аккаунта? <Link to="/register" style={{ color: '#6366f1', textDecoration: 'none', fontWeight: 600 }}>Зарегистрироваться</Link>
            </Typography>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}


