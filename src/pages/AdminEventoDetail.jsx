import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { getToken, clearToken } from '../utils/auth';
import { parseCSV, downloadCSV } from '../utils/csv';
import { validateRut, formatRutInput, formatRutClean, normalizeRut } from '../utils/rut';
import { loadCachedSalas, saveCachedSalas } from '../utils/eventCache';
import '../styles/admin.css';

const POLL_MS = 15000;

const EMPTY_WALKIN = {
  rut: '', nombre: '', sala: '', correo: '', telefono: '', acreditar: true,
};

const EMPTY_EDIT = { nombre: '', sala: '', correo: '', telefono: '' };

export default function AdminEventoDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const idEvento = decodeURIComponent(id);

  const [inscritos, setInscritos] = useState([]);
  const [salasMaster, setSalasMaster] = useState(() => loadCachedSalas() || []);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [showUpload, setShowUpload] = useState(false);
  const [showWalkIn, setShowWalkIn] = useState(false);
  const [showCapacidades, setShowCapacidades] = useState(true);
  const [showEditInscrito, setShowEditInscrito] = useState(null); // ins object
  const [csvText, setCsvText] = useState('');
  const [uploadResult, setUploadResult] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [walkInData, setWalkInData] = useState(EMPTY_WALKIN);
  const [walkInError, setWalkInError] = useState('');
  const [walkInSaving, setWalkInSaving] = useState(false);
  const [editData, setEditData] = useState(EMPTY_EDIT);
  const [editSaving, setEditSaving] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  const modalAbiertoRef = useRef(false);
  useEffect(() => {
    modalAbiertoRef.current = showUpload || showWalkIn || !!showEditInscrito;
  }, [showUpload, showWalkIn, showEditInscrito]);

  const cargarInscritos = async ({ background = false } = {}) => {
    if (background) setRefreshing(true);
    else setLoading(true);
    const res = await api.inscritosEvento(idEvento, getToken());
    setLoading(false);
    setRefreshing(false);
    if (!res.ok) {
      if (res.error?.toLowerCase().includes('autorizado')) {
        clearToken();
        navigate('/admin');
        return;
      }
      if (!background) alert(res.error || 'Error al cargar');
      return;
    }
    setInscritos(res.inscritos || []);
    setLastUpdate(new Date());
  };

  const cargarSalasMaster = async () => {
    const res = await api.listarSalas(getToken());
    if (res.ok) {
      const salas = res.salas || [];
      setSalasMaster(salas);
      saveCachedSalas(salas);
    }
  };

  useEffect(() => {
    let mounted = true;
    cargarInscritos();
    cargarSalasMaster();
    const t = setInterval(() => {
      if (!mounted) return;
      if (modalAbiertoRef.current) return;
      cargarInscritos({ background: true });
    }, POLL_MS);
    return () => { mounted = false; clearInterval(t); };
  }, [idEvento]);

  // === CALCULO LOCAL DE CAPACIDADES (instantáneo) ===
  const capacidades = useMemo(() => {
    const asignaciones = {};
    inscritos.forEach(ins => {
      const sala = (ins.sala || '').toString().trim();
      if (sala) asignaciones[sala] = (asignaciones[sala] || 0) + 1;
    });

    const result = salasMaster.map(s => {
      const capacidad = parseInt(s.capacidad) || 0;
      const asignados = asignaciones[s.nombre_sala] || 0;
      return {
        nombre_sala: s.nombre_sala,
        capacidad,
        asignados,
        disponibles: Math.max(0, capacidad - asignados),
        porcentaje: capacidad > 0 ? Math.round((asignados / capacidad) * 100) : 0,
      };
    });

    const masterNames = new Set(salasMaster.map(s => s.nombre_sala));
    Object.keys(asignaciones).forEach(sala => {
      if (sala && !masterNames.has(sala)) {
        result.push({
          nombre_sala: sala, capacidad: 0,
          asignados: asignaciones[sala], disponibles: 0,
          porcentaje: 100, sin_capacidad: true,
        });
      }
    });

    return result.sort((a, b) => a.nombre_sala.localeCompare(b.nombre_sala));
  }, [inscritos, salasMaster]);

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
      total, acreditados, pendientes: total - acreditados,
      porcentaje: total > 0 ? Math.round((acreditados / total) * 100) : 0,
    };
  }, [inscritos]);

  const resumenCapacidad = useMemo(() => {
    const totalCap = capacidades.reduce((s, c) => s + (c.capacidad || 0), 0);
    const totalAsig = capacidades.reduce((s, c) => s + (c.asignados || 0), 0);
    const salasLlenas = capacidades.filter(c => c.capacidad > 0 && c.disponibles === 0).length;
    const salasCasiLlenas = capacidades.filter(c => c.capacidad > 0 && c.porcentaje >= 90 && c.disponibles > 0).length;
    return {
      totalCap, totalAsig,
      totalDisp: Math.max(0, totalCap - totalAsig),
      salasLlenas, salasCasiLlenas,
      sinCapacidad: totalCap === 0,
    };
  }, [capacidades]);

  // === OPTIMISTIC: toggle asistencia ===
  const toggleAsistencia = async (ins) => {
    const yaAcreditado = ins.estado_asistencia === 'acreditado';
    if (yaAcreditado && !confirm(`¿Desmarcar la asistencia de ${ins.nombre}?`)) return;

    const horaAhora = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
    const backup = inscritos;
    setInscritos(prev => prev.map(i =>
      normalizeRut(i.rut) === normalizeRut(ins.rut) && i.id_evento === ins.id_evento
        ? { ...i, estado_asistencia: yaAcreditado ? 'pendiente' : 'acreditado', hora_acreditacion: yaAcreditado ? '' : horaAhora }
        : i
    ));

    const res = yaAcreditado
      ? await api.desmarcarAsistencia(ins.rut, idEvento, getToken())
      : await api.marcarAsistenciaManual(ins.rut, idEvento, getToken());
    if (!res.ok) {
      setInscritos(backup);
      alert(res.error || 'Error');
    }
  };

  // === CSV upload ===
  const procesarCSV = async () => {
    if (!csvText.trim()) { alert('Pega los datos CSV primero'); return; }
    const rows = parseCSV(csvText);
    if (rows.length === 0) { alert('No se detectaron filas en el CSV'); return; }
    const sample = rows[0];
    if (!('rut' in sample) || !('nombre' in sample)) {
      alert('El CSV debe tener al menos las columnas "rut" y "nombre" (en minúsculas)');
      return;
    }
    const conValidacion = rows.map(r => ({ ...r, _validacion: validateRut(r.rut || '') }));
    const validos = conValidacion.filter(r => r._validacion.valid);
    const invalidos = conValidacion.filter(r => !r._validacion.valid);
    if (invalidos.length > 0 && !confirm(`Hay ${invalidos.length} RUT(s) inválidos que serán omitidos. ¿Cargar los ${validos.length} válidos?`)) return;

    setUploading(true);
    const payload = validos.map(r => ({
      rut: r.rut, nombre: r.nombre, sala: r.sala || '',
      correo: r.correo || r.email || '', telefono: r.telefono || r.celular || '',
    }));
    const res = await api.cargarInscritos(idEvento, payload, getToken());
    setUploading(false);
    if (!res.ok) { alert(res.error || 'Error al cargar'); return; }
    setUploadResult({
      ...res.stats,
      invalidos_local: invalidos.length,
      ejemplos_invalidos: invalidos.slice(0, 5).map(r => ({ rut: r.rut, nombre: r.nombre, error: r._validacion.reason })),
    });
    setCsvText('');
    cargarInscritos();
  };

  // === Walk-in (con optimistic) ===
  const handleWalkInField = (field, value) => {
    let val = value;
    if (field === 'rut') val = formatRutInput(value);
    setWalkInData(prev => ({ ...prev, [field]: val }));
  };

  const openWalkIn = () => {
    setWalkInData(EMPTY_WALKIN);
    setWalkInError('');
    setShowWalkIn(true);
  };

  const submitWalkIn = async (e) => {
    e.preventDefault();
    setWalkInError('');
    if (!walkInData.rut || !walkInData.nombre) {
      setWalkInError('RUT y Nombre son obligatorios'); return;
    }
    const v = validateRut(walkInData.rut);
    if (!v.valid) {
      if (v.reason === 'dv') setWalkInError(`RUT inválido. ¿Será ${formatRutClean(v.suggestion)}?`);
      else setWalkInError('El RUT ingresado no es válido');
      return;
    }
    if (walkInData.sala) {
      const cap = capacidades.find(c => c.nombre_sala === walkInData.sala);
      if (cap && cap.capacidad > 0 && cap.disponibles <= 0) {
        setWalkInError(`La sala "${walkInData.sala}" está LLENA (${cap.asignados}/${cap.capacidad}). Elige otra sala.`);
        return;
      }
    }

    const rutFmt = formatRutClean(v.clean);
    const horaAhora = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
    const nuevo = {
      rut: rutFmt, nombre: walkInData.nombre, sala: walkInData.sala,
      correo: walkInData.correo, telefono: walkInData.telefono,
      id_evento: idEvento,
      estado_asistencia: walkInData.acreditar ? 'acreditado' : 'pendiente',
      hora_acreditacion: walkInData.acreditar ? horaAhora : '',
    };

    // Optimistic upsert
    const backup = inscritos;
    setInscritos(prev => {
      const idx = prev.findIndex(i => normalizeRut(i.rut) === v.clean && i.id_evento === idEvento);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], ...nuevo };
        return updated;
      }
      return [...prev, nuevo];
    });
    setShowWalkIn(false);
    setWalkInSaving(true);

    const res = await api.cargarInscritos(idEvento, [{
      rut: walkInData.rut, nombre: walkInData.nombre, sala: walkInData.sala,
      correo: walkInData.correo, telefono: walkInData.telefono,
    }], getToken());
    if (!res.ok) {
      setInscritos(backup);
      setShowWalkIn(true);
      setWalkInError(res.error || 'Error al agregar');
      setWalkInSaving(false);
      return;
    }
    if (walkInData.acreditar) {
      await api.marcarAsistenciaManual(walkInData.rut, idEvento, getToken());
    }
    setWalkInSaving(false);
    cargarInscritos({ background: true });
  };

  // === Editar inscrito ===
  const openEditInscrito = (ins) => {
    setEditData({
      nombre: ins.nombre || '',
      sala: ins.sala || '',
      correo: ins.correo || '',
      telefono: ins.telefono || '',
    });
    setShowEditInscrito(ins);
  };

  const submitEditInscrito = async (e) => {
    e.preventDefault();
    if (!editData.nombre.trim()) {
      alert('El nombre es obligatorio');
      return;
    }
    setEditSaving(true);
    const original = showEditInscrito;
    const backup = inscritos;
    // Optimistic
    setInscritos(prev => prev.map(i =>
      normalizeRut(i.rut) === normalizeRut(original.rut) && i.id_evento === original.id_evento
        ? { ...i, ...editData }
        : i
    ));
    setShowEditInscrito(null);

    const res = await api.editarInscrito(original.rut, idEvento, editData, getToken());
    setEditSaving(false);
    if (!res.ok) {
      setInscritos(backup);
      alert(res.error || 'Error al editar');
    }
  };

  // === Eliminar inscrito ===
  const eliminarInscrito = async (ins) => {
    if (!confirm(`¿Eliminar a ${ins.nombre} (${ins.rut}) de este evento?\n\nSe borrará del Sheet. Esta acción no se puede deshacer.`)) return;
    const backup = inscritos;
    setInscritos(prev => prev.filter(i =>
      !(normalizeRut(i.rut) === normalizeRut(ins.rut) && i.id_evento === ins.id_evento)
    ));
    const res = await api.eliminarInscrito(ins.rut, idEvento, getToken());
    if (!res.ok) {
      setInscritos(backup);
      alert(res.error || 'Error al eliminar');
    }
  };

  // === Reset asistencias del evento ===
  const resetAsistencias = async () => {
    const msg1 = `¿RESETEAR todas las asistencias de este evento?\n\n` +
                 `Esto deja a TODOS los inscritos como "pendiente" y borra las horas de acreditación.\n` +
                 `Los inscritos NO se eliminan, solo se resetea su estado de asistencia.\n\n` +
                 `Útil para reutilizar un evento de prueba. NO usar en producción durante un evento real.`;
    if (!confirm(msg1)) return;
    if (!confirm(`Confirmación final: ¿RESETEAR ${stats.acreditados} asistencia(s) marcadas?`)) return;

    const res = await api.resetAsistencias(idEvento, getToken());
    if (res.ok) {
      alert(`✓ ${res.count} asistencias reseteadas`);
      cargarInscritos();
    } else {
      alert(res.error || 'Error');
    }
  };

  const exportar = () => {
    const rows = inscritos.map(ins => ({
      RUT: ins.rut, Nombre: ins.nombre, Sala: ins.sala,
      Estado: ins.estado_asistencia, 'Hora acreditación': ins.hora_acreditacion || '',
      Correo: ins.correo || '', Teléfono: ins.telefono || '',
    }));
    const fecha = new Date().toISOString().slice(0, 10);
    downloadCSV(rows, `acreditacion_${idEvento}_${fecha}.csv`);
  };

  const horaActual = useMemo(() => {
    if (!lastUpdate) return '';
    return lastUpdate.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }, [lastUpdate]);

  const salasDropdown = useMemo(() => {
    return [...capacidades].sort((a, b) => {
      const aLlena = a.capacidad > 0 && a.disponibles === 0;
      const bLlena = b.capacidad > 0 && b.disponibles === 0;
      if (aLlena !== bLlena) return aLlena ? 1 : -1;
      return a.nombre_sala.localeCompare(b.nombre_sala);
    });
  }, [capacidades]);

  return (
    <div className="admin-page">
      <Link to="/admin/eventos" className="admin-back-link">← Volver a eventos</Link>

      <div className="admin-page-header">
        <div>
          <h1 className="admin-h1">{idEvento}</h1>
          <p className="admin-h1-sub">
            Gestión de inscritos y asistencia
            {lastUpdate && <span style={{ color: 'var(--gray-400)', marginLeft: 8, fontSize: 13 }}>
              · actualizado a las {horaActual} {refreshing ? '· actualizando…' : '· auto cada 15s'}
            </span>}
          </p>
        </div>
        <div className="admin-actions-group">
          <button onClick={openWalkIn} className="admin-btn admin-btn-primary">➕ Agregar walk-in</button>
          <button onClick={() => setShowUpload(true)} className="admin-btn admin-btn-ghost">📥 Cargar CSV</button>
          <button onClick={exportar} className="admin-btn admin-btn-ghost" disabled={inscritos.length === 0}>📤 Exportar</button>
          <button onClick={resetAsistencias} className="admin-btn admin-btn-ghost admin-btn-sm" disabled={stats.acreditados === 0}
            title="Resetear todas las asistencias">↻ Reset</button>
        </div>
      </div>

      <div className="admin-stats-grid">
        <StatCard label="Total inscritos" value={stats.total} color="neutral" />
        <StatCard label="Acreditados" value={stats.acreditados} color="success" />
        <StatCard label="Pendientes" value={stats.pendientes} color="warning" />
        <StatCard label="% Asistencia" value={`${stats.porcentaje}%`} color="primary" />
      </div>

      {capacidades.length > 0 && (
        <div className="admin-capacity-panel">
          <div className="admin-capacity-header" onClick={() => setShowCapacidades(!showCapacidades)}>
            <h3>
              Capacidad de salas
              <span className="admin-capacity-summary">
                {' '}· {resumenCapacidad.sinCapacidad
                  ? `${resumenCapacidad.totalAsig} asignados (sin capacidad definida)`
                  : `${resumenCapacidad.totalAsig}/${resumenCapacidad.totalCap} asignados`}
                {resumenCapacidad.salasLlenas > 0 && (
                  <span className="admin-capacity-warn"> · {resumenCapacidad.salasLlenas} sala(s) llena(s)</span>
                )}
                {resumenCapacidad.salasCasiLlenas > 0 && (
                  <span className="admin-capacity-warn-soft"> · {resumenCapacidad.salasCasiLlenas} casi llena(s)</span>
                )}
              </span>
            </h3>
            <button className="admin-capacity-toggle">{showCapacidades ? '−' : '+'}</button>
          </div>
          {showCapacidades && (
            <div className="admin-capacity-grid">
              {capacidades.map(c => {
                const pct = c.porcentaje;
                let estado = 'verde';
                if (c.sin_capacidad) estado = 'gris';
                else if (pct >= 100) estado = 'rojo';
                else if (pct >= 90) estado = 'amarillo-pulse';
                else if (pct >= 75) estado = 'amarillo';
                return (
                  <div key={c.nombre_sala} className={`admin-capacity-card cap-${estado}`}>
                    <div className="admin-capacity-card-head">
                      <div className="admin-capacity-name">{c.nombre_sala}</div>
                      {c.sin_capacidad ? <span className="admin-badge badge-warning">Sin capacidad</span>
                        : pct >= 100 ? <span className="admin-badge badge-error">LLENA</span>
                        : pct >= 90 ? <span className="admin-badge badge-warning">Casi llena</span>
                        : pct >= 75 ? <span className="admin-badge badge-warning">75%+</span>
                        : <span className="admin-badge badge-success">Disponible</span>}
                    </div>
                    <div className="admin-capacity-bar">
                      <div className="admin-capacity-bar-fill" style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                    <div className="admin-capacity-numbers">
                      <span className="admin-capacity-asig">{c.asignados}</span>
                      <span className="admin-capacity-sep">/</span>
                      <span className="admin-capacity-cap">{c.capacidad || '?'}</span>
                      {!c.sin_capacidad && (
                        <span className="admin-capacity-disp">
                          {c.disponibles > 0 ? `· ${c.disponibles} libres` : '· LLENA'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="admin-toolbar">
        <input type="text" placeholder="Buscar por nombre, RUT o sala..."
          value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
          className="admin-input admin-input-search" />
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
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                <button onClick={() => setShowUpload(true)} className="admin-btn admin-btn-primary">Cargar por CSV</button>
                <button onClick={openWalkIn} className="admin-btn admin-btn-ghost">Agregar uno manualmente</button>
              </div>
            </>
          ) : <p>No hay resultados para "{busqueda}".</p>}
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Estado</th><th>RUT</th><th>Nombre</th><th>Sala</th><th>Hora</th><th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((ins, idx) => (
                <tr key={ins.rut + idx} className={ins.estado_asistencia === 'acreditado' ? 'row-acreditado' : ''}>
                  <td>
                    {ins.estado_asistencia === 'acreditado'
                      ? <span className="admin-badge badge-success">✓ Acreditado</span>
                      : <span className="admin-badge badge-neutral">Pendiente</span>}
                  </td>
                  <td className="mono">{ins.rut}</td>
                  <td>{ins.nombre}</td>
                  <td>{ins.sala || '—'}</td>
                  <td className="mono">{ins.hora_acreditacion || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => toggleAsistencia(ins)}
                        className={`admin-btn admin-btn-sm ${ins.estado_asistencia === 'acreditado' ? 'admin-btn-ghost' : 'admin-btn-primary'}`}>
                        {ins.estado_asistencia === 'acreditado' ? 'Desmarcar' : '✓ Marcar'}
                      </button>
                      <button onClick={() => openEditInscrito(ins)} className="admin-btn admin-btn-sm admin-btn-ghost" title="Editar datos">✎</button>
                      <button onClick={() => eliminarInscrito(ins)} className="admin-btn admin-btn-sm admin-btn-danger" title="Eliminar del evento">🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="admin-table-footer">Mostrando {filtrados.length} de {inscritos.length}</div>
        </div>
      )}

      {/* === MODAL CARGA CSV === */}
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
            <textarea value={csvText} onChange={(e) => setCsvText(e.target.value)}
              placeholder={'rut\tnombre\tsala\tcorreo\ttelefono\n12345678-9\tJuan Pérez\tH-101\tjuan@email.cl\t912345678\n...'}
              className="admin-textarea" rows={12} disabled={uploading} />
            {uploadResult && (
              <div className="admin-upload-result">
                <h3>Resultado de la carga</h3>
                <ul>
                  <li>✅ <strong>{uploadResult.agregados}</strong> nuevos agregados</li>
                  <li>🔄 <strong>{uploadResult.actualizados}</strong> actualizados</li>
                  {uploadResult.invalidos_local > 0 && <li>⚠️ <strong>{uploadResult.invalidos_local}</strong> con RUT inválido (omitidos)</li>}
                </ul>
                {uploadResult.ejemplos_invalidos && uploadResult.ejemplos_invalidos.length > 0 && (
                  <details>
                    <summary>Ver ejemplos de RUTs inválidos</summary>
                    <ul className="admin-invalid-list">
                      {uploadResult.ejemplos_invalidos.map((e, i) => <li key={i}>{e.rut} ({e.nombre}) — {e.error}</li>)}
                    </ul>
                  </details>
                )}
              </div>
            )}
            <div className="admin-modal-footer">
              <button onClick={() => setShowUpload(false)} className="admin-btn admin-btn-ghost" disabled={uploading}>Cerrar</button>
              <button onClick={procesarCSV} className="admin-btn admin-btn-primary" disabled={uploading || !csvText.trim()}>
                {uploading ? 'Procesando...' : 'Procesar y cargar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === MODAL WALK-IN === */}
      {showWalkIn && (
        <div className="admin-modal-overlay" onClick={() => !walkInSaving && setShowWalkIn(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>Agregar walk-in</h2>
              <button onClick={() => !walkInSaving && setShowWalkIn(false)} className="admin-modal-close">×</button>
            </div>
            <form onSubmit={submitWalkIn} className="admin-form">
              <div className="admin-form-field">
                <label>RUT *</label>
                <input type="text" value={walkInData.rut} onChange={(e) => handleWalkInField('rut', e.target.value)}
                  placeholder="12.345.678-9" className="admin-input" autoFocus required />
              </div>
              <div className="admin-form-field">
                <label>Nombre completo *</label>
                <input type="text" value={walkInData.nombre} onChange={(e) => handleWalkInField('nombre', e.target.value)}
                  placeholder="Ej: Juan Pérez González" className="admin-input" required />
              </div>
              <div className="admin-form-field">
                <label>Sala</label>
                {salasDropdown.length > 0 ? (
                  <select value={walkInData.sala} onChange={(e) => handleWalkInField('sala', e.target.value)} className="admin-select">
                    <option value="">— Sin sala asignada —</option>
                    {salasDropdown.map(c => {
                      const llena = c.capacidad > 0 && c.disponibles === 0;
                      const label = c.sin_capacidad
                        ? `${c.nombre_sala} (sin capacidad definida)`
                        : llena
                          ? `🔴 ${c.nombre_sala} — LLENA (${c.asignados}/${c.capacidad})`
                          : `${c.nombre_sala} — ${c.disponibles} disponibles (de ${c.capacidad})`;
                      return <option key={c.nombre_sala} value={c.nombre_sala} disabled={llena}>{label}</option>;
                    })}
                  </select>
                ) : (
                  <input type="text" value={walkInData.sala} onChange={(e) => handleWalkInField('sala', e.target.value)}
                    placeholder="Define salas en /admin/salas para ver capacidad" className="admin-input" />
                )}
                {salasDropdown.length > 0 && walkInData.sala && (() => {
                  const sel = capacidades.find(c => c.nombre_sala === walkInData.sala);
                  if (sel && !sel.sin_capacidad) {
                    return <small style={{ color: 'var(--success)' }}>✓ Después de agregar: {sel.asignados + 1}/{sel.capacidad} ({sel.disponibles - 1} disponibles)</small>;
                  }
                  return null;
                })()}
              </div>
              <div className="admin-form-row">
                <div className="admin-form-field">
                  <label>Teléfono</label>
                  <input type="text" value={walkInData.telefono} onChange={(e) => handleWalkInField('telefono', e.target.value)}
                    placeholder="9XXXXXXXX" className="admin-input" />
                </div>
                <div className="admin-form-field">
                  <label>Correo</label>
                  <input type="email" value={walkInData.correo} onChange={(e) => handleWalkInField('correo', e.target.value)}
                    placeholder="opcional" className="admin-input" />
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--gray-700)', fontWeight: 500, cursor: 'pointer' }}>
                <input type="checkbox" checked={walkInData.acreditar} onChange={(e) => handleWalkInField('acreditar', e.target.checked)}
                  style={{ width: 18, height: 18, cursor: 'pointer' }} />
                Marcar como acreditado inmediatamente (ya está presente)
              </label>
              {walkInError && <div className="admin-error">{walkInError}</div>}
              <div className="admin-modal-footer">
                <button type="button" onClick={() => setShowWalkIn(false)} className="admin-btn admin-btn-ghost" disabled={walkInSaving}>Cancelar</button>
                <button type="submit" className="admin-btn admin-btn-primary" disabled={walkInSaving}>
                  {walkInSaving ? 'Guardando...' : (walkInData.acreditar ? 'Agregar y acreditar' : 'Agregar a la lista')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* === MODAL EDITAR INSCRITO === */}
      {showEditInscrito && (
        <div className="admin-modal-overlay" onClick={() => !editSaving && setShowEditInscrito(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>Editar inscrito</h2>
              <button onClick={() => !editSaving && setShowEditInscrito(null)} className="admin-modal-close">×</button>
            </div>
            <form onSubmit={submitEditInscrito} className="admin-form">
              <div className="admin-form-field">
                <label>RUT (no editable)</label>
                <input type="text" value={showEditInscrito.rut} className="admin-input" disabled />
              </div>
              <div className="admin-form-field">
                <label>Nombre completo *</label>
                <input type="text" value={editData.nombre}
                  onChange={(e) => setEditData(prev => ({ ...prev, nombre: e.target.value }))}
                  className="admin-input" required autoFocus />
              </div>
              <div className="admin-form-field">
                <label>Sala</label>
                {salasDropdown.length > 0 ? (
                  <select value={editData.sala} onChange={(e) => setEditData(prev => ({ ...prev, sala: e.target.value }))} className="admin-select">
                    <option value="">— Sin sala asignada —</option>
                    {salasDropdown.map(c => {
                      const esActual = c.nombre_sala === showEditInscrito.sala;
                      const llena = !esActual && c.capacidad > 0 && c.disponibles === 0;
                      const label = c.sin_capacidad
                        ? `${c.nombre_sala} (sin capacidad)`
                        : llena ? `🔴 ${c.nombre_sala} — LLENA`
                        : `${c.nombre_sala} — ${c.disponibles}/${c.capacidad} libres`;
                      return <option key={c.nombre_sala} value={c.nombre_sala} disabled={llena}>{label}</option>;
                    })}
                  </select>
                ) : (
                  <input type="text" value={editData.sala} onChange={(e) => setEditData(prev => ({ ...prev, sala: e.target.value }))} className="admin-input" />
                )}
              </div>
              <div className="admin-form-row">
                <div className="admin-form-field">
                  <label>Teléfono</label>
                  <input type="text" value={editData.telefono} onChange={(e) => setEditData(prev => ({ ...prev, telefono: e.target.value }))} className="admin-input" />
                </div>
                <div className="admin-form-field">
                  <label>Correo</label>
                  <input type="email" value={editData.correo} onChange={(e) => setEditData(prev => ({ ...prev, correo: e.target.value }))} className="admin-input" />
                </div>
              </div>
              <div className="admin-modal-footer">
                <button type="button" onClick={() => setShowEditInscrito(null)} className="admin-btn admin-btn-ghost" disabled={editSaving}>Cancelar</button>
                <button type="submit" className="admin-btn admin-btn-primary" disabled={editSaving}>
                  {editSaving ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
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
