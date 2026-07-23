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
Rama de trabajo de la migración: `migracion-pablo` (ya subida al remoto).

## Encargo del instructor (Leonardo Barreto, leonardo.barreto@awakelab.dev)

Referencia de la tarea real: https://staging.apps.awakelab.world/moodle-insights
(login de "acceso de desarrollo" solo pide email, prueba con leonardo.barreto@awakelab.dev).
Esa es la app "Moodle Insights" dentro de la plataforma "AwkPlatform" — sirve como referencia
de estilo (sidebar azul marino oscuro casi negro, acentos cian brillante, tipografía tipo
Poppins en negrita, tarjetas de estadísticas redondeadas, gráficos de barras cian sobre fondo
oscuro) y de estructura de dashboard (stat cards, tabla de cursos, gráficos top-10).

Son 3 pasos:

1. **Correr la app en local** — ✅ HECHO.
2. **Migración de stack tecnológico + estética**, manteniendo monorepo — ✅ **COMPLETADA**:
   - Backend: Express+Mongoose → **NestJS** ✅
   - BD: MongoDB → **PostgreSQL + Prisma** ✅ (datos reales migrados y verificados)
   - Frontend: sigue en React+Vite, CSS plano → **Tailwind + shadcn/ui** ✅ (los 9
     componentes migrados: SyncPanel, GlobalPanel, PlatformHistoryTab, LoginPage,
     ConfigPage, CourseSizeTab, TopUsersTab, Dashboard, App.jsx), replicando el look & feel
     de la app de referencia (tema oscuro azul marino/cian, Poppins).
3. **Probar las conexiones con las plataformas Moodle reales** — parcialmente en curso: el
   test de conexión desde Configuración ya funciona contra plataformas reales (algunas dan
   timeout/permisos faltantes según el token, comportamiento esperado, no es un bug).

Detalle completo del plan y de las decisiones técnicas en `MIGRATION_PLAN.md` (raíz del repo).

## Estado actual del entorno local

Todo el stack corre localmente sin permisos de administrador (binarios portables):

- **PostgreSQL** portable en `C:\Users\PabloPlazaTravieso\postgresql-local\`, datos en
  `...\postgresql-local\data`, escuchando en `127.0.0.1:5432`. Base de datos: `moodle_admin`.
- **Backend NestJS** en `backend/src-nest/` (el código Express viejo en `backend/src/`
  fue eliminado; solo quedan `backend/src/config/*.js` y `backend/scripts/*.js` como
  referencia histórica de la migración de datos, ya no se ejecutan en producción).
- **Frontend Vite** sin cambios de framework, con Tailwind+shadcn/ui añadido.
- **DBeaver** portable instalado (acceso directo en el escritorio) para inspeccionar
  Postgres/Mongo visualmente.
- Login: usuario `admin` / contraseña `Awakelab2026!` (bcrypt en la tabla `auth_users` de
  Postgres). El usuario `consulta` no se migró — no se conocía su contraseña real en texto
  plano (SHA-256 no es reversible a bcrypt sin ella).

**Para arrancar todo con un doble clic**: acceso directo "Aulacloner - Iniciar" en el
escritorio (ejecuta `start-app.bat` en la raíz del repo — levanta Postgres + backend + frontend,
cada uno en su propia ventana de consola). Para pararlo: `stop-app.bat` (detiene Postgres; el
backend/frontend se cierran con Ctrl+C en sus ventanas).

Comandos manuales si hace falta:
```
# Postgres
"C:\Users\PabloPlazaTravieso\postgresql-local\pgsql\bin\pg_ctl.exe" -D "C:\Users\PabloPlazaTravieso\postgresql-local\data" -l "C:\Users\PabloPlazaTravieso\postgresql-local\logfile.txt" -o "-p 5432" start
# Backend (NestJS)
cd backend && npx ts-node -r tsconfig-paths/register src-nest/main.ts
# Frontend
cd frontend && npm run dev
```

MongoDB (el motor viejo) ya no se usa — se mantuvo corriendo solo como respaldo de lectura
durante la migración, no hace falta arrancarlo para trabajar en el proyecto.

## Credenciales y datos sensibles (NO subir a git nunca)

- `C:\Users\PabloPlazaTravieso\OneDrive - Ibecon 2003 S.L\Escritorio\servicios y tokens admin-instance (1)\`
  contiene tokens de Web Service reales de ~20 plataformas Moodle de producción (Grupo Aspasia,
  Catalejo Digital, etc.). Ya migrados a la tabla `platforms` de Postgres.
- El repo tenía archivos vacíos `contraseña.txt`, `usuarios.txt`, `token web .txt`,
  `servicios agregar.txt`, `ultimo commit.txt` en la raíz (placeholders sin rellenar).

## Pendiente (menor, no bloqueante)

- Migrar los cursos/tabla de `CourseSizeTab.jsx` y las tablas de `PlatformHistoryTab.jsx`
  al primitivo `Table` de shadcn (hoy siguen con el markup HTML original con clases CSS
  propias — visualmente correctas, pero no usan el componente shadcn puro). Bajo riesgo,
  cosmético únicamente.
- Seguir probando conexiones reales con el resto de plataformas Moodle (paso 3 del encargo).
- Revisar con el instructor si el usuario `consulta` necesita contraseña nueva.

## Notas de estilo (paleta de marca, ya aplicada en todo el frontend)

Fondo `#011932`, superficie `#01264c`/`#012142`, acento cian `#11eaea` (variantes `#19F7F1`,
`#0FCED3`, `#0ABCC9`, `#0B93AA` para gráficos), texto `#f0f3fc`, tipografía Poppins. Definido
como variables CSS en `frontend/src/App.css` y replicado en `frontend/tailwind.config.js`
para que los componentes shadcn lo hereden automáticamente.
