import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Totem from './pages/Totem';
import AdminLogin from './pages/AdminLogin';
import AdminLayout from './pages/AdminLayout';
import AdminEventos from './pages/AdminEventos';
import AdminEventoDetail from './pages/AdminEventoDetail';
import AdminDashboard from './pages/AdminDashboard';
import AdminSalas from './pages/AdminSalas';
import AdminLive from './pages/AdminLive';
import { getToken } from './utils/auth';

function ProtectedRoute({ children }) {
  if (!getToken()) return <Navigate to="/admin" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Tótem público */}
        <Route path="/" element={<Totem />} />

        {/* Login admin */}
        <Route path="/admin" element={<AdminLogin />} />

        {/* Panel admin protegido (layout wrapper sin path) */}
        <Route
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/admin/eventos" element={<AdminEventos />} />
          <Route path="/admin/eventos/:id" element={<AdminEventoDetail />} />
          <Route path="/admin/live" element={<AdminLive />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/salas" element={<AdminSalas />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
