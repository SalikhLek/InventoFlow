import { Card, CardContent, Grid, Typography, Box, Stack, Table, TableBody, TableCell, TableHead, TableRow, Chip, Paper, Button } from '@mui/material';
import { useEffect, useState } from 'react';
import api from '../api/axios';
import InventoryIcon from '@mui/icons-material/Inventory';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import WarningIcon from '@mui/icons-material/Warning';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import { useThemeMode } from '../theme/ThemeContext';

const currency = (v) => `${Number(v).toLocaleString('ru-RU')} ₸`;

export default function Dashboard() {
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({ totalValue: 0, lowStock: 0 });
  const navigate = useNavigate();
  const theme = useTheme();
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';
  
  const loadData = () => {
    api.get('/items/')
      .then((res) => {
        setItems(res.data);
        const totalValue = res.data.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const lowStock = res.data.filter(item => item.quantity < 10).length;
        setStats({ totalValue, lowStock });
      })
      .catch((err) => {
        if (err.response?.status !== 401) {
          console.warn('Ошибка загрузки товаров:', err.message);
        }
      });
  };

  useEffect(() => {
    loadData();
    // Обновление данных каждые 30 секунд
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Обновление при возврате на страницу (через visibility API)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const lowStockItems = items.filter(item => item.quantity < 10).slice(0, 10);

  return (
    <Box sx={{ pb: 6, minHeight: 'calc(100vh - 64px)' }}>
      <Typography variant="h4" sx={{ mb: 4, fontWeight: 700 }}>
        Панель управления
      </Typography>
      
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={4}>
          <Card sx={{ 
            background: isDark 
              ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(79, 70, 229, 0.05) 100%)'
              : 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(79, 70, 229, 0.04) 100%)',
            border: isDark ? '1px solid rgba(99, 102, 241, 0.2)' : '1px solid rgba(99, 102, 241, 0.15)',
          }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'primary.main', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <InventoryIcon sx={{ color: 'white' }} />
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Всего товаров
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700 }}>
                    {items.length}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={4}>
          <Card sx={{ 
            background: isDark
              ? 'linear-gradient(135deg, rgba(236, 72, 153, 0.1) 0%, rgba(219, 39, 119, 0.05) 100%)'
              : 'linear-gradient(135deg, rgba(236, 72, 153, 0.08) 0%, rgba(219, 39, 119, 0.04) 100%)',
            border: isDark ? '1px solid rgba(236, 72, 153, 0.2)' : '1px solid rgba(236, 72, 153, 0.15)',
          }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'secondary.main' }}>
                  <AttachMoneyIcon sx={{ color: 'white' }} />
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Общая стоимость
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700 }}>
                    {currency(stats.totalValue)}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={4}>
          <Card sx={{ 
            background: isDark
              ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(217, 119, 6, 0.05) 100%)'
              : 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(217, 119, 6, 0.04) 100%)',
            border: isDark ? '1px solid rgba(245, 158, 11, 0.2)' : '1px solid rgba(245, 158, 11, 0.15)',
          }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'warning.main' }}>
                  <TrendingUpIcon sx={{ color: 'white' }} />
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Низкий запас
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700 }}>
                    {stats.lowStock}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Товары с низким запасом
                </Typography>
                {lowStockItems.length > 0 && (
                  <Chip 
                    icon={<WarningIcon />} 
                    label={`${lowStockItems.length} товаров`} 
                    color="warning" 
                    variant="outlined"
                  />
                )}
              </Stack>
              {lowStockItems.length === 0 ? (
                <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                  Все товары в наличии
                </Typography>
              ) : (
                <Paper sx={{ overflowX: 'auto' }}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>Название</TableCell>
                        <TableCell sx={{ fontWeight: 600 }} align="right">Количество</TableCell>
                        <TableCell sx={{ fontWeight: 600 }} align="right">Цена</TableCell>
                        <TableCell sx={{ fontWeight: 600 }} align="right">Стоимость</TableCell>
                        <TableCell sx={{ fontWeight: 600 }} align="right">Действия</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {lowStockItems.map((item) => (
                        <TableRow key={item.id} hover>
                          <TableCell>
                            <Typography sx={{ fontWeight: 500 }}>{item.name}</Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Chip 
                              label={item.quantity} 
                              size="small"
                              color="warning"
                              sx={{ fontWeight: 600 }}
                            />
                          </TableCell>
                          <TableCell align="right">{currency(item.price)}</TableCell>
                          <TableCell align="right">
                            <Typography sx={{ fontWeight: 600, color: 'primary.main' }}>
                              {currency(item.quantity * item.price)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Button 
                              size="small" 
                              variant="outlined"
                              onClick={() => navigate(`/items/${item.id}`)}
                            >
                              Подробнее
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Paper>
              )}
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ mb: 3, fontWeight: 600 }}>
                Статистика
              </Typography>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Средняя цена товара
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {items.length > 0 
                      ? currency((items.reduce((sum, item) => sum + item.price, 0) / items.length).toFixed(2)) 
                      : currency(0)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Товаров на складе
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {items.reduce((sum, item) => sum + item.quantity, 0)}
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


