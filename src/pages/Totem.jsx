import { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { formatRutInput, validateRut, formatRutClean } from '../utils/rut';
import '../styles/totem.css';

const RESET_DELAY = 6000;        // ms en pantallas de éxito
const RESET_DELAY_ERROR = 5000;  // ms en pantallas de error
const POLL_EVENTO = 60000;       // ms entre chequeos de evento activo

// === Caché del evento en navegador (anti-flash al recargar) ===
const EVENT_CACHE_KEY = 'fen_acreditacion_evento_v1';
const EVENT_CACHE_MAX_AGE = 60 * 60 * 1000; // 1 hora

function loadCachedEvento() {
  try {
    const raw = localStorage.getItem(EVENT_CACHE_KEY);
    if (!raw) return null;
    const { evento, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp > EVENT_CACHE_MAX_AGE) {
      localStorage.removeItem(EVENT_CACHE_KEY);
      return null;
    }
    return evento;
  } catch {
    return null;
  }
}

function saveCachedEvento(evento) {
  try {
    if (evento) {
      localStorage.setItem(EVENT_CACHE_KEY, JSON.stringify({ evento, timestamp: Date.now() }));
    } else {
      localStorage.removeItem(EVENT_CACHE_KEY);
    }
  } catch {
    // ignore
  }
}

export default function Totem() {
  const [stage, setStage] = useState('idle');
  // stages: idle | loading | success_new | success_repeat | rut_invalid | not_found | no_event | error
  const [rutInput, setRutInput] = useState('');
  const [result, setResult] = useState(null);
  const [eventoActivo, setEventoActivo] = useState(loadCachedEvento);
  const [primeraCarga, setPrimeraCarga] = useState(true);
  const [now, setNow] = useState(new Date());
  const resetTimer = useRef(null);
  const inputRef = useRef(null);

  // Reloj del header
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Polling del evento activo (carga inmediata + cada 60s)
  useEffect(() => {
    let mounted = true;
    const fetchEvento = async () => {
      const res = await api.eventoActivo();
      if (!mounted) return;
      const nuevo = res.ok ? res.evento : null;
      setEventoActivo(nuevo);
      saveCachedEvento(nuevo);
      setPrimeraCarga(false);
    };
    fetchEvento();
    const t = setInterval(fetchEvento, POLL_EVENTO);
    return () => { mounted = false; clearInterval(t); };
  }, []);

  const goIdle = () => {
    setStage('idle');
    setRutInput('');
    setResult(null);
  };

  // Auto-reset después de mostrar resultado
  useEffect(() => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
    if (stage !== 'idle' && stage !== 'loading') {
      const delay = (stage === 'error' || stage === 'rut_invalid' || stage === 'not_found')
        ? RESET_DELAY_ERROR
        : RESET_DELAY;
      resetTimer.current = setTimeout(goIdle, delay);
    }
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, [stage]);

  // Focus al input cuando volvemos a idle
  useEffect(() => {
    if (stage === 'idle' && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [stage]);

  // Sonidos con Web Audio API (no requiere assets)
  const playSound = (type) => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      if (type === 'success') {
        const note = (freq, start, dur) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.frequency.value = freq;
          osc.type = 'sine';
          osc.connect(gain);
          gain.connect(ctx.destination);
          gain.gain.setValueAtTime(0, ctx.currentTime + start);
          gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + start + 0.02);
          gain.gain.linearRampToValueAtTime(0, ctx.currentTime + start + dur);
          osc.start(ctx.currentTime + start);
          osc.stop(ctx.currentTime + start + dur);
        };
        note(880, 0, 0.15);
        note(1320, 0.12, 0.22);
      } else if (type === 'error') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 220;
        osc.type = 'sine';
        osc.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch (e) {
      // ignore
    }
  };

  const handleRutChange = (e) => {
    setRutInput(formatRutInput(e.target.value));
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!rutInput.trim()) return;

    // Validación local primero
    const v = validateRut(rutInput);
    if (!v.valid) {
      if (v.reason === 'dv') {
        setResult({ sugerencia: formatRutClean(v.suggestion) });
      } else {
        setResult({ mensaje: 'El RUT está incompleto o tiene caracteres inválidos. Verifica los números.' });
      }
      setStage('rut_invalid');
      playSound('error');
      return;
    }

    setStage('loading');
    const res = await api.acreditar(rutInput);

    if (res.ok && res.nuevo) {
      setResult(res);
      setStage('success_new');
      playSound('success');
    } else if (res.ok && res.ya_acreditado) {
      setResult(res);
      setStage('success_repeat');
      playSound('success');
    } else if (res.rut_invalido) {
      setResult({ sugerencia: res.sugerencia_formateada });
      setStage('rut_invalid');
      playSound('error');
    } else if (res.no_encontrado) {
      setResult(res);
      setStage('not_found');
      playSound('error');
    } else if (!res.ok && res.error && res.error.toLowerCase().includes('no hay eventos')) {
      setResult(res);
      setStage('no_event');
    } else {
      setResult(res);
      setStage('error');
      playSound('error');
    }
  };

  const useSuggestion = () => {
    if (result?.sugerencia) {
      setRutInput(result.sugerencia);
      setStage('idle');
    }
  };

  const saludo = () => {
    const h = now.getHours();
    if (h < 12) return 'Buenos días';
    if (h < 19) return 'Buenas tardes';
    return 'Buenas noches';
  };

  return (
    <div className="totem">
      <header className="totem-header">
        <div className="totem-brand">
          <div className="totem-logo">FEN</div>
          <div>
            <div className="brand-title">Facultad de Economía y Negocios</div>
            <div className="brand-subtitle">Universidad de Chile</div>
          </div>
        </div>
        <div className="totem-clock">
          {now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </header>

      <main className="totem-main">
        {stage === 'idle' && (
          <div className="screen screen-idle">
            {eventoActivo ? (
              <>
                <div className="event-badge">{eventoActivo.nombre}</div>
                <h1 className="totem-greeting">¡{saludo()}!</h1>
                <p className="totem-subtitle">Ingresa tu RUT para acreditarte</p>
                <form onSubmit={handleSubmit} className="totem-form">
                  <input
                    ref={inputRef}
                    type="text"
                    inputMode="text"
                    autoComplete="off"
                    spellCheck="false"
                    placeholder="12.345.678-9"
                    value={rutInput}
                    onChange={handleRutChange}
                    className="totem-input"
                    autoFocus
                  />
                  <button type="submit" className="totem-button" disabled={!rutInput}>
                    Acreditarme →
                  </button>
                </form>
              </>
            ) : primeraCarga ? (
              <div className="no-event">
                <div className="spinner spinner-soft"></div>
                <p className="loading-soft">Cargando información del evento...</p>
              </div>
            ) : (
              <div className="no-event">
                <div className="big-icon">⏰</div>
                <h2>No hay actividades activas</h2>
                <p>En este momento no hay acreditación abierta.<br />Pregunta en el mesón de informaciones.</p>
              </div>
            )}
          </div>
        )}

        {stage === 'loading' && (
          <div className="screen screen-loading">
            <div className="spinner"></div>
            <p>Buscándote en la lista...</p>
          </div>
        )}

        {stage === 'success_new' && result?.inscrito && (
          <div className="screen screen-success">
            <div className="check-circle">
              <svg viewBox="0 0 52 52" className="check-svg">
                <circle cx="26" cy="26" r="24" className="check-bg" />
                <path d="M14 27 l8 8 l16 -18" className="check-mark" />
              </svg>
            </div>
            <h1 className="success-greet">¡{saludo()}, {primerNombre(result.inscrito.nombre)}!</h1>
            <p className="success-msg">Te esperamos en:</p>
            <div className="sala-card">
              <div className="sala-label">SALA</div>
              <div className="sala-name">{result.inscrito.sala || 'Por confirmar'}</div>
            </div>
            <p className="success-foot">¡Mucha suerte! 🍀</p>
          </div>
        )}

        {stage === 'success_repeat' && result?.inscrito && (
          <div className="screen screen-success">
            <div className="check-circle check-circle-repeat">
              <svg viewBox="0 0 52 52" className="check-svg">
                <circle cx="26" cy="26" r="24" className="check-bg" />
                <path d="M14 27 l8 8 l16 -18" className="check-mark" />
              </svg>
            </div>
            <h1 className="success-greet">
              Ya estás acreditado{result.inscrito.nombre ? `, ${primerNombre(result.inscrito.nombre)}` : ''}
            </h1>
            <p className="success-msg">
              Te acreditaste a las <strong>{result.inscrito.hora_acreditacion}</strong>
            </p>
            <div className="sala-card sala-card-soft">
              <div className="sala-label">SALA</div>
              <div className="sala-name">{result.inscrito.sala}</div>
            </div>
            <p className="success-foot">¡Que te vaya excelente! 🍀</p>
          </div>
        )}

        {stage === 'rut_invalid' && (
          <div className="screen screen-error">
            <div className="error-icon">⚠️</div>
            <h2>Revisa tu RUT</h2>
            <p className="error-msg">{result?.mensaje || 'El RUT que ingresaste no es válido.'}</p>
            {result?.sugerencia && (
              <div className="suggestion-box">
                <p>¿Quisiste decir?</p>
                <button className="suggestion-btn" onClick={useSuggestion}>
                  {result.sugerencia}
                </button>
              </div>
            )}
            <button className="ghost-btn" onClick={goIdle}>Intentar de nuevo</button>
          </div>
        )}

        {stage === 'not_found' && (
          <div className="screen screen-error">
            <div className="error-icon">🤔</div>
            <h2>No te encontramos en la lista</h2>
            <p className="error-msg">
              Verifica que tu RUT esté bien escrito. Si el problema persiste, dirígete al <strong>mesón de ayuda</strong>.
            </p>
            <button className="ghost-btn" onClick={goIdle}>Intentar de nuevo</button>
          </div>
        )}

        {stage === 'no_event' && (
          <div className="screen screen-info">
            <div className="big-icon">⏰</div>
            <h2>No hay actividades activas</h2>
            <p className="error-msg">{result?.error || 'En este momento no hay acreditación abierta.'}</p>
            <button className="ghost-btn" onClick={goIdle}>Volver</button>
          </div>
        )}

        {stage === 'error' && (
          <div className="screen screen-error">
            <div className="error-icon">😕</div>
            <h2>Ups, algo salió mal</h2>
            <p className="error-msg">{result?.error || 'Inténtalo de nuevo.'}</p>
            <button className="ghost-btn" onClick={goIdle}>Reintentar</button>
          </div>
        )}
      </main>

      <footer className="totem-footer">
        FEN UChile · {now.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      </footer>
    </div>
  );
}

function primerNombre(nombreCompleto) {
  if (!nombreCompleto) return '';
  return nombreCompleto.toString().trim().split(' ')[0];
}
