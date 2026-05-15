const TOKEN_KEY = 'fen_admin_token';

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function setToken(token) {
  try { localStorage.setItem(TOKEN_KEY, token); } catch {}
}

export function clearToken() {
  try { localStorage.removeItem(TOKEN_KEY); } catch {}
}

export function isAuthed() {
  return !!getToken();
}
