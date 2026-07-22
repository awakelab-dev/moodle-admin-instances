# Plan de migración: Express+Mongoose+CSS → NestJS+PostgreSQL/Prisma + Tailwind/shadcn

Monorepo se mantiene (`backend/`, `frontend/` como hoy). Frontend sigue en React+Vite (no Next.js).

## A. PostgreSQL local (sin permisos de admin)

Mismo enfoque que MongoDB portable: binarios ZIP de PostgreSQL (EnterpriseDB o `theseus-rs/postgresql-binaries`), sin instalador.

- `backend/.local-pg/bin` + `backend/.local-pg/data` (gitignored), `initdb` una vez, `pg_ctl start`/`stop`.
- `backend/.env`: `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/moodle_admin?schema=public"`.
- Scripts npm: `db:init`, `db:start`, `db:stop`.

## B. Esquema Prisma (`backend/prisma/schema.prisma`)

Modelos: `Platform` (reemplaza `moodles.json`, con `slug` único), `Course`, `MoodleUser`, `PlatformSnapshot`, `SyncLog`, `AuthUser` (reemplaza `authUsers.js`, con `passwordHash` bcrypt en vez de SHA-256).

- `moodle_source` (string) de Mongo se convierte en FK real `platformId` en Postgres.
- Bytes (`sizeBytes`, etc.) como `BigInt`; dinero (`monthlyCharge`, `income`, `cost`, `margin`) como `Decimal`.
- `storageBreakdown`/`detailedStorageBreakdown` como `Json` (mismo shape de array que hoy, sin tabla normalizada extra).
- Índices únicos compuestos iguales a los actuales: `[platformId, courseId]`, `[platformId, userId]`, `[platformId, month]`.

## C. Estructura NestJS (`backend/src/`)

Módulos espejo de las rutas actuales: `PrismaModule` (global), `AuthModule`, `PlatformsModule`, `SyncModule`, `DashboardModule`.

- Guard de auth global vía `APP_GUARD` (mismo modelo "todo bloqueado excepto /auth/login y /health" que hoy).
- Se porta el esquema de token HMAC-SHA256 actual tal cual (no se cambia a JWT), pero las contraseñas pasan de SHA-256 a bcrypt.
- El progreso de sync en memoria (`syncRunning`/progress) se porta como servicio singleton de Nest — **no** se introduce BullMQ/Redis (no aporta valor para una app de instancia única y añadiría otra dependencia portable que instalar).
- DTOs con `class-validator` reemplazan el parseo manual de query params.

## D. Migración de datos Mongo → Postgres

Script único `backend/scripts/migrate-from-mongo.ts`:
1. Verificar primero (dry-run) que `moodle_source` en Mongo coincide con `name`/slug de `moodles.json`, antes de escribir nada.
2. Migrar Platforms (33), luego Courses (4381), Users (41770), PlatformSnapshots (371), SyncLogs (34) — por lotes.
3. AuthUsers: no se puede migrar el hash SHA-256 a bcrypt sin la contraseña en texto plano → se resetean las 2 contraseñas conocidas (`admin`/`Awakelab2026!`, `consulta`) directamente como bcrypt.
4. Verificar conteos de filas contra Mongo tras cada paso.
5. Mongo se mantiene corriendo en solo lectura como red de seguridad hasta confirmar el corte.

## E. Tailwind + shadcn/ui (Vite + JS, sin TypeScript)

- `frontend/jsconfig.json` + alias `@/*` en `vite.config.js` (sin migrar a TypeScript).
- `components.json` con `"tsx": false` para que shadcn genere `.jsx`.
- Paleta de `tailwind.config.js` copiando los valores hex ya usados en `App.css` (tema único oscuro, sin toggle claro/oscuro — `darkMode:'class'` fijo).
- Nuevo `frontend/src/lib/chartTheme.js` centraliza colores/fuente de Chart.js (hoy duplicados y con bug de fuente `'Segoe UI'` en vez de Poppins).

