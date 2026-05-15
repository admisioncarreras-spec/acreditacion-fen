import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { getToken, clearToken } from '../utils/auth';
import '../styles/admin.css';

const EMPTY_EVENT = {
  id_evento: '',
  nombre: '',
  descripcion: '',
  fecha: '',
  hora_evento_inicio: '',
  hora_evento_fin: '',
  ventana_inicio: '',
  ventana_fin: '',
  activo_manual: 'auto',
};

export default function AdminEventos() {
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState(EMPTY_EVENT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const cargarEventos = async () => {
    setLoading(true);
    const res = await api.listarEventos(getToken());
    setLoading(false);
    if (!res.ok) {
      if (res.error?.toLowerCase().includes('autorizado')) {
        clearToken();
        navigate('/admin');
        return;
      }
      setError(res.error || 'Error al cargar');
      return;
    }
    // Ordenar por fecha descendente
    const sorted = (res.eventos || []).sort((a, b) => {
      return (b.fecha || '').localeCompare(a.fecha || '');
    });
    setEventos(sorted);
  };

  useEffect(() => { cargarEventos(); }, []);

  const openCreate = () => {
    const hoy = new Date().toISOString().slice(0, 10);
    setFormData({ ...EMPTY_EVENT, fecha: hoy });
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = (evento) => {
    setFormData({ ...EMPTY_EVENT, ...evento });
    setEditing(evento.id_evento);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
    setFormData(EMPTY_EVENT);
    setError('');
  };

  const handleField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.id_evento.trim() || !formData.nombre.trim() || !formData.fecha) {
      setError('Faltan campos obligatorios (ID, Nombre, Fecha)');
      return;
    }
    setSaving(true);
    setError('');
    const res = editing
      ? await api.editarEvento(editing, formData, getToken())
      : await api.crearEvento(formData, getToken());
    setSaving(false);
    if (!res.ok) {
      setError(res.error || 'Error al guardar');
      return;
    }
    closeForm();
    cargarEventos();
  };

  const cambiarActivoManual = async (evento, nuevoValor) => {
    const res = await api.editarEvento(evento.id_evento, { activo_manual: nuevoValor }, getToken());
    if (res.ok) cargarEventos();
    else alert(res.error || 'Error al actualizar');
  };

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-h1">Eventos</h1>
          <p className="admin-h1-sub">Gestiona los ensayos y actividades de acreditación</p>
        </div>
        <button onClick={openCreate} className="admin-btn admin-btn-primary">
          + Crear evento
        </button>
      </div>

      {error && !showForm && <div className="admin-error-banner">{error}</div>}

      {loading ? (
        <div className="admin-loading">Cargando eventos...</div>
      ) : eventos.length === 0 ? (
        <div className="admin-empty">
          <p>No hay eventos creados todavía.</p>
          <button onClick={openCreate} className="admin-btn admin-btn-primary">Crear el primero</button>
        </div>
      ) : (
        <div className="admin-events-grid">
          {eventos.map(ev => (
            <div key={ev.id_evento} className="admin-event-card">
              <div className="admin-event-head">
                <div className="admin-event-id">{ev.id_evento}</div>
                <EstadoBadge activoManual={ev.activo_manual} />
              </div>
              <h2 className="admin-event-name">{ev.nombre}</h2>
              {ev.descripcion && <p className="admin-event-desc">{ev.descripcion}</p>}

              <div className="admin-event-meta">
                <div><strong>Fecha:</strong> {ev.fecha || '—'}</div>
                <div><strong>Horario evento:</strong> {ev.hora_evento_inicio || '—'} – {ev.hora_evento_fin || '—'}</div>
                <div><strong>Ventana acreditación:</strong> {ev.ventana_inicio || '—'} – {ev.ventana_fin || '—'}</div>
              </div>

              <div className="admin-event-actions">
                <Link to={`/admin/eventos/${encodeURIComponent(ev.id_evento)}`} className="admin-btn admin-btn-primary admin-btn-sm">
                  Ver inscritos →
                </Link>
                <button onClick={() => openEdit(ev)} className="admin-btn admin-btn-ghost admin-btn-sm">
                  Editar
                </button>
              </div>

              <div className="admin-event-toggle">
                <span className="admin-event-toggle-label">Modo:</span>
                <select
                  value={ev.activo_manual || 'auto'}
                  onChange={(e) => cambiarActivoManual(ev, e.target.value)}
                  className="admin-select admin-select-sm"
                >
                  <option value="auto">Auto (por horario)</option>
                  <option value="forzar_activo">Forzar activo</option>
                  <option value="forzar_inactivo">Forzar inactivo</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="admin-modal-overlay" onClick={closeForm}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>{editing ? 'Editar evento' : 'Crear nuevo evento'}</h2>
              <button onClick={closeForm} className="admin-modal-close">×</button>
            </div>

            <form onSubmit={handleSubmit} className="admin-form">
              <div className="admin-form-row">
                <div className="admin-form-field">
                  <label>ID del evento *</label>
                  <input
                    type="text"
                    value={formData.id_evento}
                    onChange={(e) => handleField('id_evento', e.target.value)}
                    placeholder="Ej: ENS-PAES-2026-NOV"
                    className="admin-input"
                    disabled={!!editing}
                    required
                  />
                  <small>Identificador único, sin espacios. No editable después.</small>
                </div>
              </div>

              <div className="admin-form-field">
                <label>Nombre *</label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => handleField('nombre', e.target.value)}
                  placeholder="Ej: Ensayo PAES Matemática M1"
                  className="admin-input"
                  required
                />
              </div>

              <div className="admin-form-field">
                <label>Descripción</label>
                <input
                  type="text"
                  value={formData.descripcion}
                  onChange={(e) => handleField('descripcion', e.target.value)}
                  placeholder="Opcional"
                  className="admin-input"
                />
              </div>

              <div className="admin-form-row">
                <div className="admin-form-field">
                  <label>Fecha *</label>
                  <input
                    type="date"
                    value={formData.fecha}
                    onChange={(e) => handleField('fecha', e.target.value)}
                    className="admin-input"
                    required
                  />
                </div>
              </div>

              <div className="admin-form-divider">Horario del evento (informativo)</div>
              <div className="admin-form-row">
                <div className="admin-form-field">
                  <label>Inicio</label>
                  <input
                    type="time"
                    value={formData.hora_evento_inicio}
                    onChange={(e) => handleField('hora_evento_inicio', e.target.value)}
                    className="admin-input"
                  />
                </div>
                <div className="admin-form-field">
                  <label>Fin</label>
                  <input
                    type="time"
                    value={formData.hora_evento_fin}
                    onChange={(e) => handleField('hora_evento_fin', e.target.value)}
                    className="admin-input"
                  />
                </div>
              </div>

              <div className="admin-form-divider">Ventana de acreditación (cuándo el tótem muestra este evento)</div>
              <div className="admin-form-row">
                <div className="admin-form-field">
                  <label>Desde</label>
                  <input
                    type="time"
                    value={formData.ventana_inicio}
                    onChange={(e) => handleField('ventana_inicio', e.target.value)}
                    className="admin-input"
                  />
                </div>
                <div className="admin-form-field">
                  <label>Hasta</label>
                  <input
                    type="time"
                    value={formData.ventana_fin}
                    onChange={(e) => handleField('ventana_fin', e.target.value)}
                    className="admin-input"
                  />
                </div>
              </div>

              <div className="admin-form-field">
                <label>Modo de activación</label>
                <select
                  value={formData.activo_manual}
                  onChange={(e) => handleField('activo_manual', e.target.value)}
                  className="admin-select"
                >
                  <option value="auto">Auto (según ventana horaria)</option>
                  <option value="forzar_activo">Forzar activo (ignora ventana)</option>
                  <option value="forzar_inactivo">Forzar inactivo</option>
                </select>
              </div>

              {error && <div className="admin-error">{error}</div>}

              <div className="admin-modal-footer">
                <button type="button" onClick={closeForm} className="admin-btn admin-btn-ghost">Cancelar</button>
                <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>
                  {saving ? 'Guardando...' : (editing ? 'Guardar cambios' : 'Crear evento')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function EstadoBadge({ activoManual }) {
  const map = {
    forzar_activo: { label: 'Forzado ON', cls: 'badge-success' },
    forzar_inactivo: { label: 'Forzado OFF', cls: 'badge-error' },
    auto: { label: 'Auto', cls: 'badge-neutral' },
  };
  const s = map[activoManual] || map.auto;
  return <span className={`admin-badge ${s.cls}`}>{s.label}</span>;
}
