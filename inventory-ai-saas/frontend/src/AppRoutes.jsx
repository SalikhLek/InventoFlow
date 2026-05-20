import { Routes, Route, BrowserRouter } from 'react-router-dom';
import { CssBaseline } from '@mui/material';
import { ThemeProvider } from './theme/ThemeContext';
import { AuthProvider } from './auth/AuthContext';
import RequireAuth from './auth/RequireAuth';
import AppLayout from './layout/AppLayout';
import Dashboard from './pages/Dashboard';
import Items from './pages/Items';
import ItemDetails from './pages/ItemDetails';
import Settings from './pages/Settings';
import Analytics from './pages/Analytics';
import TransactionHistory from './pages/TransactionHistory';
import Login from './pages/Login';
import Register from './pages/Register';

export default function AppRoutes() {
  return (
    <ThemeProvider>
      <CssBaseline />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route element={<RequireAuth />}> 
              <Route element={<AppLayout />}>
                <Route index element={<Dashboard />} />
                <Route path="items" element={<Items />} />
                <Route path="items/:id" element={<ItemDetails />} />
                <Route path="analytics" element={<Analytics />} />
                <Route path="transactions" element={<TransactionHistory />} />
                <Route path="settings" element={<Settings />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}


