import {
  Box, Button, Card, CardContent, Chip, CircularProgress,
  FormControl, Grid, IconButton, InputLabel, MenuItem,
  Pagination, Paper, Select, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField,
  Tooltip, Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import api from '../api/axios';
import { useThemeMode } from '../theme/ThemeContext';
import HistoryIcon from '@mui/icons-material/History';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FilterListIcon from '@mui/icons-material/FilterList';
import RefreshIcon from '@mui/icons-material/Refresh';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import * as XLSX from 'xlsx';

const pickerFieldSx = (isDark) => ({
  minWidth: 155,
  '& .MuiOutlinedInput-root': {
    borderRadius: 2,
    transition: 'box-shadow 0.2s, border-color 0.2s',
    '&:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: '#6366f1',
    },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderColor: '#6366f1',
      borderWidth: 2,
      boxShadow: '0 0 0 3px rgba(99,102,241,0.15)',
    },
  },
  '& .MuiInputLabel-root.Mui-focused': {
    color: '#6366f1',
  },
  '& input[type="date"]::-webkit-calendar-picker-indicator': {
    cursor: 'pointer',
    borderRadius: 4,
    padding: '2px',
    filter: isDark
      ? 'invert(1) brightness(0.7) sepia(1) hue-rotate(200deg) saturate(3)'
      : 'brightness(0) saturate(100%) invert(40%) sepia(80%) saturate(600%) hue-rotate(215deg)',
  },
  '& input[type="time"]::-webkit-calendar-picker-indicator': {
    cursor: 'pointer',
    borderRadius: 4,
    padding: '2px',
    filter: isDark
      ? 'invert(1) brightness(0.7) sepia(1) hue-rotate(200deg) saturate(3)'
      : 'brightness(0) saturate(100%) invert(40%) sepia(80%) saturate(600%) hue-rotate(215deg)',
  },
});

const TYPE_LABELS = { sell: 'Продажа', add: 'Покупка товара', remove: 'Списание' };
const TYPE_COLORS = { sell: 'success', add: 'error', remove: 'warning' };
const TYPE_ICONS = {
  sell: <TrendingUpIcon fontSize="small" />,
  add: <TrendingDownIcon fontSize="small" />,
  remove: <RemoveCircleOutlineIcon fontSize="small" />,
};

function today() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function startOfYear() {
  return `${new Date().getFullYear()}-01-01`;
}

const PRESETS = [
  { label: 'Сегодня', from: today, to: today },
  { label: 'Неделя', from: () => daysAgo(6), to: today },
  { label: 'Месяц', from: () => daysAgo(29), to: today },
  { label: 'Год', from: startOfYear, to: today },
];

