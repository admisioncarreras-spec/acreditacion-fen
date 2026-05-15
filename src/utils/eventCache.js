// === Caché de eventos ===
const EVENTS_CACHE_KEY = 'fen_admin_eventos_v1';
const EVENTS_MAX_AGE = 10 * 60 * 1000; // 10 min

export function loadCachedEventos() {
  try {
    const raw = localStorage.getItem(EVENTS_CACHE_KEY);
    if (!raw) return null;
    const { eventos, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp > EVENTS_MAX_AGE) {
      localStorage.removeItem(EVENTS_CACHE_KEY);
      return null;
    }
    return eventos;
  } catch { return null; }
}

export function saveCachedEventos(eventos) {
  try {
    localStorage.setItem(EVENTS_CACHE_KEY, JSON.stringify({ eventos, timestamp: Date.now() }));
  } catch {}
}

export function clearCachedEventos() {
  try { localStorage.removeItem(EVENTS_CACHE_KEY); } catch {}
}

// === Caché de salas (master) ===
const SALAS_CACHE_KEY = 'fen_admin_salas_v1';
const SALAS_MAX_AGE = 30 * 60 * 1000; // 30 min (cambian poco)

export function loadCachedSalas() {
  try {
    const raw = localStorage.getItem(SALAS_CACHE_KEY);
    if (!raw) return null;
    const { salas, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp > SALAS_MAX_AGE) {
      localStorage.removeItem(SALAS_CACHE_KEY);
      return null;
    }
    return salas;
  } catch { return null; }
}

export function saveCachedSalas(salas) {
  try {
    localStorage.setItem(SALAS_CACHE_KEY, JSON.stringify({ salas, timestamp: Date.now() }));
  } catch {}
}

export function clearCachedSalas() {
  try { localStorage.removeItem(SALAS_CACHE_KEY); } catch {}
}
