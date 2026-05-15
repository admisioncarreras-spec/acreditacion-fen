import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { getToken, clearToken } from '../utils/auth';
import { loadCachedEventos, saveCachedEventos } from '../utils/eventCache';
import '../styles/admin.css';

const POLL = 15000; // 15 segundos

function pickDefaultEvento(eventos) {
  if (!eventos || eventos.length === 0) return '';
  const hoy = new Date().toISOString().slice(0, 10);
  const eventoHoy = eventos.find(e => e.fecha === hoy);
  if (eventoHoy) return eventoHoy.id_evento;
  return eventos[0].id_evento;
}

export default function AdminDashboard() {
  // Init desde cache para arranque instantáneo
  const cachedInicial = loadCachedEventos();
  const [eventos, setEventos] = useState(() => cachedInicial || []);
  const [selectedId, setSelectedId] = useState(() => pickDefaultEvento(cachedInicial));
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(!!cachedInicial);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const navigate = useNavigate();

  // Cargar lista de eventos (en background si ya hay cache)
  useEffect(() => {
    (async () => {
      const cached = loadCachedEventos();
      if (cached) setRefreshing(true);
      const res = await api.listarEventos(getToken());
      setRefreshing(false);
      if (!res.ok) {
        if (res.error?.toLowerCase().includes('autorizado')) {
          clearToken();
          navigate('/admin');
          return;
        }
        return;
      }
      const sorted = (res.eventos || []).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
      setEventos(sorted);
      saveCachedEventos(sorted);
      // Si no había selectedId aún (no había cache), seleccionar default
      if (!selectedId) {
        setSelectedId(pickDefaultEvento(sorted));
      }
    })();
  }, []);

  // Polling de stats del evento seleccionado
  useEffect(() => {
    if (!selectedId) {
      setLoadingStats(false);
      return;
    }
    let mounted = true;
    const fetchStats = async () => {
      const res = await api.estadisticas(selectedId, getToken());
      if (!mounted) return;
      setLoadingStats(false);
      if (res.ok) {
        setStats(res);
        setLastUpdate(new Date());
      }
    };
    setLoadingStats(true);
    setStats(null);
    fetchStats();
    const t = setInterval(fetchStats, POLL);
    return () => { mounted = false; clearInterval(t); };
  }, [selectedId]);

  const horaActual = useMemo(() => {
    if (!lastUpdate) return '';
    return lastUpdate.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }, [lastUpdate]);

  const datosHora = useMemo(() => {
    if (!stats?.por_hora) return [];
    const entries = Object.entries(stats.por_hora).sort((a, b) => a[0].localeCompare(b[0]));
    const max = Math.max(...entries.map(([_, v]) => v), 1);
    return entries.map(([h, v]) => ({ hora: h, cantidad: v, pct: (v / max) * 100 }));
  }, [stats]);

  const datosSala = useMemo(() => {
    if (!stats?.por_sala) return [];
    return Object.entries(stats.por_sala)
      .map(([sala, data]) => ({
        sala,
        ...data,
        pct: data.total > 0 ? Math.round((data.acreditados / data.total) * 100) : 0,
      }))
      .sort((a, b) => b.acreditados - a.acreditados);
  }, [stats]);

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-h1">Dashboard en vivo</h1>
          <p className="admin-h1-sub">
            {lastUpdate ? `Última actualización: ${horaActual} · se actualiza cada 15 seg` : 'Cargando...'}
            {refreshing && <span style={{ color: 'var(--gray-400)', marginLeft: 8, fontSize: 13 }}>· actualizando…</span>}
          </p>
        </div>
        <div className="admin-actions-group">
          <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="admin-select">
            <option value="">— Selecciona un evento —</option>
            {eventos.map(ev => (
              <option key={ev.id_evento} value={ev.id_evento}>
                {ev.fecha} · {ev.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!selectedId ? (
        <div className="admin-empty">
          <p>Selecciona un evento para ver sus estadísticas en vivo.</p>
        </div>
      ) : loadingStats && !stats ? (
        <div className="admin-loading">Cargando estadísticas...</div>
      ) : stats ? (
        <>
          <div className="admin-stats-grid stats-large">
            <StatBig label="Total inscritos" value={stats.total} color="neutral" />
            <StatBig label="Acreditados" value={stats.acreditados} color="success" />
            <StatBig label="Pendientes" value={stats.pendientes} color="warning" />
            <StatBig label="% Asistencia" value={`${stats.porcentaje}%`} color="primary" highlight />
          </div>

          <div className="admin-progress-wrap">
            <div className="admin-progress-bar">
              <div
                className="admin-progress-fill"
                style={{ width: `${stats.porcentaje}%` }}
              />
            </div>
            <div className="admin-progress-label">
              {stats.acreditados} de {stats.total} personas acreditadas
            </div>
          </div>

          <div className="admin-charts-grid">
            <div className="admin-chart-card">
              <h3 className="admin-chart-title">Acreditaciones por hora</h3>
              {datosHora.length === 0 ? (
                <p className="admin-chart-empty">Sin acreditaciones todavía</p>
              ) : (
                <div className="admin-bar-chart">
                  {datosHora.map(d => (
                    <div key={d.hora} className="admin-bar-row">
                      <div className="admin-bar-label">{d.hora}</div>
                      <div className="admin-bar-track">
                        <div className="admin-bar-fill" style={{ width: `${d.pct}%` }}>
                          <span className="admin-bar-value">{d.cantidad}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="admin-chart-card">
              <h3 className="admin-chart-title">Por sala</h3>
              {datosSala.length === 0 ? (
                <p className="admin-chart-empty">Sin datos</p>
              ) : (
                <div className="admin-sala-list">
                  {datosSala.map(d => (
                    <div key={d.sala} className="admin-sala-row">
                      <div className="admin-sala-info">
                        <div className="admin-sala-name">{d.sala}</div>
                        <div className="admin-sala-meta">{d.acreditados} / {d.total}</div>
                      </div>
                      <div className="admin-sala-bar">
                        <div className="admin-sala-bar-fill" style={{ width: `${d.pct}%` }} />
                      </div>
                      <div className="admin-sala-pct">{d.pct}%</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="admin-quick-link">
            <Link to={`/admin/eventos/${encodeURIComponent(selectedId)}`} className="admin-btn admin-btn-ghost">
              Ver lista completa de inscritos →
            </Link>
          </div>
        </>
      ) : (
        <div className="admin-empty"><p>No se pudieron cargar las estadísticas.</p></div>
      )}
    </div>
  );
}

function StatBig({ label, value, color, highlight }) {
  return (
    <div className={`admin-stat-card stat-${color} ${highlight ? 'stat-highlight' : ''}`}>
      <div className="admin-stat-value">{value}</div>
      <div className="admin-stat-label">{label}</div>
    </div>
  );
}
