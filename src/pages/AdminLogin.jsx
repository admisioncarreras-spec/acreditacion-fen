import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { setToken } from '../utils/auth';
import '../styles/admin.css';

export default function AdminLogin() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    setError('');
    const res = await api.loginAdmin(password);
    setLoading(false);
    if (res.ok && res.token) {
      setToken(res.token);
      navigate('/admin/eventos');
    } else {
      setError(res.error || 'Contraseña incorrecta');
      setPassword('');
    }
  };

  return (
    <div className="admin-login-wrap">
      <form onSubmit={handleSubmit} className="admin-login-card">
        <div className="admin-login-logo">FEN</div>
        <h1 className="admin-login-title">Panel de Acreditación</h1>
        <p className="admin-login-sub">Ingresa la contraseña administradora</p>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Contraseña"
          className="admin-input"
          autoFocus
          disabled={loading}
        />

        {error && <div className="admin-error">{error}</div>}

        <button type="submit" className="admin-btn admin-btn-primary admin-btn-block" disabled={loading || !password}>
          {loading ? 'Verificando...' : 'Ingresar'}
        </button>

        <a href="/" className="admin-login-back">← Volver al tótem</a>
      </form>
    </div>
  );
}
