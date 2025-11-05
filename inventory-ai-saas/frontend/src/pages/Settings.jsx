import { Button, Stack, Typography, Card, CardContent, Box, Divider, Avatar, Grid, TextField } from '@mui/material';
import { useAuth } from '../auth/AuthContext';
import { useState } from 'react';
import api from '../api/axios';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import PersonIcon from '@mui/icons-material/Person';

export default function Settings() {
  const { logout, user } = useAuth();
  const [savingProfile, setSavingProfile] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [profile, setProfile] = useState({ username: user?.username || '', email: user?.email || '' });
  const [passwords, setPasswords] = useState({ current: '', new1: '', new2: '' });
  const [editing, setEditing] = useState(false);

  const saveProfile = async () => {
    try {
      setSavingProfile(true);
      await api.put('/auth/me/profile', {
        username: profile.username,
        email: profile.email || null,
      });
      alert('Профиль обновлен');
      setEditing(false);
    } catch (err) {
      alert(err.response?.data?.message || 'Ошибка обновления профиля');
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async () => {
    if (!passwords.current || !passwords.new1) {
      alert('Заполните поля паролей');
      return;
    }
    if (passwords.new1 !== passwords.new2) {
      alert('Новые пароли не совпадают');
      return;
    }
    try {
      setChangingPassword(true);
      await api.post('/auth/me/change-password', {
        current_password: passwords.current,
        new_password: passwords.new1,
      });
      alert('Пароль изменен');
      setPasswords({ current: '', new1: '', new2: '' });
    } catch (err) {
      alert(err.response?.data?.message || 'Ошибка смены пароля');
    } finally {
      setChangingPassword(false);
    }
  };
  return (
    <Box component="form" autoComplete="off">
      <Typography variant="h4" sx={{ mb: 4, fontWeight: 700 }}>
        Настройки
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
                <Avatar sx={{ bgcolor: 'primary.main' }}>
                  <PersonIcon />
                </Avatar>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Профиль пользователя
                </Typography>
              </Stack>
              
              <Stack spacing={2}>
                <TextField 
                  label="Имя пользователя" 
                  fullWidth 
                  value={profile.username}
                  onChange={(e) => setProfile({ ...profile, username: e.target.value })}
                  disabled={!editing}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, background: 'transparent' } }}
                />
                <TextField 
                  label="Email" 
                  type="email"
                  fullWidth 
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  disabled={!editing}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, background: 'transparent' } }}
                />
                {!editing ? (
                  <Button variant="contained" onClick={() => setEditing(true)}>
                    Редактировать
                  </Button>
                ) : (
                  <Stack direction={{ xs:'column', sm:'row' }} spacing={2}>
                    <Button variant="contained" onClick={saveProfile} disabled={savingProfile}>
                      {savingProfile ? 'Сохранение...' : 'Сохранить профиль'}
                    </Button>
                    <Button variant="outlined" color="inherit" onClick={() => { setEditing(false); setProfile({ username: user?.username || '', email: user?.email || '' }); }}>
                      Отмена
                    </Button>
                  </Stack>
                )}

                <Divider sx={{ my: 1 }} />

                <Typography variant="h6" sx={{ fontWeight: 600, mt: 1 }}>
                  Смена пароля
                </Typography>
                <TextField 
                  label="Текущий пароль" 
                  type="password" 
                  fullWidth
                  value={passwords.current}
                  onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                  autoComplete="current-password"
                  name="current_password_hidden"
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
                <TextField 
                  label="Новый пароль" 
                  type="password" 
                  fullWidth
                  value={passwords.new1}
                  onChange={(e) => setPasswords({ ...passwords, new1: e.target.value })}
                  autoComplete="new-password"
                  name="new_password_1"
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
                <TextField 
                  label="Повторите новый пароль" 
                  type="password" 
                  fullWidth
                  value={passwords.new2}
                  onChange={(e) => setPasswords({ ...passwords, new2: e.target.value })}
                  autoComplete="new-password"
                  name="new_password_2"
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
                <Button variant="contained" color="secondary" onClick={changePassword} disabled={changingPassword}>
                  {changingPassword ? 'Сохранение...' : 'Изменить пароль'}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
                О системе
              </Typography>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Версия
                  </Typography>
                  <Typography>1.0.0</Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Описание
                  </Typography>
                  <Typography>
                    InventoFlow - современная система управления инвентарем с AI-прогнозированием спроса
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}


