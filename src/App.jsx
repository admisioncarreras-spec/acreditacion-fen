import { Routes, Route, Navigate } from 'react-router-dom';
import Totem from './pages/Totem.jsx';
import AdminLogin from './pages/AdminLogin.jsx';
import AdminLayout from './pages/AdminLayout.jsx';
import AdminEventos from './pages/AdminEventos.jsx';
import AdminEventoDetail from './pages/AdminEventoDetail.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import { isAuthed } from './utils/auth.js';

export default function App() {
  return (
    <Routes>
      {/* Tótem público */}
      <Route path="/" element={<Totem />} />

      {/* Login admin (redirige si ya está logueado) */}
      <Route
        path="/admin"
        element={isAuthed() ? <Navigate to="/admin/eventos" replace /> : <AdminLogin />}
      />

      {/* Rutas admin con layout */}
      <Route element={<AdminLayout />}>
        <Route path="/admin/eventos" element={<AdminEventos />} />
        <Route path="/admin/eventos/:id" element={<AdminEventoDetail />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
      </Route>

      {/* Fallback al tótem */}
      <Route path="*" element={<Totem />} />
    </Routes>
  );
}
