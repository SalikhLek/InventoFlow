import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import {
  Card, CardContent, Grid, Stack, TextField, Button, Typography, Box,
  IconButton, Chip, MenuItem, Select, FormControl, InputLabel,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Paper, Table, TableHead, TableBody, TableRow, TableCell,
  Tooltip,
} from '@mui/material';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import SellIcon from '@mui/icons-material/Sell';
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart';
import RemoveShoppingCartIcon from '@mui/icons-material/RemoveShoppingCart';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { useThemeMode } from '../theme/ThemeContext';

const TX_LABELS = { sell: 'Продажа', add: 'Пополнение', remove: 'Списание' };
const TX_COLORS = { sell: 'error', add: 'success', remove: 'warning' };

const DarkTooltip = (props) => {
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';
  return (
    <ReTooltip
      {...props}
      contentStyle={{
        background: isDark ? '#1e293b' : '#ffffff',
        border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)',
        borderRadius: 8,
        color: isDark ? '#f1f5f9' : '#0f172a',
      }}
      itemStyle={{ color: isDark ? '#fff' : '#0f172a' }}
      labelStyle={{ color: '#fbbf24', fontWeight: 600 }}
    />
  );
};

export default function ItemDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';

  const [item, setItem] = useState(null);

  // Forecast
  const [days, setDays] = useState(7);
  const [method, setMethod] = useState('auto');
  const [forecast, setForecast] = useState([]);
  const [usedMethod, setUsedMethod] = useState('');
  const [forecastLoading, setForecastLoading] = useState(false);
  const [noDataMsg, setNoDataMsg] = useState('');

  // Transactions history
  const [transactions, setTransactions] = useState([]);

  // Transaction dialog
  const [txOpen, setTxOpen] = useState(false);
  const [txType, setTxType] = useState('sell');
  const [txForm, setTxForm] = useState({ quantity: '', price: null, date: '', notes: '' });

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', price: 0 });

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false);

  const load = () =>
    api.get(`/items/${id}`)
      .then((res) => setItem(res.data))
      .catch((err) => {
        if (err.response?.status !== 401) console.warn('Ошибка загрузки товара:', err.message);
      });

  const loadTransactions = () =>
    api.get(`/items/${id}/transactions`)
      .then((res) => setTransactions(res.data))
      .catch(() => {});

  useEffect(() => { load(); loadTransactions(); }, [id]);

  // Auto-run forecast after transactions load, if there are any sales
  useEffect(() => {
    if (transactions.some((tx) => tx.transaction_type === 'sell')) {
      fetchForecast();
    }
  }, [transactions.length]);

  // --- Forecast ---
  const fetchForecast = async () => {
    setForecastLoading(true);
    try {
      const { data } = await api.get(`/items/${id}/forecast`, { params: { days, method } });
      if (!data.has_data) {
        setNoDataMsg('У этого товара нет истории продаж. Добавьте транзакции типа «продажа», чтобы получить прогноз.');
        setForecast([]);
        setUsedMethod('');
        return;
      }
      setNoDataMsg('');
      setUsedMethod(data.used_method);
      setForecast(
        data.forecast.map((y, i) => ({
          день: i + 1,
          прогноз: y,
          нижняя: data.lower ? data.lower[i] : undefined,
          верхняя: data.upper ? data.upper[i] : undefined,
        }))
      );
    } catch (err) {
      setNoDataMsg(err.response?.data?.message || err.message || 'Ошибка получения прогноза');
      setForecast([]);
      setUsedMethod('');
    } finally {
      setForecastLoading(false);
    }
  };

  // --- Transaction ---
  const openTx = (type) => {
    setTxType(type);
    setTxForm({
      quantity: '',
      price: type === 'sell' ? item.price : null,
      date: new Date().toISOString().split('T')[0],
      notes: '',
    });
    setTxOpen(true);
  };

  const handleTransaction = async () => {
    const qty = Number(txForm.quantity);
    if (!txForm.quantity || isNaN(qty) || qty <= 0) {
      alert('Введите корректное количество (больше 0)');
      return;
    }
    try {
      await api.post('/transactions/', {
        item_id: Number(id),
        transaction_type: txType,
        quantity: qty,
        price: txForm.price || null,
        transaction_date: txForm.date,
        notes: txForm.notes || null,
      });
      setTxOpen(false);
      await load();
      await loadTransactions();
    } catch (err) {
      alert(err.response?.data?.detail || err.message || 'Ошибка операции');
    }
  };

  // --- Edit ---
  const openEdit = () => {
    setEditForm({ name: item.name, price: item.price });
    setEditOpen(true);
  };

  const handleEdit = async () => {
    try {
      await api.put(`/items/${id}`, { name: editForm.name, price: Number(editForm.price) });
      setEditOpen(false);
      await load();
    } catch (err) {
      alert(err.response?.data?.detail || err.message || 'Ошибка редактирования');
    }
  };

  // --- Delete ---
  const handleDelete = async () => {
    try {
      await api.delete(`/items/${id}`);
      navigate('/items');
    } catch (err) {
      alert(err.response?.data?.detail || err.message || 'Ошибка удаления');
    }
  };

  if (!item) return (
    <Box sx={{ textAlign: 'center', py: 8 }}>
      <Typography color="text.secondary">Загрузка...</Typography>
    </Box>
  );

  const totalValue = item.quantity * item.price;
  const isOutOfStock = item.quantity === 0;

  return (
    <Box sx={{ pb: 6 }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 4 }} flexWrap="wrap" gap={2}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <IconButton onClick={() => navigate('/items')} sx={{ color: 'text.secondary' }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>{item.name}</Typography>
        </Stack>

        {/* Action buttons */}
        <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
          <Tooltip title={isOutOfStock ? 'Нет в наличии' : ''}>
            <span>
              <Button
                variant="contained"
                size="small"
                startIcon={<SellIcon />}
                disabled={isOutOfStock}
                onClick={() => openTx('sell')}
                sx={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', '&:hover': { background: 'linear-gradient(135deg, #f87171, #ef4444)' } }}
              >
                Продать
              </Button>
            </span>
          </Tooltip>
          <Button
            variant="contained"
            size="small"
            startIcon={<AddShoppingCartIcon />}
            onClick={() => openTx('add')}
            sx={{ background: 'linear-gradient(135deg, #10b981, #059669)', '&:hover': { background: 'linear-gradient(135deg, #34d399, #10b981)' } }}
          >
            Пополнить
          </Button>
          <Tooltip title={isOutOfStock ? 'Нет в наличии' : ''}>
            <span>
              <Button
                variant="outlined"
                size="small"
                startIcon={<RemoveShoppingCartIcon />}
                disabled={isOutOfStock}
                onClick={() => openTx('remove')}
                color="warning"
              >
                Списать
              </Button>
            </span>
          </Tooltip>
          <Button
            variant="outlined"
            size="small"
            startIcon={<EditIcon />}
            onClick={openEdit}
          >
            Изменить
          </Button>
          <Button
            variant="outlined"
            size="small"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={() => setDeleteOpen(true)}
          >
            Удалить
          </Button>
        </Stack>
      </Stack>

      {/* Stats cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{
            background: isDark
              ? 'linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(79,70,229,0.05) 100%)'
              : 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(79,70,229,0.04) 100%)',
            border: isDark ? '1px solid rgba(99,102,241,0.2)' : '1px solid rgba(99,102,241,0.15)',
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
              ? 'linear-gradient(135deg, rgba(236,72,153,0.1) 0%, rgba(219,39,119,0.05) 100%)'
              : 'linear-gradient(135deg, rgba(236,72,153,0.08) 0%, rgba(219,39,119,0.04) 100%)',
            border: isDark ? '1px solid rgba(236,72,153,0.2)' : '1px solid rgba(236,72,153,0.15)',
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
              ? 'linear-gradient(135deg, rgba(16,185,129,0.1) 0%, rgba(5,150,105,0.05) 100%)'
              : 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(5,150,105,0.04) 100%)',
            border: isDark ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(16,185,129,0.15)',
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
              ? 'linear-gradient(135deg, rgba(245,158,11,0.1) 0%, rgba(217,119,6,0.05) 100%)'
              : 'linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(217,119,6,0.04) 100%)',
            border: isDark ? '1px solid rgba(245,158,11,0.2)' : '1px solid rgba(245,158,11,0.15)',
          }}>
            <CardContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>Статус</Typography>
              <Chip
                label={item.quantity === 0 ? 'Нет в наличии' : item.quantity < 10 ? 'Низкий запас' : 'В наличии'}
                color={item.quantity === 0 ? 'error' : item.quantity < 10 ? 'warning' : 'success'}
                sx={{ mt: 1, fontWeight: 600 }}
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Transaction history */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>История операций</Typography>
          {transactions.length === 0 ? (
            <Box sx={{ py: 3, textAlign: 'center' }}>
              <Typography color="text.secondary">Нет операций по этому товару</Typography>
            </Box>
          ) : (
            <Paper sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.05)' }}>
                    <TableCell sx={{ fontWeight: 600 }}>Тип</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Количество</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Цена, ₸</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Дата</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Примечание</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {[...transactions].reverse().slice(0, 10).map((tx) => (
                    <TableRow key={tx.id} hover>
                      <TableCell>
                        <Chip
                          label={TX_LABELS[tx.transaction_type] || tx.transaction_type}
                          color={TX_COLORS[tx.transaction_type] || 'default'}
                          size="small"
                          sx={{ fontWeight: 600 }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontWeight: 500 }}>{tx.quantity}</TableCell>
                      <TableCell>{tx.price != null ? tx.price.toFixed(2) : '—'}</TableCell>
                      <TableCell>{tx.transaction_date}</TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>{tx.notes || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          )}
          {transactions.length > 10 && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, textAlign: 'right' }}>
              Показаны последние 10 из {transactions.length} операций
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* Forecast */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>Прогноз спроса</Typography>
          {transactions.filter((tx) => tx.transaction_type === 'sell').length === 0 ? (
            <Box sx={{ p: 3, borderRadius: 2, bgcolor: isDark ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)' }}>
              <Typography variant="body2" color="warning.main" sx={{ fontWeight: 500 }}>
                ⚠ Прогноз недоступен: у этого товара нет истории продаж. Добавьте транзакцию типа «Продать», чтобы получить прогноз.
              </Typography>
            </Box>
          ) : (
            <>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3, flexWrap: 'wrap' }}>
            <TextField
              label="Количество дней" type="number" value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              size="small" sx={{ width: 200 }} inputProps={{ min: 1, max: 30 }}
            />
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel id="method-label">Метод</InputLabel>
              <Select labelId="method-label" value={method} label="Метод" onChange={(e) => setMethod(e.target.value)}>
                <MenuItem value="auto">Авто</MenuItem>
                <MenuItem value="prophet">Prophet</MenuItem>
                <MenuItem value="sarima">SARIMA</MenuItem>
                <MenuItem value="mean">Средний</MenuItem>
              </Select>
            </FormControl>
            <Button
              variant="contained" onClick={fetchForecast} disabled={forecastLoading}
              startIcon={<TrendingUpIcon />}
              sx={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', '&:hover': { background: 'linear-gradient(135deg, #818cf8 0%, #6366f1 100%)' } }}
            >
              {forecastLoading ? 'Загрузка...' : 'Получить прогноз'}
            </Button>
            {usedMethod && <Chip label={`Метод: ${usedMethod.toUpperCase()}`} size="small" />}
          </Stack>

          {noDataMsg && (
            <Box sx={{ p: 3, borderRadius: 2, bgcolor: isDark ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', mt: 1 }}>
              <Typography variant="body2" color="warning.main" sx={{ fontWeight: 500 }}>
                ⚠ {noDataMsg}
              </Typography>
            </Box>
          )}

          {forecast.length > 0 && (
            <>
              <Box sx={{ mb: 3, p: 2, bgcolor: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.05)', borderRadius: 2, border: isDark ? '1px solid rgba(99,102,241,0.2)' : '1px solid rgba(99,102,241,0.15)' }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 600 }}>📊 Как читать график:</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>• <strong>Синяя линия</strong> — прогнозируемый спрос на товар по дням</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>• <strong>Серая область</strong> — диапазон возможных значений</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>• Прогноз использует метод: <strong>{usedMethod.toUpperCase()}</strong></Typography>
                <Typography variant="body2" color="text.secondary">💡 Используйте прогноз для планирования закупок и управления запасами</Typography>
              </Box>
              <ResponsiveContainer width="100%" height={360}>
                <AreaChart data={forecast}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="день" stroke="#cbd5e1" label={{ value: 'День', position: 'insideBottom', offset: -5, fill: '#cbd5e1' }} />
                  <YAxis stroke="#cbd5e1" label={{ value: 'Спрос', angle: -90, position: 'insideLeft', fill: '#cbd5e1' }} />
                  <DarkTooltip />
                  {forecast[0].нижняя !== undefined && forecast[0].верхняя !== undefined && (
                    <>
                      <Area type="monotone" dataKey="нижняя" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.15} activeDot={false} dot={false} />
                      <Area type="monotone" dataKey="верхняя" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.15} activeDot={false} dot={false} />
                    </>
                  )}
                  <Area type="monotone" dataKey="прогноз" stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} strokeWidth={3} dot={{ r: 4, fill: '#6366f1' }} activeDot={{ r: 6 }} />
                  <Legend />
                </AreaChart>
              </ResponsiveContainer>
            </>
          )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Transaction dialog */}
      <Dialog open={txOpen} onClose={() => setTxOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { background: isDark ? 'linear-gradient(135deg,rgba(30,41,59,0.97),rgba(15,23,42,0.97))' : undefined } }}>
        <DialogTitle sx={{ fontWeight: 600 }}>
          {txType === 'sell' ? 'Продать товар' : txType === 'add' ? 'Пополнить склад' : 'Списание товара'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 0 }}>
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary">
                Товар: <strong>{item.name}</strong> &nbsp;·&nbsp; Текущий остаток: <strong>{item.quantity}</strong>
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth label="Количество" type="number"
                value={txForm.quantity}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '' || (!isNaN(v) && Number(v) >= 0))
                    setTxForm({ ...txForm, quantity: v === '' ? '' : Number(v) });
                }}
                inputProps={{ min: 1, step: 1 }}
                error={txForm.quantity !== '' && Number(txForm.quantity) <= 0}
                helperText={txForm.quantity !== '' && Number(txForm.quantity) <= 0 ? 'Должно быть больше 0' : ''}
                required
              />
            </Grid>
            {txType === 'sell' && (
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth label="Цена за единицу (₸)" type="number"
                  value={txForm.price ?? ''}
                  onChange={(e) => setTxForm({ ...txForm, price: Number(e.target.value) })}
                  inputProps={{ min: 0, step: 0.01 }}
                />
              </Grid>
            )}
            <Grid item xs={12}>
              <TextField
                fullWidth label="Дата" type="date"
                value={txForm.date}
                onChange={(e) => setTxForm({ ...txForm, date: e.target.value })}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth label="Примечание (необязательно)"
                value={txForm.notes}
                onChange={(e) => setTxForm({ ...txForm, notes: e.target.value })}
                multiline rows={2}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 2 }}>
          <Button onClick={() => setTxOpen(false)} sx={{ color: 'text.secondary' }}>Отмена</Button>
          <Button
            variant="contained" onClick={handleTransaction}
            disabled={txForm.quantity === '' || Number(txForm.quantity) <= 0}
            color={txType === 'sell' ? 'error' : txType === 'add' ? 'success' : 'warning'}
          >
            Подтвердить
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { background: isDark ? 'linear-gradient(135deg,rgba(30,41,59,0.97),rgba(15,23,42,0.97))' : undefined } }}>
        <DialogTitle sx={{ fontWeight: 600 }}>Редактировать товар</DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 0 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth label="Название"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth label="Цена (₸)" type="number"
                value={editForm.price}
                onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 2 }}>
          <Button onClick={() => setEditOpen(false)} sx={{ color: 'text.secondary' }}>Отмена</Button>
          <Button
            variant="contained" onClick={handleEdit}
            disabled={!editForm.name.trim()}
            sx={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)', '&:hover': { background: 'linear-gradient(135deg,#818cf8,#6366f1)' } }}
          >
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>Удалить товар?</DialogTitle>
        <DialogContent>
          <Typography>Вы уверены, что хотите удалить <strong>{item.name}</strong>? Это действие нельзя отменить.</Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteOpen(false)}>Отмена</Button>
          <Button variant="contained" color="error" onClick={handleDelete}>Удалить</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
