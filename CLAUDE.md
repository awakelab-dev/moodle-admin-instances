# Contexto del proyecto (para retomar la sesión)

Este proyecto es real (cliente/instructor de Awakelab), no confundir con otros proyectos del
usuario (p. ej. `hoppers-app` es un cliente totalmente distinto — nunca tocarlo desde aquí).

## Qué es esta app

"Aulacloner" (nombre real, ver `frontend/src/components/LoginPage.jsx` y assets en
`frontend/public/login/`), también descrita en el README como "Moodle Admin Instances
Dashboard". Monitorea almacenamiento/uso de múltiples plataformas Moodle (multi-tenant) desde
un dashboard centralizado, sincronizando datos vía Web Services REST de cada Moodle y
guardándolos en su propia base de datos (no consulta Moodle en vivo desde el dashboard).

Repo: https://github.com/awakelab-dev/moodle-admin-instances.git (clonado en esta carpeta).

## Encargo del instructor (Leonardo Barreto, leonardo.barreto@awakelab.dev)

Referencia de la tarea real: https://staging.apps.awakelab.world/moodle-insights
(login de "acceso de desarrollo" solo pide email, prueba con leonardo.barreto@awakelab.dev).
Esa es la app "Moodle Insights" dentro de la plataforma "AwkPlatform" — sirve como referencia
de estilo (sidebar azul marino oscuro casi negro, acentos cian brillante, tipografía tipo
Poppins en negrita, tarjetas de estadísticas redondeadas, gráficos de barras cian sobre fondo
oscuro) y de estructura de dashboard (stat cards, tabla de cursos, gráficos top-10).

Son 3 pasos:

1. **Correr la app en local** — ✅ HECHO (ver estado actual abajo).
2. **Migración de stack tecnológico + estética**, manteniendo monorepo:
   - Backend: Express+Mongoose → **NestJS**
   - BD: MongoDB → **PostgreSQL + Prisma**
   - Frontend: seguir en React+Vite pero migrar CSS plano → **Tailwind + shadcn/ui**,
     replicando el look & feel de la app de referencia (staging.apps.awakelab.world/moodle-insights)
   - Este es el paso pendiente — **aún no se ha empezado la migración de código**, solo se
     hizo la investigación/reconocimiento (ver "Plan pendiente" abajo).
3. **Probar las conexiones con las plataformas Moodle reales** (tokens ya disponibles, ver
   "Credenciales y datos sensibles" abajo) — pendiente, viene después del paso 2.

## Estado actual del entorno local (ya hecho, no repetir)

- **MongoDB** corriendo como binario portable (sin instalar, sin admin) en
  `C:\Users\PabloPlazaTravieso\mongodb-local\mongodb-win32-x86_64-windows-8.0.15\bin\mongod.exe`,
  con datos en `C:\Users\PabloPlazaTravieso\mongodb-local\data`, escuchando en
  `127.0.0.1:27017`. Herramientas (`mongorestore`, `mongoexport`) en
  `C:\Users\PabloPlazaTravieso\mongodb-local\mongodb-database-tools-windows-x86_64-100.17.0\bin`.
- Dump restaurado desde
  `C:\Users\PabloPlazaTravieso\OneDrive - Ibecon 2003 S.L\Escritorio\dump-moodle\dump-moodle\`
  en la base `moodle-admin-instances`: colecciones `courses` (4381 docs), `users` (41770),
  `platformsnapshots` (371), `synclogs` (34). Sin fallos de restauración.
- `backend/.env` creado desde `.env.example` (MONGODB_URI ya apuntaba correcto, no hubo que
  cambiar nada ahí).
- Backend (Express) corriendo con `npm run dev` en `http://localhost:5001`.
- Frontend (Vite) corriendo con `npm run dev` en `http://localhost:5173`.
- Login local funcional: usuario `admin` / contraseña `Awakelab2026!` (contraseña reseteada
  localmente por Claude, solo para poder entrar a probar; el hash real de producción en
  `authUsers.js` se sobreescribió — si hace falta el original habría que pedírselo al
  instructor, no se puede revertir el hash).
- Si los procesos ya no están corriendo (reinicio de sesión, etc.), basta con:
  ```
  # Mongo
  "C:\Users\PabloPlazaTravieso\mongodb-local\mongodb-win32-x86_64-windows-8.0.15\bin\mongod.exe" --dbpath "C:\Users\PabloPlazaTravieso\mongodb-local\data" --port 27017
  # Backend
  cd backend && npm run dev
  # Frontend
  cd frontend && npm run dev
  ```

## Credenciales y datos sensibles (NO subir a git nunca)

- `C:\Users\PabloPlazaTravieso\OneDrive - Ibecon 2003 S.L\Escritorio\servicios y tokens admin-instance (1)\`
  contiene tokens de Web Service reales de ~20 plataformas Moodle de producción (Grupo Aspasia,
  Catalejo Digital, etc.) y la lista de funciones WS a habilitar por token. Esto es para el
  paso 3 (probar conexiones), todavía no usado.
- El repo tenía archivos vacíos `contraseña.txt`, `usuarios.txt`, `token web .txt`,
  `servicios agregar.txt`, `ultimo commit.txt` en la raíz (placeholders sin rellenar,
  aparentemente el instructor los dejó vacíos a propósito o se le olvidó).

## Plan pendiente (aún no ejecutado)

Antes de la interrupción para este resumen, se estaba explorando el código actual del backend
(modelos Mongoose: `Course`, `User`, `SyncLog`, `PlatformSnapshot`; rutas `auth`, `sync`,
`dashboard`, `platforms`; servicio grande `syncService.js` de ~1067 líneas que hace el scraping
multi-plataforma vía Web Services) para diseñar la migración a NestJS + Prisma + Postgres, y el
frontend (`App.jsx`, `Dashboard.jsx`, `CourseSizeTab.jsx`, `TopUsersTab.jsx`,
`PlatformHistoryTab.jsx`, `SyncPanel.jsx`, `ConfigPage.jsx`, `LoginPage.jsx`) para diseñar la
migración de estilos a Tailwind+shadcn. Aún no se ha escrito ningún plan formal ni tocado
código de la migración — el siguiente paso lógico es retomar el diseño de esa migración
(esquema Prisma equivalente a los 4 modelos Mongoose, estructura de módulos NestJS, y mapeo de
componentes React a Tailwind/shadcn con la paleta de marca Awakelab ya usada en el proyecto
`moodle-platform-manager`).

## Notas de estilo (paleta de referencia observada en staging)

Fondo/sidebar azul marino casi negro (~#011932), acentos cian brillante (~#19F7F1 / #11EAEA),
texto blanco/cian claro, tipografía bold sans-serif (Poppins), tarjetas de stats redondeadas
con icono+label+número grande, sidebar con secciones colapsables y ítem activo resaltado en
cian. Coincide con la guía de marca Awakelab 2026 ya aplicada en `moodle-platform-manager`
(mismo proyecto de Pablo, gestor de plataformas Moodle vía Web Services — un proyecto distinto,
más simple, que puede servir de referencia de implementación Next.js/Tailwind aunque esta app
use Vite en vez de Next.js).
