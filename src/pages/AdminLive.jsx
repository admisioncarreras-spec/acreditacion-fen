import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { getToken, clearToken } from '../utils/auth';
import { loadCachedSalas, saveCachedSalas } from '../utils/eventCache';
import { useSalaLlenaAlert, ToastContainer } from '../components/Toast';
import '../styles/admin.css';

const POLL_MS = 10000; // refresco cada 10 seg en vivo

export default function AdminLive() {
  const navigate = useNavigate();
  const [eventos, setEventos] = useState([]);
  const [eventoSel, setEventoSel] = useState('');
  const [inscritos, setInscritos] = useState([]);
  const [salasMaster, setSalasMaster] = useState(() => loadCachedSalas() || []);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [soundOn, setSoundOn] = useState(true);

  // Cargar eventos al inicio
  useEffect(() => {
    api.listarEventos(getToken()).then(res => {
      if (!res.ok) {
        if (res.error?.toLowerCase().includes('autorizado')) {
          clearToken();
          navigate('/admin');
        }
        return;
      }
      const list = (res.eventos || []).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
      setEventos(list);

      // Pre-seleccionar: forzar_activo > evento de hoy > primer evento
      const hoy = new Date().toISOString().slice(0, 10);
      const activo = list.find(e => e.activo_manual === 'forzar_activo')
                   || list.find(e => e.fecha === hoy && e.activo_manual !== 'forzar_inactivo')
                   || list[0];
      if (activo) setEventoSel(activo.id_evento);
      else setLoading(false);
    });

    // Cargar salas master en paralelo
    api.listarSalas(getToken()).then(res => {
      if (res.ok) {
        const salas = res.salas || [];
        setSalasMaster(salas);
        saveCachedSalas(salas);
      }
    });
  }, []);

  const cargarInscritos = async ({ background = false } = {}) => {
    if (!eventoSel) return;
    if (background) setRefreshing(true);
    else setLoading(true);
    const res = await api.inscritosEvento(eventoSel, getToken());
    setLoading(false);
    setRefreshing(false);
    if (!res.ok) return;
    setInscritos(res.inscritos || []);
    setLastUpdate(new Date());
  };

  useEffect(() => {
    if (!eventoSel) return;
    cargarInscritos();
    const t = setInterval(() => cargarInscritos({ background: true }), POLL_MS);
    return () => clearInterval(t);
  }, [eventoSel]);

  // Cálculo local de capacidades (idéntico a AdminEventoDetail)
  const capacidades = useMemo(() => {
    const inscritosPorSala = {};
    const acreditadosPorSala = {};
    inscritos.forEach(ins => {
      const sala = (ins.sala || '').toString().trim();
      if (sala) {
        inscritosPorSala[sala] = (inscritosPorSala[sala] || 0) + 1;
        if (ins.estado_asistencia === 'acreditado') {
          acreditadosPorSala[sala] = (acreditadosPorSala[sala] || 0) + 1;
        }
      }
    });

    const result = salasMaster.map(s => {
      const capacidad = parseInt(s.capacidad) || 0;
      const inscritosCount = inscritosPorSala[s.nombre_sala] || 0;
      const acreditadosCount = acreditadosPorSala[s.nombre_sala] || 0;
      return {
        nombre_sala: s.nombre_sala,
        capacidad,
        inscritos: inscritosCount,
        acreditados: acreditadosCount,
        disponibles: Math.max(0, capacidad - inscritosCount),
        porcentaje: capacidad > 0 ? Math.round((inscritosCount / capacidad) * 100) : 0,
      };
    });

    const masterNames = new Set(salasMaster.map(s => s.nombre_sala));
    Object.keys(inscritosPorSala).forEach(sala => {
      if (sala && !masterNames.has(sala)) {
        result.push({
          nombre_sala: sala, capacidad: 0,
          inscritos: inscritosPorSala[sala],
          acreditados: acreditadosPorSala[sala] || 0,
          disponibles: 0, porcentaje: 100, sin_capacidad: true,
        });
      }
    });

    return result.sort((a, b) => a.nombre_sala.localeCompare(b.nombre_sala));
  }, [inscritos, salasMaster]);

  // Stats globales
  const stats = useMemo(() => {
    const total = inscritos.length;
    const acreditados = inscritos.filter(i => i.estado_asistencia === 'acreditado').length;
    return {
      total, acreditados, pendientes: total - acreditados,
      porcentaje: total > 0 ? Math.round((acreditados / total) * 100) : 0,
    };
  }, [inscritos]);

  // Hook de alerta sonora cuando se llena una sala
  const { toasts, removeToast } = useSalaLlenaAlert(capacidades, { soundEnabled: soundOn });

  const eventoActual = useMemo(() => eventos.find(e => e.id_evento === eventoSel), [eventos, eventoSel]);

  const horaActualizacion = useMemo(() => {
    if (!lastUpdate) return '';
    return lastUpdate.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }, [lastUpdate]);

  if (loading && !eventoSel) {
    return <div className="admin-loading">Cargando eventos...</div>;
  }

  return (
    <div className="admin-page admin-live-page">
      <div className="admin-live-header">
        <div>
          <h1 className="admin-h1">📡 Monitoreo en Vivo</h1>
          <p className="admin-h1-sub">
            Estado de salas en tiempo real
            {lastUpdate && (
              <span style={{ color: 'var(--gray-400)', marginLeft: 8, fontSize: 13 }}>
                · actualizado a las {horaActualizacion} {refreshing ? '· actualizando…' : '· auto cada 10s'}
              </span>
            )}
          </p>
        </div>
        <div className="admin-live-controls">
          {eventos.length > 0 && (
            <select value={eventoSel} onChange={(e) => setEventoSel(e.target.value)} className="admin-select">
              <option value="">— Selecciona evento —</option>
              {eventos.map(ev => (
                <option key={ev.id_evento} value={ev.id_evento}>
                  {ev.fecha} · {ev.nombre}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() => setSoundOn(!soundOn)}
            className="admin-btn admin-btn-ghost admin-btn-sm"
            title={soundOn ? 'Silenciar alertas' : 'Activar alertas sonoras'}
          >
            {soundOn ? '🔔 Sonido ON' : '🔕 Sonido OFF'}
          </button>
        </div>
      </div>

      {!eventoSel ? (
        <div className="admin-empty">
          <p>Selecciona un evento para ver su estado en vivo.</p>
        </div>
      ) : loading ? (
        <div className="admin-loading">Cargando datos del evento...</div>
      ) : (
        <>
          {eventoActual && (
            <div className="admin-live-event-banner">
              <div className="admin-live-event-name">{eventoActual.nombre}</div>
              <div className="admin-live-event-meta">
                {eventoActual.fecha} · {eventoActual.hora_evento_inicio || '—'} a {eventoActual.hora_evento_fin || '—'}
              </div>
            </div>
          )}

          <div className="admin-stats-grid stats-large">
            <StatCard label="Total inscritos" value={stats.total} color="neutral" />
            <StatCard label="Acreditados" value={stats.acreditados} color="success" />
            <StatCard label="Pendientes" value={stats.pendientes} color="warning" />
            <StatCard label="% Asistencia" value={`${stats.porcentaje}%`} color="highlight" />
          </div>

          {capacidades.length === 0 ? (
            <div className="admin-empty">
              <p>No hay datos de salas para este evento.</p>
            </div>
          ) : (
            <div className="admin-live-grid">
              {capacidades.map(c => {
                const pct = c.porcentaje;
                let estado = 'verde';
                if (c.sin_capacidad) estado = 'gris';
                else if (pct >= 100) estado = 'rojo';
                else if (pct >= 90) estado = 'amarillo-pulse';
                else if (pct >= 75) estado = 'amarillo';
                return (
                  <div key={c.nombre_sala} className={`admin-live-card cap-${estado}`}>
                    <div className="admin-live-card-head">
                      <div className="admin-live-card-title">{c.nombre_sala}</div>
                      {c.sin_capacidad ? <span className="admin-badge badge-warning">Sin capacidad</span>
                        : pct >= 100 ? <span className="admin-badge badge-error">LLENA</span>
                        : pct >= 90 ? <span className="admin-badge badge-warning">Casi llena</span>
                        : pct >= 75 ? <span className="admin-badge badge-warning">75%+</span>
                        : <span className="admin-badge badge-success">Disponible</span>}
                    </div>
                    <div className="admin-live-bar">
                      <div className="admin-live-bar-fill" style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                    <div className="admin-live-pct">{pct}%</div>
                    <div className="admin-capacity-rows">
                      <div className="admin-capacity-row">
                        <span className="admin-capacity-row-label">Capacidad:</span>
                        <strong>{c.capacidad || 'sin definir'}</strong>
                      </div>
                      <div className="admin-capacity-row">
                        <span className="admin-capacity-row-label">Inscritos:</span>
                        <strong>{c.inscritos}</strong>
                      </div>
                      <div className={`admin-capacity-row admin-capacity-row-live ${c.inscritos > 0 && c.acreditados === c.inscritos ? 'row-completo' : ''}`}>
                        <span className="admin-capacity-row-label">Acreditados:</span>
                        <strong>{c.acreditados} {c.inscritos > 0 ? `de ${c.inscritos}` : ''}</strong>
                      </div>
                      {!c.sin_capacidad && (
                        <div className={`admin-capacity-row admin-capacity-row-live ${c.disponibles === 0 ? 'row-llena' : ''}`}>
                          <span className="admin-capacity-row-label">Lista de espera:</span>
                          <strong>{c.disponibles === 0 ? 'SALA LLENA' : c.disponibles}</strong>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div className={`admin-stat-card stat-${color}`}>
      <div className="admin-stat-value">{value}</div>
      <div className="admin-stat-label">{label}</div>
    </div>
  );
}
