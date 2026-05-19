import { Card, CardContent, Grid, Typography, Box, Stack, Select, MenuItem, FormControl, InputLabel, Button, Chip } from '@mui/material';
import { useEffect, useState } from 'react';
import api from '../api/axios';
import { XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area } from 'recharts';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import InventoryIcon from '@mui/icons-material/Inventory';
import { Tooltip as MuiTooltip } from '@mui/material';
import { Tooltip as RechartsTooltip } from 'recharts';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useThemeMode } from '../theme/ThemeContext';


const ThemedTooltip = (props) => {
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';
  return (
    <RechartsTooltip
      {...props}
      contentStyle={{
        background: isDark ? '#1e293b' : '#ffffff',
        color: isDark ? '#f1f5f9' : '#0f172a',
        border: isDark ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(0,0,0,0.15)',
        borderRadius: 8,
        fontWeight: 500
      }}
      itemStyle={{ color: isDark ? '#fff' : '#0f172a' }}
      labelStyle={{ color: '#fbbf24', fontSize: 15, fontWeight: 600 }}
    />
  );
};

export default function Analytics() {
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({});
  const [forecasts, setForecasts] = useState({});
  const [forecastDays, setForecastDays] = useState(7);
  const [forecastMethod, setForecastMethod] = useState('auto');
  const [loadingForecasts, setLoadingForecasts] = useState(false);
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';

  const loadItems = () => {
    api.get('/items/', { params: { limit: 10000, skip: 0 } })
      .then((res) => {
        setItems(res.data);
        const totalValue = res.data.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const lowStock = res.data.filter(item => item.quantity < 10);
        const avgPrice = res.data.length > 0 
          ? res.data.reduce((sum, item) => sum + item.price, 0) / res.data.length 
          : 0;
        const totalQuantity = res.data.reduce((sum, item) => sum + item.quantity, 0);
        
        setStats({ totalValue, lowStock: lowStock.length, avgPrice, totalQuantity });
      })
      .catch((err) => {
        if (err.response?.status !== 401) {
          console.warn('Ошибка загрузки данных:', err.message);
        }
      });
  };

  useEffect(() => {
    loadItems();
  }, []);

  const loadForecasts = async () => {
    setLoadingForecasts(true);
    const forecastData = {};
    const displayedItems = items.slice(0, 6);
    if (displayedItems.length === 0) {
      setForecasts(forecastData);
      setLoadingForecasts(false);
      return;
    }
    try {
      const { data } = await api.post('/items/forecasts/batch', {
        item_ids: displayedItems.map((it) => it.id),
        days: forecastDays,
        method: forecastMethod,
      });
      const results = data.results || {};
      for (const item of displayedItems) {
        const r = results[String(item.id)];
        if (!r || r.error) {
          if (r?.error) {
            console.warn(`Ошибка прогноза для товара ${item.id}:`, r.error);
          }
          continue;
        }
        // Skip items with no real sales data (all zeros)
        if (!r.has_data) continue;
        forecastData[item.id] = {
          forecast: r.forecast.map((val, idx) => ({
            день: idx + 1,
            прогноз: val,
            нижняя: r.lower ? r.lower[idx] : undefined,
            верхняя: r.upper ? r.upper[idx] : undefined,
          })),
          usedMethod: r.used_method,
        };
      }
    } catch (err) {
      console.warn('Ошибка пакетного прогноза:', err.message);
    }
    setForecasts(forecastData);
    setLoadingForecasts(false);
  };

  useEffect(() => {
    if (items.length > 0) {
      loadForecasts();
    }
  }, [items.length, forecastDays, forecastMethod]);


  return (
    <Box sx={{ pb: 4 }}>
      <Typography variant="h4" sx={{ mb: 4, fontWeight: 700 }}>
        Аналитика
      </Typography>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            background: isDark
              ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(79, 70, 229, 0.05) 100%)'
              : 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(79, 70, 229, 0.04) 100%)',
            border: isDark ? '1px solid rgba(99, 102, 241, 0.2)' : '1px solid rgba(99, 102, 241, 0.15)',
          }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Box sx={{ 
                  p: 1.5, 
                  borderRadius: 2, 
                  bgcolor: 'primary.main',
                }}>
                  <AnalyticsIcon sx={{ color: 'white' }} />
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Общая стоимость
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {stats.totalValue?.toLocaleString('ru-RU') || '0'} ₸
                  </Typography>
                </Box>
              </Stack>
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
              <Stack direction="row" alignItems="center" spacing={2}>
                <Box sx={{ 
                  p: 1.5, 
                  borderRadius: 2, 
                  bgcolor: 'secondary.main',
                }}>
                  <TrendingUpIcon sx={{ color: 'white' }} />
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Низкий запас
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {stats.lowStock || '0'}
                  </Typography>
                </Box>
              </Stack>
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
              <Stack direction="row" alignItems="center" spacing={2}>
                <Box sx={{ 
                  p: 1.5, 
                  borderRadius: 2, 
                  bgcolor: 'success.main',
                }}>
                  <InventoryIcon sx={{ color: 'white' }} />
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Средняя цена
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {stats.avgPrice?.toFixed(2) || '0'} ₸
                  </Typography>
                </Box>
              </Stack>
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
              <Stack direction="row" alignItems="center" spacing={2}>
                <Box sx={{
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: 'warning.main',
                }}>
                  <InventoryIcon sx={{ color: 'white' }} />
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Общее количество
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {stats.totalQuantity || 0}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Прогнозы спроса
                </Typography>
                <Stack direction="row" spacing={2} alignItems="center">
                  <FormControl size="small" sx={{ minWidth: 120 }}>
                    <InputLabel>Дней</InputLabel>
                    <Select value={forecastDays} label="Дней" onChange={(e) => setForecastDays(e.target.value)}>
                      <MenuItem value={7}>7 дней</MenuItem>
                      <MenuItem value={14}>14 дней</MenuItem>
                      <MenuItem value={30}>30 дней</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={{ minWidth: 140 }}>
                    <InputLabel>Метод</InputLabel>
                    <Select value={forecastMethod} label="Метод" onChange={(e) => setForecastMethod(e.target.value)}>
                      <MenuItem value="auto">Авто</MenuItem>
                      <MenuItem value="prophet">Prophet</MenuItem>
                      <MenuItem value="arima">ARIMA</MenuItem>
                      <MenuItem value="mean">Средний</MenuItem>
                    </Select>
                  </FormControl>
                  <Button 
                    variant="outlined" 
                    startIcon={<RefreshIcon />} 
                    onClick={loadForecasts}
                    disabled={loadingForecasts}
                    size="small"
                  >
                    Обновить
                  </Button>
                </Stack>
              </Stack>
              <Box sx={{ mb: 3, p: 2, bgcolor: isDark ? 'rgba(99, 102, 241, 0.1)' : 'rgba(99, 102, 241, 0.05)', borderRadius: 2, border: isDark ? '1px solid rgba(99, 102, 241, 0.2)' : '1px solid rgba(99, 102, 241, 0.15)' }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 600 }}>
                  📊 Как читать графики прогнозов:
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                  • <strong>Синяя область</strong> — прогнозируемый спрос на товар по дням
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                  • <strong>Серая область</strong> — диапазон возможных значений спроса (от минимального до максимального)
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                  • Прогнозы основаны на истории продаж каждого товара и используют различные методы анализа временных рядов
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  💡 Используйте прогнозы для планирования закупок и оптимизации управления запасами
                </Typography>
              </Box>
              {loadingForecasts ? (
                <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                  Загрузка прогнозов...
                </Typography>
              ) : items.length === 0 ? (
                <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                  Нет товаров. Добавьте товары и транзакции типа «продажа» для получения прогнозов.
                </Typography>
              ) : (
                <Grid container spacing={3}>
                  {items.slice(0, 6).map((item) => {
                    const forecast = forecasts[item.id];

                    if (!forecast || forecast.forecast.length === 0) {
                      return (
                        <Grid item xs={12} md={6} key={item.id}>
                          <Card variant="outlined" sx={{ opacity: 0.6 }}>
                            <CardContent>
                              <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem', mb: 1 }}>
                                {item.name}
                              </Typography>
                              <Box sx={{ py: 3, textAlign: 'center' }}>
                                <Typography variant="body2" color="text.secondary">
                                  Нет данных о продажах
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Добавьте транзакции типа «продажа»
                                </Typography>
                              </Box>
                            </CardContent>
                          </Card>
                        </Grid>
                      );
                    }

                    return (
                      <Grid item xs={12} md={6} key={item.id}>
                        <Card variant="outlined">
                          <CardContent>
                            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                              <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem' }}>
                                {item.name}
                              </Typography>
                              <Chip label={forecast.usedMethod.toUpperCase()} size="small" />
                            </Stack>
                            <ResponsiveContainer width="100%" height={200}>
                              <AreaChart data={forecast.forecast}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                <XAxis dataKey="день" stroke="#cbd5e1" fontSize={10} />
                                <YAxis stroke="#cbd5e1" fontSize={10} />
                                <ThemedTooltip />
                                {forecast.forecast[0].нижняя !== undefined && forecast.forecast[0].верхняя !== undefined && (
                                  <>
                                    <Area 
                                      type="monotone" 
                                      dataKey="нижняя" 
                                      stroke="#94a3b8" 
                                      fill="#94a3b8" 
                                      fillOpacity={0.15} 
                                      strokeWidth={1}
                                    />
                                    <Area 
                                      type="monotone" 
                                      dataKey="верхняя" 
                                      stroke="#94a3b8" 
                                      fill="#94a3b8" 
                                      fillOpacity={0.15} 
                                      strokeWidth={1}
                                    />
                                  </>
                                )}
                                <Area 
                                  type="monotone" 
                                  dataKey="прогноз" 
                                  stroke="#6366f1" 
                                  fill="#6366f1" 
                                  fillOpacity={0.3} 
                                  strokeWidth={2}
                                />
                              </AreaChart>
                            </ResponsiveContainer>
                          </CardContent>
                        </Card>
                      </Grid>
                    );
                  })}
                </Grid>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

