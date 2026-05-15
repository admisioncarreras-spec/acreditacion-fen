const API_URL = 'https://script.google.com/macros/s/AKfycbyDFvuey6tYCJpeWghlbR8LNnu-qlwVoCWI22Ak2dwtFdm94Jib_YvfIcrdxELQ-6_YGw/exec';

async function callApi(action, params = {}) {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({ action, ...params }),
    });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return await response.json();
  } catch (err) {
    return { ok: false, error: 'Error de conexión: ' + err.message };
  }
}

export const api = {
  // Públicos (tótem)
  eventoActivo: () => callApi('evento_activo'),
  acreditar: (rut) => callApi('acreditar', { rut }),
  buscarInscrito: (rut) => callApi('buscar_inscrito', { rut }),
  validarRut: (rut) => callApi('validar_rut', { rut }),

  // Admin - Eventos
  loginAdmin: (password) => callApi('login_admin', { password }),
  listarEventos: (token) => callApi('listar_eventos', { token }),
  crearEvento: (evento, token) => callApi('crear_evento', { evento, token }),
  editarEvento: (id_evento, cambios, token) => callApi('editar_evento', { id_evento, cambios, token }),
  eliminarEvento: (id_evento, token) => callApi('eliminar_evento', { id_evento, token }),

  // Admin - Inscritos
  inscritosEvento: (id_evento, token) => callApi('inscritos_evento', { id_evento, token }),
  cargarInscritos: (id_evento, inscritos, token) => callApi('cargar_inscritos', { id_evento, inscritos, token }),
  buscarPorNombre: (nombre, id_evento, token) => callApi('buscar_por_nombre', { nombre, id_evento, token }),
  marcarAsistenciaManual: (rut, id_evento, token) => callApi('marcar_asistencia_manual', { rut, id_evento, token }),
  desmarcarAsistencia: (rut, id_evento, token) => callApi('desmarcar_asistencia', { rut, id_evento, token }),
  editarInscrito: (rut, id_evento, cambios, token) => callApi('editar_inscrito', { rut, id_evento, cambios, token }),
  eliminarInscrito: (rut, id_evento, token) => callApi('eliminar_inscrito', { rut, id_evento, token }),
  resetAsistencias: (id_evento, token) => callApi('reset_asistencias', { id_evento, token }),
  estadisticas: (id_evento, token) => callApi('estadisticas', { id_evento, token }),

  // Admin - Salas
  listarSalas: (token) => callApi('listar_salas', { token }),
  guardarSala: (sala, token) => callApi('guardar_sala', { sala, token }),
  eliminarSala: (nombre_sala, token) => callApi('eliminar_sala', { nombre_sala, token }),
  capacidadEvento: (id_evento, token) => callApi('capacidad_evento', { id_evento, token }),
};
