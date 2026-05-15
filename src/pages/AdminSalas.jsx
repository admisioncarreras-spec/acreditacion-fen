import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { getToken, clearToken } from '../utils/auth';
import { loadCachedSalas, saveCachedSalas } from '../utils/eventCache';
import '../styles/admin.css';

export default function AdminSalas() {
  const [salas, setSalas] = useState(() => loadCachedSalas() || []);
  const [loading, setLoading] = useState(() => !loadCachedSalas());
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({ nombre_sala: '', capacidad: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const cargar = async ({ background = false } = {}) => {
    if (background) setRefreshing(true);
    const res = await api.listarSalas(getToken());
    setLoading(false);
    setRefreshing(false);
    if (!res.ok) {
      if (res.error?.toLowerCase().includes('autorizado')) {
        clearToken();
        navigate('/admin');
        return;
      }
      setError(res.error || 'Error al cargar');
      return;
    }
    const sorted = (res.salas || []).sort((a, b) => a.nombre_sala.localeCompare(b.nombre_sala));
    setSalas(sorted);
    saveCachedSalas(sorted);
  };

  useEffect(() => {
    const cached = loadCachedSalas();
    cargar({ background: !!cached });
  }, []);

  const openCreate = () => {
    setFormData({ nombre_sala: '', capacidad: '' });
    setEditing(null);
    setShowForm(true);
    setError('');
  };

  const openEdit = (sala) => {
    setFormData({ nombre_sala: sala.nombre_sala, capacidad: String(sala.capacidad) });
    setEditing(sala.nombre_sala);
    setShowForm(true);
    setError('');
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
    setFormData({ nombre_sala: '', capacidad: '' });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.nombre_sala.trim()) {
      setError('Falta el nombre de la sala');
      return;
    }
    const cap = parseInt(formData.capacidad);
    if (isNaN(cap) || cap < 0) {
      setError('La capacidad debe ser un número positivo');
      return;
    }
    setSaving(true);
    setError('');
    const res = await api.guardarSala({ nombre_sala: formData.nombre_sala.trim(), capacidad: cap }, getToken());
    setSaving(false);
    if (!res.ok) {
      setError(res.error || 'Error al guardar');
      return;
    }
    closeForm();
    cargar();
  };

  const eliminar = async (sala) => {
    if (!confirm(`¿Eliminar la sala "${sala.nombre_sala}"?\n\nNota: los inscritos asignados a esta sala NO se borran, pero quedarán "huérfanos" (sin capacidad definida).`)) return;
    const res = await api.eliminarSala(sala.nombre_sala, getToken());
    if (res.ok) cargar();
    else alert(res.error || 'Error al eliminar');
  };

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-h1">Salas</h1>
          <p className="admin-h1-sub">
            Define las salas disponibles y sus capacidades máximas
            {refreshing && <span style={{ color: 'var(--gray-400)', marginLeft: 8, fontSize: 13 }}>· actualizando…</span>}
          </p>
        </div>
        <button onClick={openCreate} className="admin-btn admin-btn-primary">+ Crear sala</button>
      </div>

      {error && !showForm && <div className="admin-error-banner">{error}</div>}

      {loading ? (
        <div className="admin-loading">Cargando salas...</div>
      ) : salas.length === 0 ? (
        <div className="admin-empty">
          <p>No tienes salas definidas todavía. Crea la primera para empezar a usar el control de capacidad.</p>
          <button onClick={openCreate} className="admin-btn admin-btn-primary">Crear primera sala</button>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th style={{ textAlign: 'right' }}>Capacidad</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {salas.map(sala => (
                <tr key={sala.nombre_sala}>
                  <td><strong>{sala.nombre_sala}</strong></td>
                  <td style={{ textAlign: 'right' }} className="mono">{sala.capacidad}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button onClick={() => openEdit(sala)} className="admin-btn admin-btn-ghost admin-btn-sm">Editar</button>
                    <button onClick={() => eliminar(sala)} className="admin-btn admin-btn-sm admin-btn-danger" style={{ marginLeft: 4 }}>Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="admin-table-footer">
            {salas.length} sala(s) · Capacidad total: {salas.reduce((sum, s) => sum + (s.capacidad || 0), 0)} cupos
          </div>
        </div>
      )}

      {showForm && (
        <div className="admin-modal-overlay" onClick={closeForm}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>{editing ? 'Editar sala' : 'Crear sala'}</h2>
              <button onClick={closeForm} className="admin-modal-close">×</button>
            </div>

            <form onSubmit={handleSubmit} className="admin-form">
              <div className="admin-form-field">
                <label>Nombre de la sala *</label>
                <input type="text" value={formData.nombre_sala}
                  onChange={(e) => setFormData(prev => ({ ...prev, nombre_sala: e.target.value }))}
                  placeholder="Ej: Sala H-304 (Edificio Place)" className="admin-input"
                  disabled={!!editing} required autoFocus />
                {editing && <small>El nombre no se puede editar. Si necesitas renombrar, elimina y crea una nueva.</small>}
              </div>

              <div className="admin-form-field">
                <label>Capacidad máxima *</label>
                <input type="number" min="0" value={formData.capacidad}
                  onChange={(e) => setFormData(prev => ({ ...prev, capacidad: e.target.value }))}
                  placeholder="Ej: 50" className="admin-input" required />
                <small>Número total de personas que caben en la sala.</small>
              </div>

              {error && <div className="admin-error">{error}</div>}

              <div className="admin-modal-footer">
                <button type="button" onClick={closeForm} className="admin-btn admin-btn-ghost">Cancelar</button>
                <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>
                  {saving ? 'Guardando...' : (editing ? 'Guardar cambios' : 'Crear sala')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
