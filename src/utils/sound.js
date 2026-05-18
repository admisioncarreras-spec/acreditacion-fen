// Sonido sutil para alertas del admin
let audioCtx = null;

function ensureCtx() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  } catch (e) {
    return null;
  }
}

// Beep de alerta: 2 tonos ascendentes (sala llena)
export function playSalaLlena() {
  const ctx = ensureCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    [880, 1175].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = 'sine';
      osc.connect(gain);
      gain.connect(ctx.destination);
      const t = now + i * 0.18;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.02);
      gain.gain.linearRampToValueAtTime(0, t + 0.16);
      osc.start(t);
      osc.stop(t + 0.18);
    });
  } catch (e) {}
}

// Beep suave para "casi llena" (90%) - opcional
export function playCasiLlena() {
  const ctx = ensureCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 660;
    osc.type = 'sine';
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.1, now + 0.02);
    gain.gain.linearRampToValueAtTime(0, now + 0.2);
    osc.start(now);
    osc.stop(now + 0.22);
  } catch (e) {}
}
