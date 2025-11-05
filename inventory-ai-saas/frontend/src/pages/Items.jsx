import { useEffect, useState } from 'react';
import api from '../api/axios';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Grid, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography, IconButton, Box, Chip, Menu, MenuItem, InputAdornment, FormControl, InputLabel, Select } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import AddIcon from '@mui/icons-material/Add';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SellIcon from '@mui/icons-material/Sell';
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart';
import RemoveShoppingCartIcon from '@mui/icons-material/RemoveShoppingCart';
import Papa from 'papaparse';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import SearchIcon from '@mui/icons-material/Search';
import { useThemeMode } from '../theme/ThemeContext';

export default function Items() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', quantity: 0, price: 0, sales_history: [] });
  const [csvOpen, setCsvOpen] = useState(false);
  const [csvRows, setCsvRows] = useState([]);
  const [transactionOpen, setTransactionOpen] = useState(false);
  const [transactionItem, setTransactionItem] = useState(null);
  const [transactionType, setTransactionType] = useState('sell');
  const [transactionForm, setTransactionForm] = useState({ quantity: '', price: null, date: new Date().toISOString().split('T')[0], notes: '' });
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, in_stock, low_stock, out_of_stock
  const navigate = useNavigate();
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';

  const load = () => api.get('/items/')
    .then((res) => setItems(res.data))
    .catch((err) => {
      if (err.response?.status !== 401) {
        console.warn('Ошибка загрузки товаров:', err.message);
      }
    });
  useEffect(() => { load(); }, []);

  const create = async () => {
    try {
      await api.post('/items/', form);
      setOpen(false);
      setForm({ name: '', quantity: 0, price: 0, sales_history: [] });
      load();
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Ошибка создания товара';
      alert(message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Вы уверены, что хотите удалить этот товар?')) return;
    try {
      await api.delete(`/items/${id}`);
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Ошибка удаления товара');
    }
  };

  const handleCSVFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      complete: (results) => {
        setCsvRows(results.data.filter(x => x.name && x.quantity && x.price));
      }
    });
  };
  const handleImportCSV = async () => {
    try {
      await api.post('/items/bulk', { items: csvRows });
      setCsvOpen(false);
      setCsvRows([]);
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Ошибка импорта CSV');
    }
  };

  const handleMenuOpen = (event, itemId) => {
    setAnchorEl(event.currentTarget);
    setSelectedItemId(itemId);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedItemId(null);
  };

  const handleTransactionOpen = (type, item) => {
    setTransactionType(type);
    setTransactionItem(item);
    setTransactionForm({
      quantity: '',
      price: type === 'sell' ? item.price : null,
      date: new Date().toISOString().split('T')[0],
      notes: ''
    });
    setTransactionOpen(true);
    handleMenuClose();
  };

  const handleTransaction = async () => {
    // Проверка валидности количества
    const quantity = Number(transactionForm.quantity);
    if (transactionForm.quantity === '' || isNaN(quantity) || quantity <= 0) {
      alert('Пожалуйста, введите корректное количество (больше 0)');
      return;
    }
    
    try {
      await api.post('/transactions/', {
        item_id: transactionItem.id,
        transaction_type: transactionType,
        quantity: quantity,
        price: transactionForm.price || null,
        transaction_date: transactionForm.date,
        notes: transactionForm.notes || null
      });
      setTransactionOpen(false);
      load();
    } catch (err) {
      alert(err.response?.data?.detail || err.response?.data?.message || 'Ошибка выполнения операции');
    }
  };

  // Фильтрация товаров
  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    let matchesStatus = true;
    if (statusFilter === 'in_stock') {
      matchesStatus = item.quantity >= 10;
    } else if (statusFilter === 'low_stock') {
      matchesStatus = item.quantity > 0 && item.quantity < 10;
    } else if (statusFilter === 'out_of_stock') {
      matchesStatus = item.quantity === 0;
    }
    
    return matchesSearch && matchesStatus;
  });

  return (
    <Box sx={{ pb: 4 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Товары
        </Typography>
        <Stack direction="row" spacing={2}>
          <Button 
            variant="contained" 
            startIcon={<AddIcon />}
            onClick={() => setOpen(true)}
            sx={{
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #818cf8 0%, #6366f1 100%)',
              },
            }}
          >
            Добавить товар
          </Button>
          <Button 
            variant="outlined"
            startIcon={<UploadFileIcon />}
            onClick={() => setCsvOpen(true)}
            sx={{ ml: 1 }}
          >
            Импорт из CSV
          </Button>
        </Stack>
      </Stack>

      {/* Поиск и фильтры */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Поиск по названию товара..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ 
            '& .MuiOutlinedInput-root': { borderRadius: 2 },
            maxWidth: { xs: '100%', sm: 400 }
          }}
        />
        <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 200 } }}>
          <InputLabel>Статус</InputLabel>
          <Select
            value={statusFilter}
            label="Статус"
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <MenuItem value="all">Все товары</MenuItem>
            <MenuItem value="in_stock">В наличии</MenuItem>
            <MenuItem value="low_stock">Низкий запас</MenuItem>
            <MenuItem value="out_of_stock">Нет в наличии</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      <Paper sx={{ overflowX: 'auto' }}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: isDark ? 'rgba(99, 102, 241, 0.1)' : 'rgba(99, 102, 241, 0.05)' }}>
              <TableCell sx={{ fontWeight: 600 }}>Название</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Количество</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Цена</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Стоимость</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Статус</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="right">Действия</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">
                    {items.length === 0 
                      ? 'Нет товаров. Добавьте первый товар!' 
                      : 'Товары не найдены. Попробуйте изменить фильтры поиска.'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredItems.map((it) => {
                const totalValue = it.quantity * it.price;
                const isOutOfStock = it.quantity === 0;
                const isLowStock = it.quantity > 0 && it.quantity < 10;
                return (
                  <TableRow key={it.id} hover sx={{ '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' } }}>
                    <TableCell>
                      <Typography sx={{ fontWeight: 500 }}>{it.name}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={it.quantity} 
                        size="small"
                        color={isOutOfStock ? 'error' : isLowStock ? 'warning' : 'default'}
                        sx={{ fontWeight: 600 }}
                      />
                    </TableCell>
                    <TableCell>{it.price.toFixed(2)} ₸</TableCell>
                    <TableCell>
                      <Typography sx={{ fontWeight: 600, color: 'primary.main' }}>
                        {totalValue.toLocaleString('ru-RU')} ₸
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={
                          isOutOfStock ? 'Нет в наличии' : 
                          isLowStock ? 'Низкий запас' : 
                          'В наличии'
                        } 
                        size="small"
                        color={isOutOfStock ? 'error' : isLowStock ? 'warning' : 'success'}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <IconButton 
                          size="small" 
                          onClick={() => navigate(`/items/${it.id}`)}
                          sx={{ color: 'primary.main' }}
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                        <IconButton 
                          size="small" 
                          onClick={(e) => handleMenuOpen(e, it.id)}
                        >
                          <MoreVertIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Paper>

      <Dialog 
        open={open} 
        onClose={() => setOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            background: isDark
              ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%)'
              : 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.95) 100%)',
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 600, fontSize: '1.5rem' }}>
          Новый товар
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 0 }}>
            <Grid item xs={12}>
              <TextField 
                fullWidth 
                label="Название" 
                value={form.name} 
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField 
                fullWidth 
                label="Количество" 
                type="number" 
                value={form.quantity} 
                onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField 
                fullWidth 
                label="Цена (₸)" 
                type="number" 
                value={form.price} 
                onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 2 }}>
          <Button onClick={() => setOpen(false)} sx={{ color: 'text.secondary' }}>
            Отмена
          </Button>
          <Button 
            onClick={create} 
            variant="contained"
            sx={{
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #818cf8 0%, #6366f1 100%)',
              },
            }}
          >
            Создать
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={csvOpen} onClose={() => setCsvOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Импорт товаров из CSV</DialogTitle>
        <DialogContent>
          <Button variant="contained" component="label">
            Загрузить CSV
            <input type="file" hidden accept=".csv,text/csv" onChange={handleCSVFile} />
          </Button>
          {csvRows.length > 0 && (
            <Box sx={{ mt: 3, maxHeight: 350, overflowY: 'auto' }}>
              <Typography>Предпросмотр ({csvRows.length} строк):</Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Название</TableCell>
                    <TableCell>Количество</TableCell>
                    <TableCell>Цена</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {csvRows.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{row.name}</TableCell>
                      <TableCell>{row.quantity}</TableCell>
                      <TableCell>{row.price}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCsvOpen(false)}>Отмена</Button>
          <Button onClick={handleImportCSV} disabled={!csvRows.length} variant="contained">Импортировать</Button>
        </DialogActions>
      </Dialog>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        {selectedItemId && items.find(it => it.id === selectedItemId) && (() => {
          const item = items.find(it => it.id === selectedItemId);
          const isOutOfStock = item.quantity === 0;
          return (
            <>
              <MenuItem 
                onClick={() => handleTransactionOpen('sell', item)}
                disabled={isOutOfStock}
              >
                <SellIcon sx={{ mr: 1, fontSize: 20 }} /> Продать
              </MenuItem>
              <MenuItem onClick={() => handleTransactionOpen('add', item)}>
                <AddShoppingCartIcon sx={{ mr: 1, fontSize: 20 }} /> Добавить
              </MenuItem>
              <MenuItem 
                onClick={() => handleTransactionOpen('remove', item)}
                disabled={isOutOfStock}
              >
                <RemoveShoppingCartIcon sx={{ mr: 1, fontSize: 20 }} /> Уменьшить
              </MenuItem>
              <MenuItem onClick={() => { handleMenuClose(); handleDelete(item.id); }} sx={{ color: 'error.main' }}>
                <DeleteIcon sx={{ mr: 1, fontSize: 20 }} /> Удалить
              </MenuItem>
            </>
          );
        })()}
      </Menu>

      <Dialog 
        open={transactionOpen} 
        onClose={() => setTransactionOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {transactionType === 'sell' ? 'Продать товар' : transactionType === 'add' ? 'Добавить товар' : 'Уменьшить товар'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 0 }}>
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary">
                Товар: <strong>{transactionItem?.name}</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Текущее количество: <strong>{transactionItem?.quantity}</strong>
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField 
                fullWidth 
                label="Количество" 
                type="number" 
                value={transactionForm.quantity} 
                onChange={(e) => {
                  const value = e.target.value;
                  // Разрешаем пустую строку или число
                  if (value === '' || (!isNaN(value) && Number(value) >= 0)) {
                    setTransactionForm({ ...transactionForm, quantity: value === '' ? '' : Number(value) });
                  }
                }}
                inputProps={{ min: 0, step: 1 }}
                required
                helperText={transactionForm.quantity === '' ? 'Введите количество' : transactionForm.quantity <= 0 ? 'Количество должно быть больше 0' : ''}
                error={transactionForm.quantity !== '' && transactionForm.quantity <= 0}
              />
            </Grid>
            {transactionType === 'sell' && (
              <Grid item xs={12} sm={6}>
                <TextField 
                  fullWidth 
                  label="Цена за единицу (₽)" 
                  type="number" 
                  value={transactionForm.price || transactionItem?.price || ''} 
                  onChange={(e) => setTransactionForm({ ...transactionForm, price: Number(e.target.value) })}
                  inputProps={{ min: 0, step: 0.01 }}
                />
              </Grid>
            )}
            <Grid item xs={12}>
              <TextField 
                fullWidth 
                label="Дата" 
                type="date" 
                value={transactionForm.date} 
                onChange={(e) => setTransactionForm({ ...transactionForm, date: e.target.value })}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField 
                fullWidth 
                label="Примечание (необязательно)" 
                value={transactionForm.notes} 
                onChange={(e) => setTransactionForm({ ...transactionForm, notes: e.target.value })}
                multiline
                rows={2}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 2 }}>
          <Button onClick={() => setTransactionOpen(false)}>
            Отмена
          </Button>
          <Button 
            onClick={handleTransaction} 
            variant="contained"
            disabled={
              (transactionType === 'sell' && transactionItem?.quantity === 0) ||
              transactionForm.quantity === '' || 
              Number(transactionForm.quantity) <= 0
            }
          >
            Подтвердить
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}


