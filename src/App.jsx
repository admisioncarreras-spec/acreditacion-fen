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

        {/* Login */}
        <Route path="/admin" element={<AdminLogin />} />

        {/* Panel admin protegido */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route path="eventos" element={<AdminEventos />} />
          <Route path="eventos/:id" element={<AdminEventoDetail />} />
          <Route path="live" element={<AdminLive />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="salas" element={<AdminSalas />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
