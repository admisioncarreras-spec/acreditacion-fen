// Parser de CSV/TSV tolerante - acepta tanto coma como tab/punto y coma
export function parseCSV(text) {
  if (!text || !text.trim()) return [];
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return [];

  // Detectar separador automáticamente
  const firstLine = lines[0];
  const candidates = ['\t', ';', ','];
  const sep = candidates.reduce((best, c) =>
    (firstLine.split(c).length > firstLine.split(best).length) ? c : best
  , ',');

  const splitLine = (line) => {
    // Split respetando comillas
    const result = [];
    let curr = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuote = !inQuote; continue; }
      if (ch === sep && !inQuote) { result.push(curr.trim()); curr = ''; continue; }
      curr += ch;
    }
    result.push(curr.trim());
    return result;
  };

  const headers = splitLine(lines[0]).map(h => h.toLowerCase().trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i]);
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = (cells[idx] || '').trim(); });
    rows.push(obj);
  }
  return rows;
}

// Genera CSV desde un array de objetos y lo descarga
export function downloadCSV(rows, filename) {
  if (!rows || rows.length === 0) {
    alert('No hay datos para exportar');
    return;
  }
  const headers = Object.keys(rows[0]);
  const escape = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };
  const csv = [
    headers.join(','),
    ...rows.map(r => headers.map(h => escape(r[h])).join(','))
  ].join('\n');

  // BOM para Excel detecte UTF-8
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
