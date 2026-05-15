import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { Card, CardContent, Grid, Stack, TextField, Button, Typography, Box, IconButton, Chip, MenuItem, Select, FormControl, InputLabel } from '@mui/material';
import { AreaChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { useThemeMode } from '../theme/ThemeContext';

const DarkTooltip = (props) => {
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';
  return (
    <Tooltip
      {...props}
      contentStyle={{ 
        background: isDark ? '#1e293b' : '#ffffff', 
        border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)', 
        borderRadius: 8, 
        color: isDark ? '#f1f5f9' : '#0f172a'
      }}
      itemStyle={{ color: isDark ? '#fff' : '#0f172a' }}
      labelStyle={{ color: '#fbbf24', fontWeight: 600 }}
    />
  );
};

export default function ItemDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [days, setDays] = useState(7);
  const [method, setMethod] = useState('auto');
  const [forecast, setForecast] = useState([]);
  const [usedMethod, setUsedMethod] = useState('');
  const [loading, setLoading] = useState(false);
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';

  const load = () => api.get(`/items/${id}`)
    .then((res) => setItem(res.data))
    .catch((err) => {
      if (err.response?.status !== 401) {
        console.warn('Ошибка загрузки товара:', err.message);
      }
    });
  useEffect(() => { load(); }, [id]);

  const fetchForecast = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/items/${id}/forecast`, { params: { days, method } });
      if (!data.has_data) {
        alert('У этого товара нет истории продаж. Добавьте транзакции типа «продажа», чтобы получить прогноз.');
        setForecast([]);
        setUsedMethod('');
        return;
      }
      setUsedMethod(data.used_method);
      const mapped = data.forecast.map((y, i) => ({
        день: i + 1,
        прогноз: y,
        нижняя: data.lower ? data.lower[i] : undefined,
        верхняя: data.upper ? data.upper[i] : undefined,
      }));
      setForecast(mapped);
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Ошибка получения прогноза';
      alert(message);
    } finally {
      setLoading(false);
    }
  };

  if (!item) return (
    <Box sx={{ textAlign: 'center', py: 8 }}>
      <Typography color="text.secondary">Загрузка...</Typography>
    </Box>
  );

  const totalValue = item.quantity * item.price;

  return (
    <Box sx={{ pb: 6 }}>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 4 }}>
        <IconButton onClick={() => navigate('/items')} sx={{ color: 'text.secondary' }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          {item.name}
        </Typography>
      </Stack>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            background: isDark
              ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(79, 70, 229, 0.05) 100%)'
              : 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(79, 70, 229, 0.04) 100%)',
            border: isDark ? '1px solid rgba(99, 102, 241, 0.2)' : '1px solid rgba(99, 102, 241, 0.15)',
          }}>
            <CardContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>Количество</Typography>
              <Typography variant="h3" sx={{ fontWeight: 700 }}>{item.quantity}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            background: isDark
              ? 'linear-gradient(135deg, rgba(236, 72, 153, 0.1) 0%, rgba(219, 39, 119, 0.05) 100%)'
              : 'linear-gradient(135deg, rgba(236, 72, 153, 0.08) 0%, rgba(219, 39, 119, 0.04) 100%)',
            border: isDark ? '1px solid rgba(236, 72, 153, 0.2)' : '1px solid rgba(236, 72, 153, 0.15)',
          }}>
            <CardContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>Цена за единицу</Typography>
              <Typography variant="h3" sx={{ fontWeight: 700 }}>{item.price.toFixed(2)} ₸</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            background: isDark
              ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.05) 100%)'
              : 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(5, 150, 105, 0.04) 100%)',
            border: isDark ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(16, 185, 129, 0.15)',
          }}>
            <CardContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>Общая стоимость</Typography>
              <Typography variant="h3" sx={{ fontWeight: 700, color: 'success.main' }}>{totalValue.toLocaleString('ru-RU')} ₸</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            background: isDark
              ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(217, 119, 6, 0.05) 100%)'
              : 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(217, 119, 6, 0.04) 100%)',
            border: isDark ? '1px solid rgba(245, 158, 11, 0.2)' : '1px solid rgba(245, 158, 11, 0.15)',
          }}>
            <CardContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>Статус</Typography>
              <Chip 
                label={
                  item.quantity === 0 ? 'Нет в наличии' : 
                  item.quantity < 10 ? 'Низкий запас' : 
                  'В наличии'
                } 
                color={item.quantity === 0 ? 'error' : item.quantity < 10 ? 'warning' : 'success'} 
                sx={{ mt: 1, fontWeight: 600 }} 
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3, flexWrap:'wrap' }}>
            <TextField label="Количество дней" type="number" value={days} onChange={(e) => setDays(Number(e.target.value))} size="small" sx={{ width: 200 }} inputProps={{ min: 1, max: 30 }} />
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel id="method-label">Метод</InputLabel>
              <Select labelId="method-label" value={method} label="Метод" onChange={(e) => setMethod(e.target.value)}>
                <MenuItem value="auto">Авто</MenuItem>
                <MenuItem value="prophet">Prophet</MenuItem>
                <MenuItem value="arima">ARIMA</MenuItem>
                <MenuItem value="mean">Средний</MenuItem>
              </Select>
            </FormControl>
            <Button variant="contained" onClick={fetchForecast} disabled={loading} startIcon={<TrendingUpIcon />} sx={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', '&:hover': { background: 'linear-gradient(135deg, #818cf8 0%, #6366f1 100%)' } }}>
              {loading ? 'Загрузка...' : 'Получить прогноз'}
            </Button>
            {usedMethod && (
              <Chip label={`Метод: ${usedMethod.toUpperCase()}`} size="small" sx={{ ml: 1 }} />
            )}
          </Stack>
          {forecast.length > 0 && (
            <>
              <Typography variant="h6" gutterBottom sx={{ mb: 2, fontWeight: 600 }}>
                Прогноз спроса на {days} дней
              </Typography>
              <Box sx={{ mb: 3, p: 2, bgcolor: isDark ? 'rgba(99, 102, 241, 0.1)' : 'rgba(99, 102, 241, 0.05)', borderRadius: 2, border: isDark ? '1px solid rgba(99, 102, 241, 0.2)' : '1px solid rgba(99, 102, 241, 0.15)' }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 600 }}>
                  📊 Как читать график:
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                  • <strong>Синяя линия</strong> — прогнозируемый спрос на товар по дням
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                  • <strong>Серая область</strong> — диапазон возможных значений (от минимального до максимального)
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                  • Прогноз основан на истории продаж товара и использует метод: <strong>{usedMethod.toUpperCase()}</strong>
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  💡 Используйте прогноз для планирования закупок и управления запасами
                </Typography>
              </Box>
              <ResponsiveContainer width="100%" height={360}>
                <AreaChart data={forecast}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="день" stroke="#cbd5e1" label={{ value: 'День', position: 'insideBottom', offset: -5, fill: '#cbd5e1' }} />
                  <YAxis stroke="#cbd5e1" label={{ value: 'Спрос', angle: -90, position: 'insideLeft', fill: '#cbd5e1' }} />
                  <Tooltip contentStyle={{ background:'#1e293b', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8 }} />
                  {forecast[0].нижняя !== undefined && forecast[0].верхняя !== undefined && (
                    <>
                      <Area type="monotone" dataKey="нижняя" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.15} activeDot={false} dot={false} />
                      <Area type="monotone" dataKey="верхняя" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.15} activeDot={false} dot={false} />
                    </>
                  )}
                  <Line type="monotone" dataKey="прогноз" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, fill: '#6366f1' }} activeDot={{ r: 6 }} />
                  <Legend />
                </AreaChart>
              </ResponsiveContainer>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}


