import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { clearToken } from '../utils/auth';
import '../styles/admin.css';

export default function AdminLayout() {
  const navigate = useNavigate();

  const cerrarSesion = () => {
    clearToken();
    navigate('/admin');
  };

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div className="admin-header-inner">
          <div className="admin-brand">
            <div className="admin-logo">FEN</div>
            <div>
              <div className="admin-brand-title">Acreditación FEN</div>
              <div className="admin-brand-sub">Panel administrativo</div>
            </div>
          </div>
          <nav className="admin-nav">
            <NavLink to="/admin/eventos" className={({ isActive }) => `admin-nav-link ${isActive ? 'active' : ''}`}>
              Eventos
            </NavLink>
            <NavLink to="/admin/dashboard" className={({ isActive }) => `admin-nav-link ${isActive ? 'active' : ''}`}>
              Dashboard
            </NavLink>
            <NavLink to="/admin/salas" className={({ isActive }) => `admin-nav-link ${isActive ? 'active' : ''}`}>
              Salas
            </NavLink>
          </nav>
          <button onClick={cerrarSesion} className="admin-logout-btn">Cerrar sesión</button>
        </div>
      </header>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