export default function TransactionHistory() {
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');
  const [timeFrom, setTimeFrom] = useState('');
  const [timeTo, setTimeTo]     = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [activePreset, setActivePreset] = useState(null);

  const buildDateFrom = () =>
    dateFrom ? (timeFrom ? `${dateFrom}T${timeFrom}:00` : dateFrom) : undefined;
  const buildDateTo = () =>
    dateTo ? (timeTo ? `${dateTo}T${timeTo}:59` : dateTo) : undefined;

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const fetchData = (extraParams = {}) => {
    setLoading(true);
    const df = buildDateFrom();
    const dt = buildDateTo();
    const params = {
      skip: page * rowsPerPage,
      limit: rowsPerPage,
      ...(df && { date_from: df }),
      ...(dt && { date_to: dt }),
      ...(typeFilter && { transaction_type: typeFilter }),
      ...extraParams,
    };
    api.get('/transactions/', { params })
      .then((res) => {
        setRows(res.data);
        const hdr = res.headers['x-total-count'];
        setTotal(hdr ? parseInt(hdr) : res.data.length);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [page, rowsPerPage]); // eslint-disable-line

  const applyPreset = (preset) => {
    const from = preset.from();
    const to   = preset.to();
    setDateFrom(from);
    setDateTo(to);
    setActivePreset(preset.label);
    setPage(0);
    fetchData({ date_from: from, date_to: to, skip: 0 });
  };

  const applyFilters = () => {
    setPage(0);
    fetchData({ skip: 0 });
  };

  const resetFilters = () => {
    setDateFrom('');
    setDateTo('');
    setTimeFrom('');
    setTimeTo('');
    setTypeFilter('');
    setActivePreset(null);
    setPage(0);
    setLoading(true);
    api.get('/transactions/', { params: { skip: 0, limit: rowsPerPage } })
      .then((res) => {
        setRows(res.data);
        const hdr = res.headers['x-total-count'];
        setTotal(hdr ? parseInt(hdr) : res.data.length);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const exportExcel = () => {
    setLoading(true);
    const df = buildDateFrom();
    const dt = buildDateTo();
    const params = {
      skip: 0,
      limit: 50000,
      ...(df && { date_from: df }),
      ...(dt && { date_to: dt }),
      ...(typeFilter && { transaction_type: typeFilter }),
    };
    api.get('/transactions/', { params })
      .then((res) => {
        const allRows = res.data;

        const sellRows = allRows.filter(r => r.transaction_type === 'sell');
        const addRows  = allRows.filter(r => r.transaction_type === 'add');
        const remRows  = allRows.filter(r => r.transaction_type === 'remove');

        const sum = (arr) => arr.reduce((s, r) => s + (r.price ?? 0) * r.quantity, 0);
        const qty = (arr) => arr.reduce((s, r) => s + r.quantity, 0);

        const fmtDt = (d, t) => d ? (t ? `${d} ${t}` : d) : null;
        const periodLabel = dateFrom || dateTo
          ? `${fmtDt(dateFrom, timeFrom) || '...'} — ${fmtDt(dateTo, timeTo) || '...'}`
          : 'Все время';

        const header = [
          ['Отчёт: История операций'],
          ['Период:', periodLabel],
          ['Дата выгрузки:', new Date().toLocaleString('ru-RU')],
          [],
          ['СВОДКА'],
          ['Продажи',      'Кол-во ед.', qty(sellRows), 'Сумма:', `${sum(sellRows).toFixed(2)} ₸`],
          ['Покупка товаров', 'Кол-во ед.', qty(addRows),  'Сумма:', `${sum(addRows).toFixed(2)} ₸`],
          ['Списания',     'Кол-во ед.', qty(remRows),  '',        ''],
          ['Итого операций:', allRows.length],
          [],
          ['№', 'Дата операции', 'Товар', 'Тип операции', 'Количество', 'Цена', 'Сумма', 'Примечание'],
        ];

        const dataRows = allRows.map((r, i) => [
          i + 1,
          r.transaction_date,
          r.item_name || r.item_id,
          TYPE_LABELS[r.transaction_type] || r.transaction_type,
          r.quantity,
          r.price ?? '',
          r.price != null ? parseFloat((r.price * r.quantity).toFixed(2)) : '',
          r.notes || '',
        ]);

        const ws = XLSX.utils.aoa_to_sheet([...header, ...dataRows]);

        ws['!cols'] = [
          { wch: 22 }, { wch: 22 }, { wch: 28 }, { wch: 16 },
          { wch: 13 }, { wch: 13 }, { wch: 15 }, { wch: 30 },
        ];

        // Bold первые строки (заголовок отчёта и сводка)
        const boldRows = [0, 4, 5, 6, 7, 8, 10];
        boldRows.forEach((r) => {
          const cellRef = XLSX.utils.encode_cell({ r, c: 0 });
          if (ws[cellRef]) ws[cellRef].s = { font: { bold: true } };
        });

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'История операций');
        const filename = `transactions_${dateFrom || 'all'}_${dateTo || 'all'}.xlsx`;
        XLSX.writeFile(wb, filename);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const stats = {
    sellsAmount: rows.filter(r => r.transaction_type === 'sell').reduce((s, r) => s + (r.price ?? 0) * r.quantity, 0),
    sellsQty: rows.filter(r => r.transaction_type === 'sell').reduce((s, r) => s + r.quantity, 0),
    addsQty: rows.filter(r => r.transaction_type === 'add').reduce((s, r) => s + r.quantity, 0),
    addsAmount: rows.filter(r => r.transaction_type === 'add').reduce((s, r) => s + (r.price ?? 0) * r.quantity, 0),
    removesQty: rows.filter(r => r.transaction_type === 'remove').reduce((s, r) => s + r.quantity, 0),
    removesAmount: rows.filter(r => r.transaction_type === 'remove').reduce((s, r) => s + (r.price ?? 0) * r.quantity, 0),
  };

  const cardSx = {
    borderRadius: 3,
    background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
    border: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.08)',
  };

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3} flexWrap="wrap" gap={2}>
        <Stack direction="row" alignItems="center" gap={1.5}>
          <HistoryIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          <Box>
            <Typography variant="h5" fontWeight={700}>История операций</Typography>
            <Typography variant="body2" color="text.secondary">Продажи и пополнения товаров</Typography>
          </Box>
        </Stack>
        <Button
          variant="contained"
          startIcon={<FileDownloadIcon />}
          onClick={exportExcel}
          disabled={loading}
          sx={{ borderRadius: 2, fontWeight: 600, background: 'linear-gradient(135deg,#6366f1,#ec4899)', '&:hover': { opacity: 0.9 } }}
        >
          Экспорт Excel
        </Button>
      </Stack>

      {/* Stats cards */}
      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} sm={4}>
          <Card sx={cardSx} elevation={0}>
            <CardContent sx={{ py: 2 }}>
              <Stack direction="row" alignItems="center" gap={1}>
                <TrendingUpIcon sx={{ color: 'success.main' }} />
                <Box>
                  <Typography variant="caption" color="text.secondary">Выручка (продажи)</Typography>
                  <Typography variant="h6" fontWeight={700} color="success.main">
                    {stats.sellsAmount.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₸
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {stats.sellsQty.toLocaleString('ru-RU')} ед. продано
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={cardSx} elevation={0}>
            <CardContent sx={{ py: 2 }}>
              <Stack direction="row" alignItems="center" gap={1}>
                <TrendingDownIcon sx={{ color: 'error.main' }} />
                <Box>
                  <Typography variant="caption" color="text.secondary">Покупка товаров</Typography>
                  <Typography variant="h6" fontWeight={700} color="error.main">
                    {stats.addsAmount.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₸
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {stats.addsQty.toLocaleString('ru-RU')} ед. куплено
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={cardSx} elevation={0}>
            <CardContent sx={{ py: 2 }}>
              <Stack direction="row" alignItems="center" gap={1}>
                <RemoveCircleOutlineIcon sx={{ color: 'warning.main' }} />
                <Box>
                  <Typography variant="caption" color="text.secondary">Списания</Typography>
                  <Typography variant="h6" fontWeight={700} color="warning.main">
                    {stats.removesAmount.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₸
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {stats.removesQty.toLocaleString('ru-RU')} ед. списано
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters */}
      <Card sx={{ ...cardSx, mb: 3 }} elevation={0}>
        <CardContent>
          <Stack direction="row" alignItems="center" gap={1} mb={2}>
            <FilterListIcon sx={{ color: 'primary.main', fontSize: 20 }} />
            <Typography variant="subtitle1" fontWeight={600}>Фильтры</Typography>
          </Stack>

          {/* Period presets */}
          <Stack direction="row" gap={1} mb={2} flexWrap="wrap">
            {PRESETS.map((p) => (
              <Chip
                key={p.label}
                label={p.label}
                onClick={() => applyPreset(p)}
                variant={activePreset === p.label ? 'filled' : 'outlined'}
                color={activePreset === p.label ? 'primary' : 'default'}
                sx={{ fontWeight: 600, cursor: 'pointer' }}
              />
            ))}
          </Stack>

          {/* Custom date range + type filter */}
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} alignItems="flex-end" flexWrap="wrap">
            <Stack direction="row" gap={1} alignItems="flex-end">
              <TextField
                label="Дата с"
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setActivePreset(null); }}
                size="small"
                InputLabelProps={{ shrink: true }}
                sx={pickerFieldSx(isDark)}
              />
              <TextField
                label="Время с"
                type="time"
                value={timeFrom}
                onChange={(e) => setTimeFrom(e.target.value)}
                size="small"
                InputLabelProps={{ shrink: true }}
                sx={{ ...pickerFieldSx(isDark), minWidth: 130 }}
              />
            </Stack>
            <Stack direction="row" gap={1} alignItems="flex-end">
              <TextField
                label="Дата по"
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setActivePreset(null); }}
                size="small"
                InputLabelProps={{ shrink: true }}
                sx={pickerFieldSx(isDark)}
              />
              <TextField
                label="Время по"
                type="time"
                value={timeTo}
                onChange={(e) => setTimeTo(e.target.value)}
                size="small"
                InputLabelProps={{ shrink: true }}
                sx={{ ...pickerFieldSx(isDark), minWidth: 130 }}
              />
            </Stack>
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel shrink>Тип операции</InputLabel>
              <Select
                value={typeFilter}
                label="Тип операции"
                displayEmpty
                renderValue={(v) => v === '' ? 'Все' : { sell: 'Продажа', add: 'Покупка товара', remove: 'Списание' }[v]}
                onChange={(e) => setTypeFilter(e.target.value)}
                notched
              >
                <MenuItem value="" sx={{ fontWeight: typeFilter === '' ? 700 : 400 }}>Все</MenuItem>
                <MenuItem value="sell">Продажа</MenuItem>
                <MenuItem value="add">Покупка товара</MenuItem>
                <MenuItem value="remove">Списание</MenuItem>
              </Select>
            </FormControl>
            <Stack direction="row" gap={1}>
              <Button variant="contained" onClick={applyFilters} sx={{ borderRadius: 2, fontWeight: 600 }}>
                Применить
              </Button>
              <Tooltip title="Сбросить фильтры">
                <IconButton onClick={resetFilters} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* Table */}
      <Card sx={cardSx} elevation={0}>
        <CardContent sx={{ p: 0 }}>
          <Box sx={{ px: 3, py: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography variant="subtitle1" fontWeight={600}>
              Операции{' '}
              <Typography component="span" color="text.secondary" fontSize={14}>
                ({total.toLocaleString('ru-RU')} записей)
              </Typography>
            </Typography>
          </Box>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer component={Paper} elevation={0} sx={{ background: 'transparent' }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ '& th': { fontWeight: 700, color: 'text.secondary', fontSize: 13, py: 1.5 } }}>
                    <TableCell>#</TableCell>
                    <TableCell>Дата</TableCell>
                    <TableCell>Товар</TableCell>
                    <TableCell>Тип</TableCell>
                    <TableCell align="right">Кол-во</TableCell>
                    <TableCell align="right">Цена</TableCell>
                    <TableCell align="right">Сумма</TableCell>
                    <TableCell>Примечание</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                        Нет данных за выбранный период
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row, idx) => {
                      const amount = row.price != null ? row.price * row.quantity : null;
                      const dateStr = row.transaction_date
                        ? row.transaction_date.replace('T', ' ').slice(0, 16)
                        : '—';
                      return (
                        <TableRow
                          key={row.id}
                          hover
                          sx={{ '&:last-child td': { border: 0 } }}
                        >
                          <TableCell sx={{ color: 'text.secondary', fontSize: 12 }}>
                            {page * rowsPerPage + idx + 1}
                          </TableCell>
                          <TableCell sx={{ fontSize: 13, whiteSpace: 'nowrap' }}>{dateStr}</TableCell>
                          <TableCell sx={{ fontWeight: 500, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {row.item_name || `ID ${row.item_id}`}
                          </TableCell>
                          <TableCell>
                            <Chip
                              icon={TYPE_ICONS[row.transaction_type]}
                              label={TYPE_LABELS[row.transaction_type] || row.transaction_type}
                              color={TYPE_COLORS[row.transaction_type] || 'default'}
                              size="small"
                              variant="outlined"
                              sx={{ fontWeight: 600, fontSize: 12 }}
                            />
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>{row.quantity}</TableCell>
                          <TableCell align="right" sx={{ color: 'text.secondary' }}>
                            {row.price != null ? row.price.toLocaleString('ru-RU', { minimumFractionDigits: 2 }) : '—'}
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600, color: row.transaction_type === 'sell' ? 'success.main' : row.transaction_type === 'add' ? 'error.main' : 'warning.main' }}>
                            {amount != null ? amount.toLocaleString('ru-RU', { minimumFractionDigits: 2 }) : '—'}
                          </TableCell>
                          <TableCell sx={{ color: 'text.secondary', fontSize: 12, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {row.notes || ''}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
              <Box sx={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                flexWrap: 'wrap', gap: 2, px: 2, py: 1.5,
                borderTop: '1px solid', borderColor: 'divider',
              }}>
                <Stack direction="row" alignItems="center" gap={1.5}>
                  <Typography variant="body2" color="text.secondary">Строк:</Typography>
                  <Select
                    size="small"
                    value={rowsPerPage}
                    onChange={(e) => { setRowsPerPage(parseInt(e.target.value)); setPage(0); }}
                    sx={{ fontSize: 13 }}
                  >
                    {[10, 25, 50, 100].map(n => <MenuItem key={n} value={n}>{n}</MenuItem>)}
                  </Select>
                  <Typography variant="body2" color="text.secondary">
                    {total === 0 ? '0' : `${page * rowsPerPage + 1}–${Math.min((page + 1) * rowsPerPage, total)}`} из {total}
                  </Typography>
                </Stack>
                <Pagination
                  count={Math.max(1, Math.ceil(total / rowsPerPage))}
                  page={page + 1}
                  onChange={(_, p) => setPage(p - 1)}
                  shape="rounded"
                  size="small"
                  siblingCount={2}
                  boundaryCount={1}
                  sx={{
                    '& .MuiPaginationItem-root': {
                      borderRadius: 2,
                      fontWeight: 500,
                      border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.12)',
                    },
                    '& .MuiPaginationItem-root.Mui-selected': {
                      background: 'linear-gradient(135deg,#6366f1,#ec4899)',
                      color: '#fff',
                      fontWeight: 700,
                      border: 'none',
                      boxShadow: '0 2px 8px rgba(99,102,241,0.4)',
                    },
                    '& .MuiPaginationItem-root:hover:not(.Mui-selected)': {
                      background: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.08)',
                      borderColor: '#6366f1',
                    },
                    '& .MuiPaginationItem-ellipsis': {
                      border: 'none',
                    },
                  }}
                />
              </Box>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
