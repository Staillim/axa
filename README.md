# Axa — Roblox-style Mobile App Clone

Clone de la app móvil de Roblox con sistema de autenticación propio basado en Firebase (Authentication + Realtime Database).

## Stack

- HTML5 + CSS3 + JavaScript vanilla
- Three.js para thumbnails 3D rotatorias
- Firebase Authentication (cuentas admin)
- Firebase Realtime Database (cuentas de usuario con expiración)

## Características

- 4 secciones principales: **Destacadas**, **Mercado**, **Crear**, **Robux**
- Login modal con header, tab bar, hero y footer edge-to-edge
- Flujo de envío de Robux multi-paso (búsqueda → monto → confirmar → cargar → éxito)
- Flujo de pago con PIN de 6 dígitos
- Panel de administración con:
  - Crear usuarios (username + contraseña + duración en días + icono de avatar)
  - Listar usuarios existentes con avatar, rol y días restantes
  - Eliminar usuarios
- Iconos de avatar seleccionables con fondo gris
- Sistema de expiración: los usuarios solo pueden iniciar sesión mientras tengan días restantes

## Cómo correr local

```bash
node server.cjs
```

Abre http://localhost:5173/index.html

O usa `iniciar.bat` (Windows) que arranca el server y abre el navegador.

## Estructura

```
AmenzaaV22/
├── index.html              # Markup principal
├── styles.css              # Estilos
├── app.js                  # Lógica completa de la app
├── server.cjs              # Server estático (puerto 5173)
├── proxy.js                # CORS proxy para la API de Roblox
├── iniciar.bat             # Launcher Windows
├── netlify/functions/      # Serverless function (alternativa al proxy)
└── recursos/               # Imágenes, iconos, fondos
    ├── iconos/             # 10 avatares seleccionables
    ├── Destacadas/         # Imágenes de juegos
    └── Mercado/            # Imágenes de items
```

## Datos de Firebase

La configuración de Firebase está en `index.html` (objeto `window.__firebaseConfig`).

**Reglas de Realtime Database necesarias** (para esta demo):

```json
{
  "rules": {
    "users": {
      ".read": true,
      ".write": true
    }
  }
}
```

## Cuentas

- **Admin**: la cuenta que crees en Firebase Authentication Console será automáticamente admin
- **Usuarios**: se crean desde el panel admin (con username, contraseña, días de duración y avatar)
- Los usuarios se guardan en `users/{username}` en RTDB
- Las contraseñas se hashean con SHA-256 + salt antes de guardar
- Los usernames solo admiten letras, números, `_`, `-` y `.` (3-32 caracteres)