Mapeo de componentes → shadcn:
| Patrón actual | Componente shadcn |
|---|---|
| Tabs de Dashboard | `tabs` |
| Filter chips (GlobalPanel/PlatformHistoryTab) | `toggle-group` |
| Selects de rango de fecha | `select` |
| Stat cards | `card` + composite local `stat-card.jsx` |
| Tabla de cursos ordenable | `table` + `input` |
| Panel de desglose expandible | `collapsible` |
| Switch de plataforma activa/inactiva | `switch` |
| Formulario CRUD de plataformas | `input`/`label`/`button`/`card`/`dialog`/`alert-dialog` |
| Barra de progreso de sync | `progress` |
| Banners de error/info | `alert` |
| Chips de estado | `badge` |

Orden de migración incremental (cada paso deja la app funcionando): 1) tooling, 2) SyncPanel + filtros, 3) LoginPage (conservando la foto de fondo), 4) ConfigPage, 5) CourseSizeTab, 6) TopUsersTab/Dashboard, 7) App.jsx (header/nav), 8) limpieza final de `App.css`.

## F. Fases con checkpoints

0. Bootstrap Postgres portable — app sigue en Mongo, sin cambios visibles.
1. Prisma schema + migración de datos a Postgres (en paralelo, inerte) — Express+Mongo sigue siendo el que sirve producción.
2. Scaffold NestJS **junto a** Express (patrón strangler), corriendo en otro puerto para comparar respuestas campo a campo contra Express real.
3. **Corte de backend**: frontend apunta a NestJS+Postgres, se borran rutas/modelos/middleware de Express y Mongoose. ✅ checkpoint principal: app 100% funcional en el nuevo backend, frontend todavía con CSS plano.
4. Setup de Tailwind/shadcn (sin tocar visualmente nada aún).
5. Migración de componentes uno a uno (checkpoint tras cada uno).
6. Limpieza final (dependencias muertas, docs).

**Backend primero, frontend después** — son independientes (mismo contrato REST), y así no se combinan dos riesgos grandes (cambio de framework+DB y cambio de UI) a la vez.

## G. Riesgos clave

- **`moodle_source` → `platformId`**: el mayor riesgo — hay que verificar con un dry-run que el string coincide antes de migrar, o se pierden/rompen relaciones.
- **Progreso de sync en memoria**: se pierde al reiniciar el proceso Nest (igual que hoy con nodemon) — comportamiento idéntico, solo se documenta explícitamente.
- **Config de plataformas pasa de archivo a base de datos**: cambia el flujo de trabajo de edición manual de `moodles.json`.
- **BigInt/Decimal de Prisma**: no se serializan directo a JSON — hay que convertirlos a `Number` en los DTOs de respuesta o la API revienta en la primera llamada.
- **Contraseñas SHA-256 no migran a bcrypt sin texto plano**: se resetean las 2 conocidas.
- **Concurrencia del pipeline de sync** (lotes de 10, timeout 60s de axios): se porta tal cual, sin "mejoras" mezcladas con el cambio de framework.

---

### Archivos críticos
- `backend/prisma/schema.prisma` (nuevo)
- `backend/src/services/syncService.js` (lógica fuente para portar)
- `backend/src/config/moodles.json`, `backend/src/config/authUsers.js` (datos fuente para el script de migración)
- `backend/src/middleware/auth.js` (esquema de token a portar)
- `frontend/src/App.css` (paleta/fuente fuente para `tailwind.config.js`/`chartTheme.js`)
- `frontend/vite.config.js` + `frontend/jsconfig.json` (alias de rutas)

### Verificación
- Tras Fase 1: conteos de filas Postgres vs Mongo iguales (4381/41770/371/34 + 33 plataformas + 2 usuarios).
- Tras Fase 3: probar login, dashboard (3 tabs), sync manual, CRUD de plataformas + test de conexión, todo contra NestJS+Postgres, comparando respuesta contra la versión Express que quedó de respaldo.
- Tras cada componente de Fase 5: la app sigue arrancando (`npm run dev` en frontend) y el componente migrado se ve visualmente igual al tema oscuro/cian ya aplicado.
