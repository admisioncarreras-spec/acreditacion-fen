import { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { getToken, clearToken } from '../utils/auth';
import { parseCSV, downloadCSV } from '../utils/csv';
import { validateRut, formatRutClean } from '../utils/rut';
import '../styles/admin.css';

export default function AdminEventoDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const idEvento = decodeURIComponent(id);
  const [inscritos, setInscritos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [showUpload, setShowUpload] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [uploadResult, setUploadResult] = useState(null);
  const [uploading, setUploading] = useState(false);

  const cargar = async () => {
    setLoading(true);
    const res = await api.inscritosEvento(idEvento, getToken());
    setLoading(false);
    if (!res.ok) {
      if (res.error?.toLowerCase().includes('autorizado')) {
        clearToken();
        navigate('/admin');
        return;
      }
      alert(res.error || 'Error al cargar');
      return;
    }
    setInscritos(res.inscritos || []);
  };

  useEffect(() => { cargar(); }, [idEvento]);

  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim();
    return inscritos.filter(ins => {
      if (filtroEstado === 'acreditados' && ins.estado_asistencia !== 'acreditado') return false;
      if (filtroEstado === 'pendientes' && ins.estado_asistencia === 'acreditado') return false;
      if (!q) return true;
      return (
        (ins.nombre || '').toLowerCase().includes(q) ||
        (ins.rut || '').toLowerCase().includes(q) ||
        (ins.sala || '').toLowerCase().includes(q)
      );
    });
  }, [inscritos, busqueda, filtroEstado]);

  const stats = useMemo(() => {
    const total = inscritos.length;
    const acreditados = inscritos.filter(i => i.estado_asistencia === 'acreditado').length;
    return {
      total,
      acreditados,
      pendientes: total - acreditados,
      porcentaje: total > 0 ? Math.round((acreditados / total) * 100) : 0,
    };
  }, [inscritos]);

  const toggleAsistencia = async (ins) => {
    if (ins.estado_asistencia === 'acreditado') {
      if (!confirm(`¿Desmarcar la asistencia de ${ins.nombre}?`)) return;
      const res = await api.desmarcarAsistencia(ins.rut, idEvento, getToken());
      if (res.ok) cargar();
      else alert(res.error || 'Error');
    } else {
      const res = await api.marcarAsistenciaManual(ins.rut, idEvento, getToken());
      if (res.ok) cargar();
      else alert(res.error || 'Error');
    }
  };

  const procesarCSV = async () => {
    if (!csvText.trim()) {
      alert('Pega los datos CSV primero');
      return;
    }
    const rows = parseCSV(csvText);
    if (rows.length === 0) {
      alert('No se detectaron filas en el CSV');
      return;
    }
    // Validar mínimos
    const sample = rows[0];
    if (!('rut' in sample) || !('nombre' in sample)) {
      alert('El CSV debe tener al menos las columnas "rut" y "nombre" (en minúsculas, primera fila como headers)');
      return;
    }

    // Validación local de RUTs (preview)
    const conValidacion = rows.map(r => ({
      ...r,
      _validacion: validateRut(r.rut || ''),
    }));
    const validos = conValidacion.filter(r => r._validacion.valid);
    const invalidos = conValidacion.filter(r => !r._validacion.valid);

    if (invalidos.length > 0 && !confirm(
      `Hay ${invalidos.length} RUT(s) inválidos que serán omitidos. ¿Cargar los ${validos.length} válidos?`
    )) return;

    setUploading(true);
    const payload = validos.map(r => ({
      rut: r.rut,
      nombre: r.nombre,
      sala: r.sala || '',
      correo: r.correo || r.email || '',
      telefono: r.telefono || r.celular || '',
    }));

    const res = await api.cargarInscritos(idEvento, payload, getToken());
    setUploading(false);
    if (!res.ok) {
      alert(res.error || 'Error al cargar');
      return;
    }
    setUploadResult({
      ...res.stats,
      invalidos_local: invalidos.length,
      ejemplos_invalidos: invalidos.slice(0, 5).map(r => ({ rut: r.rut, nombre: r.nombre, error: r._validacion.reason })),
    });
    setCsvText('');
    cargar();
  };

  const exportar = () => {
    const rows = inscritos.map(ins => ({
      RUT: ins.rut,
      Nombre: ins.nombre,
      Sala: ins.sala,
      Estado: ins.estado_asistencia,
      'Hora acreditación': ins.hora_acreditacion || '',
      Correo: ins.correo || '',
      Teléfono: ins.telefono || '',
    }));
    const fecha = new Date().toISOString().slice(0, 10);
    downloadCSV(rows, `acreditacion_${idEvento}_${fecha}.csv`);
  };

  return (
    <div className="admin-page">
      <Link to="/admin/eventos" className="admin-back-link">← Volver a eventos</Link>

      <div className="admin-page-header">
        <div>
          <h1 className="admin-h1">{idEvento}</h1>
          <p className="admin-h1-sub">Gestión de inscritos y asistencia</p>
        </div>
        <div className="admin-actions-group">
          <button onClick={() => setShowUpload(true)} className="admin-btn admin-btn-primary">
            📥 Cargar inscritos (CSV)
          </button>
          <button onClick={exportar} className="admin-btn admin-btn-ghost" disabled={inscritos.length === 0}>
            📤 Exportar
          </button>
        </div>
      </div>

      <div className="admin-stats-grid">
        <StatCard label="Total inscritos" value={stats.total} color="neutral" />
        <StatCard label="Acreditados" value={stats.acreditados} color="success" />
        <StatCard label="Pendientes" value={stats.pendientes} color="warning" />
        <StatCard label="% Asistencia" value={`${stats.porcentaje}%`} color="primary" />
      </div>

      <div className="admin-toolbar">
        <input
          type="text"
          placeholder="Buscar por nombre, RUT o sala..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="admin-input admin-input-search"
        />
        <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className="admin-select">
          <option value="todos">Todos ({inscritos.length})</option>
          <option value="acreditados">Acreditados ({stats.acreditados})</option>
          <option value="pendientes">Pendientes ({stats.pendientes})</option>
        </select>
      </div>

      {loading ? (
        <div className="admin-loading">Cargando inscritos...</div>
      ) : filtrados.length === 0 ? (
        <div className="admin-empty">
          {inscritos.length === 0 ? (
            <>
              <p>No hay inscritos cargados para este evento.</p>
              <button onClick={() => setShowUpload(true)} className="admin-btn admin-btn-primary">
                Cargar el primer batch
              </button>
            </>
          ) : (
            <p>No hay resultados para "{busqueda}".</p>
          )}
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Estado</th>
                <th>RUT</th>
                <th>Nombre</th>
                <th>Sala</th>
                <th>Hora</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((ins, idx) => (
                <tr key={ins.rut + idx} className={ins.estado_asistencia === 'acreditado' ? 'row-acreditado' : ''}>
                  <td>
                    {ins.estado_asistencia === 'acreditado' ? (
                      <span className="admin-badge badge-success">✓ Acreditado</span>
                    ) : (
                      <span className="admin-badge badge-neutral">Pendiente</span>
                    )}
                  </td>
                  <td className="mono">{ins.rut}</td>
                  <td>{ins.nombre}</td>
                  <td>{ins.sala || '—'}</td>
                  <td className="mono">{ins.hora_acreditacion || '—'}</td>
                  <td>
                    <button
                      onClick={() => toggleAsistencia(ins)}
                      className={`admin-btn admin-btn-sm ${ins.estado_asistencia === 'acreditado' ? 'admin-btn-ghost' : 'admin-btn-primary'}`}
                    >
                      {ins.estado_asistencia === 'acreditado' ? 'Desmarcar' : 'Marcar asistencia'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="admin-table-footer">
            Mostrando {filtrados.length} de {inscritos.length}
          </div>
        </div>
      )}

      {showUpload && (
        <div className="admin-modal-overlay" onClick={() => !uploading && setShowUpload(false)}>
          <div className="admin-modal admin-modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>Cargar inscritos al evento</h2>
              <button onClick={() => !uploading && setShowUpload(false)} className="admin-modal-close">×</button>
            </div>

            <div className="admin-upload-help">
              <p><strong>Cómo usar</strong>: copia las columnas desde Excel/Salesforce y pégalas aquí. La primera fila debe ser los encabezados.</p>
              <p><strong>Columnas requeridas</strong>: <code>rut</code>, <code>nombre</code>. <strong>Opcionales</strong>: <code>sala</code>, <code>correo</code>, <code>telefono</code>.</p>
              <p>Si un RUT ya existe en este evento, se actualizan sus datos personales pero <strong>se conserva su estado de asistencia</strong>.</p>
            </div>

            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={'rut\tnombre\tsala\tcorreo\ttelefono\n12345678-9\tJuan Pérez\tH-101\tjuan@email.cl\t912345678\n...'}
              className="admin-textarea"
              rows={12}
              disabled={uploading}
            />

            {uploadResult && (
              <div className="admin-upload-result">
                <h3>Resultado de la carga</h3>
                <ul>
                  <li>✅ <strong>{uploadResult.agregados}</strong> nuevos agregados</li>
                  <li>🔄 <strong>{uploadResult.actualizados}</strong> actualizados</li>
                  {uploadResult.invalidos_local > 0 && (
                    <li>⚠️ <strong>{uploadResult.invalidos_local}</strong> con RUT inválido (omitidos)</li>
                  )}
                  {uploadResult.rut_invalidos && uploadResult.rut_invalidos.length > 0 && (
                    <li>⚠️ <strong>{uploadResult.rut_invalidos.length}</strong> rechazados por el servidor</li>
                  )}
                </ul>
                {uploadResult.ejemplos_invalidos && uploadResult.ejemplos_invalidos.length > 0 && (
                  <details>
                    <summary>Ver ejemplos de RUTs inválidos</summary>
                    <ul className="admin-invalid-list">
                      {uploadResult.ejemplos_invalidos.map((e, i) => (
                        <li key={i}>{e.rut} ({e.nombre}) — {e.error}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}

            <div className="admin-modal-footer">
              <button onClick={() => setShowUpload(false)} className="admin-btn admin-btn-ghost" disabled={uploading}>
                Cerrar
              </button>
              <button onClick={procesarCSV} className="admin-btn admin-btn-primary" disabled={uploading || !csvText.trim()}>
                {uploading ? 'Procesando...' : 'Procesar y cargar'}
              </button>
            </div>
          </div>
        </div>
      )}
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
