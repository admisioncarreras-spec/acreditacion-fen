[MODO_KIOSKO.md](https://github.com/user-attachments/files/27812981/MODO_KIOSKO.md)
# 🔒 Guía: Modo Kiosko para los Tablets

Esta guía explica cómo configurar las tablets que servirán como tótem de acreditación, para que queden bloqueadas mostrando SOLO la página `acreditacion-fen.vercel.app` — sin barra de URL, sin botones de navegación, sin que un cabro travieso pueda salir del navegador y abrir TikTok, YouTube o pintar la pantalla con dibujos.

---

## 📱 Opción A: Tablets Android (la más común)

### Paso 1 — Instalar Fully Kiosk Browser

1. En cada tablet, abre **Google Play Store**.
2. Busca **"Fully Kiosk Browser"** (el ícono es un candado azul).
3. Instálalo. **Es gratis** para uso básico.

### Paso 2 — Configuración inicial

1. Abre Fully Kiosk Browser.
2. La primera pantalla te pide la **URL de inicio**: pon `https://acreditacion-fen.vercel.app/` (con `https` y la barra al final).
3. Al final del proceso (o desde el menú lateral ☰ → **Settings**), configura:

**🔹 Sección "Web Content Settings"**
- ✅ **Start URL**: `https://acreditacion-fen.vercel.app/`
- ✅ **Auto Reload on Idle**: 300 (vuelve al inicio si nadie usa por 5 min — opcional)
- ✅ **JavaScript**: ON (esencial, la web es React)
- ❌ **Allow Pop-ups**: OFF
- ❌ **Allow URL Bar / Address Bar**: OFF (oculta la barra)

**🔹 Sección "Device Management" → "Kiosk Mode"**
- ✅ **Enable Kiosk Mode**: ON
- ✅ **Kiosk PIN**: define un PIN de 4-6 dígitos (anótalo en alguna parte segura — ej: `1234`). Es lo que tendrás que ingresar para SALIR del modo kiosko.
- ✅ **Disable Status Bar / Notifications**: ON
- ✅ **Disable Volume Buttons**: ON (opcional)
- ✅ **Disable Power Button**: ON (opcional, depende del modelo)

**🔹 Sección "Universal Launcher / Home Replacement"**
- ✅ **Set as Default Launcher**: si quieres que la tablet abra DIRECTO en kiosko al prender, ponlo en ON. Te va a pedir permisos del sistema, acéptalos.

**🔹 Sección "Screen & Display"**
- ✅ **Keep Screen On**: ON (que no se apague durante el evento)
- ✅ **Screen Brightness**: 80-100% (para que se vea bien en sala iluminada)
- ✅ **Force Screen Orientation**: Landscape o Portrait según cómo monten las tablets en los soportes metálicos (en general Portrait para tótem vertical).

**🔹 Sección "Power Settings"**
- ✅ **Stay Awake When Plugged**: ON (importante, asume que los tablets estarán enchufados durante el evento)

### Paso 3 — Activar el modo kiosko

Una vez configurado todo:
- Menú ☰ → **Start Kiosk Mode**
- O reinicia la tablet — abrirá directo en kiosko si configuraste "Set as Default Launcher".

A partir de ahora, los usuarios solo ven el tótem. Para **SALIR** del modo kiosko (por ejemplo, para hacer Ctrl+F5 o cambiar config), toca **5-7 veces seguidas rápido** en cualquier esquina (depende de la versión) → ingresas el PIN → sales.

---

## 🍎 Opción B: Tablets iOS / iPad

iOS tiene una función nativa llamada **"Guided Access"** (Acceso Guiado).

### Setup

1. En la iPad: **Ajustes → Accesibilidad → Acceso Guiado**.
2. Activa **Acceso Guiado**.
3. Define un **código de paso** (ej: 1234).
4. Activa **Cierre automático**: ❌ Nunca (que no se cierre solo).

### Uso

1. Abre **Safari** (o Chrome).
2. Navega a `acreditacion-fen.vercel.app`.
3. Pon Safari en **modo pantalla completa** (toca el botón AA en la barra → "Ocultar barra de herramientas").
4. **Triple-click en el botón lateral** (o de inicio en iPads más viejas) → se activa Acceso Guiado.
5. Toca **Iniciar** arriba a la derecha.

A partir de ahí, la iPad está bloqueada en esa app. Para salir: triple-click en el botón lateral → ingresa el código → **Terminar**.

> ⚠️ Limitación: Acceso Guiado no se reactiva automáticamente al reiniciar el iPad. Si se apaga, hay que reactivarlo manualmente. Por eso, en eventos largos, es mejor Android + Fully Kiosk.

---

## 💻 Opción C: Chromebook (Chrome OS)

Chrome OS tiene **Kiosk Mode** nativo, pero requiere una licencia Chrome Enterprise (~50 USD/dispositivo/año). Si tienes Chromebooks gestionadas por la UChile, contacta a IT.

Alternativa gratis: usar Chrome en modo **App Mode**:
1. Abre Terminal con Ctrl+Alt+T → escribe `shell` → Enter.
2. Ejecuta: `google-chrome --kiosk --app=https://acreditacion-fen.vercel.app/`
3. Para salir: Ctrl+W (si tienes teclado físico).

No es tan seguro como las opciones A/B, pero sirve.

---

## ✅ Checklist antes del evento

Para CADA tablet, el día anterior:

- [ ] Está cargada al 100% (o enchufada al cargador)
- [ ] El brillo está en 80%+
- [ ] Está conectada al WiFi de la facultad
- [ ] Abriste `acreditacion-fen.vercel.app` y aparece el badge del evento correcto
- [ ] Probaste ingresar un RUT de prueba y funciona el flujo completo
- [ ] El modo kiosko está activo (sin barra de URL visible)
- [ ] Sabes el PIN para salir del kiosko por si algo
- [ ] El soporte metálico está firme y la tablet bien sujeta

---

## 🚨 Plan B si algo falla

- **WiFi cae** → el tótem mostrará "Ups, algo salió mal" cuando intenten acreditar. Solución: tener un mesón con sheet/Excel manual de respaldo.
- **El sistema dice "No hay actividades activas"** pero sí hay → entra al admin (`/admin/dashboard`), busca el evento, cambia el modo a "Forzar activo" temporalmente.
- **Una tablet se cuelga** → mantén apretado el botón de encendido para reiniciarla. Si tienes "Set as Default Launcher", arrancará automáticamente en kiosko.
- **No sale del kiosko** → mantén apretado el botón de encendido + volumen+ por 10-15 segundos para reset forzado.

---

## 💡 Tips finales

- **Comprar tablets baratas** (~50.000-80.000 CLP cada una): el sistema corre liviano, no necesita potencia.
- **Marcas recomendadas**: Samsung Galaxy Tab A, Lenovo Tab M8/M10, Xiaomi Pad SE.
- **Tamaño ideal**: 8-10 pulgadas para el tótem vertical.
- **Cubierta de protección rígida** para que no se trizen si las hacen caer del soporte.
- **Bloqueo físico** en el soporte metálico para evitar robos.

Cualquier duda al configurar, mándale screenshot a Claude y te ayuda 🙂
