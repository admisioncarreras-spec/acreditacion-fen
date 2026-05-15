// Formatea el RUT mientras el usuario escribe: 123456789 -> 12.345.678-9
export function formatRutInput(input) {
  const clean = input.toString().replace(/[^0-9kK]/g, '').toUpperCase();
  if (clean.length === 0) return '';
  if (clean.length === 1) return clean;

  const cuerpo = clean.slice(0, -1);
  const dv = clean.slice(-1);

  if (!/^\d+$/.test(cuerpo)) return clean;

  const cuerpoFmt = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${cuerpoFmt}-${dv}`;
}

// Valida RUT con módulo 11
export function validateRut(input) {
  const clean = input.toString().replace(/[^0-9kK]/g, '').toUpperCase();
  if (clean.length < 2) return { valid: false, reason: 'corto' };
  if (clean.length > 9) return { valid: false, reason: 'largo' };

  const cuerpo = clean.slice(0, -1);
  const dv = clean.slice(-1);

  if (!/^\d+$/.test(cuerpo)) return { valid: false, reason: 'invalid_chars' };

  let suma = 0;
  let mult = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo[i]) * mult;
    mult = mult === 7 ? 2 : mult + 1;
  }
  const resto = 11 - (suma % 11);
  let dvEsperado;
  if (resto === 11) dvEsperado = '0';
  else if (resto === 10) dvEsperado = 'K';
  else dvEsperado = String(resto);

  if (dv !== dvEsperado) {
    return { valid: false, reason: 'dv', suggestion: cuerpo + dvEsperado };
  }

  return { valid: true, clean };
}

// Formatea un RUT limpio a forma 12.345.678-9
export function formatRutClean(clean) {
  if (!clean || clean.length < 2) return clean;
  const cuerpo = clean.slice(0, -1);
  const dv = clean.slice(-1);
  const cuerpoFmt = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${cuerpoFmt}-${dv}`;
}
