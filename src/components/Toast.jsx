import { useEffect, useState, useRef } from 'react';
import { playSalaLlena } from '../utils/sound';

/**
 * Hook que detecta cuándo una sala pasa de "no llena" a "llena" y dispara alerta.
 * Devuelve {toasts, removeToast} para que el componente renderice ToastContainer.
 *
 * @param {Array} capacidades - lista de capacidades calculadas
 * @param {Object} opts - { soundEnabled: bool }
 */
export function useSalaLlenaAlert(capacidades, opts = {}) {
  const { soundEnabled = true } = opts;
  const [toasts, setToasts] = useState([]);
  const previasLlenasRef = useRef(null); // null = aún no se ha cargado

  useEffect(() => {
    if (!Array.isArray(capacidades)) return;

    const llenasActuales = new Set(
      capacidades
        .filter(c => c.capacidad > 0 && c.disponibles === 0)
        .map(c => c.nombre_sala)
    );

    // Primera ejecución: solo guardamos estado, sin disparar alertas
    if (previasLlenasRef.current === null) {
      previasLlenasRef.current = llenasActuales;
      return;
    }

    // Detectar salas que recién se llenaron
    const nuevasLlenas = [...llenasActuales].filter(s => !previasLlenasRef.current.has(s));

    if (nuevasLlenas.length > 0) {
      if (soundEnabled) playSalaLlena();
      const baseId = Date.now();
      const nuevosToasts = nuevasLlenas.map((sala, i) => ({
        id: baseId + i,
        message: `🔴 ${sala} se llenó`,
        type: 'error',
      }));
      setToasts(prev => [...prev, ...nuevosToasts]);
    }

    previasLlenasRef.current = llenasActuales;
  }, [capacidades, soundEnabled]);

  const removeToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));

  return { toasts, removeToast };
}

function Toast({ id, message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 7000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className={`admin-toast admin-toast-${type}`}>
      <span className="admin-toast-msg">{message}</span>
      <button className="admin-toast-close" onClick={onClose} aria-label="Cerrar">×</button>
    </div>
  );
}

export function ToastContainer({ toasts, onClose }) {
  if (!toasts || toasts.length === 0) return null;
  return (
    <div className="admin-toast-container">
      {toasts.map(t => <Toast key={t.id} {...t} onClose={() => onClose(t.id)} />)}
    </div>
  );
}
