# Moodle Admin Instances Dashboard

Aplicación web para monitorear el almacenamiento de múltiples plataformas Moodle desde un dashboard centralizado.

## Arquitectura

```
Frontend (React + Vite)          Backend (Express + Mongoose)
┌──────────────────────┐         ┌──────────────────────────────┐
│  SyncPanel           │ ──API──▶│  POST /api/sync              │
│  Dashboard           │         │  GET  /api/sync/status       │
│    ├─ CourseSizeTab  │◀──API── │  GET  /api/dashboard/courses │
│    └─ TopUsersTab    │         │  GET  /api/dashboard/users   │
└──────────────────────┘         └──────────┬───────────────────┘
                                            │
                                  ┌─────────▼─────────┐
                                  │  MongoDB           │
                                  │  moodle-admin-     │
                                  │  instances         │
                                  └───────────────────┘
```

**Flujo de datos:**
1. El usuario presiona "Actualizar Datos" en el frontend.
2. El backend itera la lista de plataformas Moodle configuradas.
3. Para cada Moodle, llama a los Web Services REST para extraer cursos, categorías, contenidos y usuarios.
4. Calcula el tamaño de cada curso (excluyendo backups `.mbz`) y el almacenamiento por usuario.
5. Upserta los datos en MongoDB con un identificador de origen (`moodle_source`).
6. El dashboard lee exclusivamente de MongoDB, sin peticiones en vivo a Moodle.

## Requisitos Previos

- **Node.js** v18+
- **MongoDB** corriendo en `localhost:27017`
- **Tokens de Web Service** de cada plataforma Moodle

### Funciones WS requeridas en Moodle

Cada token debe tener habilitadas estas funciones:

- `core_course_get_categories`
- `core_course_get_courses`
- `core_course_get_contents`
- `core_enrol_get_enrolled_users`
- `mod_assign_get_assignments`
- `mod_assign_get_submissions`

### Plugin local opcional para métrica de Total Site Data

El repositorio incluye un plugin Moodle en `moodle-plugin/local/sitedatausage` para calcular el uso físico del `moodledata` y exponerlo por Web Service.

- **Métrica principal**: `total_site_data_bytes`
- **Método**: escaneo recursivo de `$CFG->dataroot`
- **Desglose adicional**: `filedir`, `trashdir`, `temp`, `cache`, `localcache`, `sessions` y `other`
- **Compatibilidad objetivo**: Moodle 4.0+

Pasos de instalación:

1. Copia `moodle-plugin/local/sitedatausage` a `<tu-moodle>/local/sitedatausage`
2. Entra a administración de Moodle para completar la instalación del plugin
3. Ejecuta la tarea programada `local_sitedatausage\\task\\refresh_metrics` o invoca el WS de refresco para generar el primer snapshot
4. Agrega al servicio/token las funciones:
   - `local_sitedatausage_get_latest_metrics`
   - `local_sitedatausage_refresh_metrics`

El plugin no sustituye el cálculo actual del dashboard por curso; añade una métrica separada y más cercana al “Total site data”.

## Instalación

### 1. Clonar el repositorio

```bash
git clone <repo-url>
cd moodle-admin-instances
```

### 2. Configurar las plataformas Moodle

Edita `backend/src/config/moodles.json` con tus plataformas:

```json
[
  {
    "name": "Moodle Producción",
    "url": "https://moodle.tuempresa.com",
    "token": "abc123def456..."
  },
  {
    "name": "Moodle Staging",
    "url": "https://staging.moodle.tuempresa.com",
    "token": "ghi789jkl012..."
  },
  {
    "name": "Moodle Dev",
    "url": "https://dev.moodle.tuempresa.com",
    "token": "mno345pqr678..."
  }
]
```

> **Para agregar más plataformas**, simplemente añade más objetos al array. No se requiere cambiar código.

### 3. Configurar variables de entorno del backend

```bash
cp backend/.env.example backend/.env
```

Contenido del `.env`:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/moodle-admin-instances
SYNC_PLATFORM_CONCURRENCY=all
```

### 4. Instalar dependencias

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 5. Iniciar MongoDB

Asegúrate de que MongoDB esté corriendo. Si usas MongoDB Community:

```bash
# Windows (servicio)
net start MongoDB

# O manualmente
mongod --dbpath C:\data\db
```

### 6. Levantar la aplicación

En dos terminales separadas:

```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend
cd frontend
npm run dev
```

- **Backend**: http://localhost:5000
- **Frontend**: http://localhost:5173

## Estructura del Proyecto

```
moodle-admin-instances/
├── backend/
│   ├── package.json
│   ├── .env.example
│   └── src/
│       ├── server.js                    # Entry point, MongoDB connection
│       ├── config/
│       │   └── moodles.json             # ← Configuración de plataformas
│       ├── models/
│       │   ├── Course.js                # Esquema: cursos con tamaño
│       │   ├── User.js                  # Esquema: usuarios con storage
│       │   └── SyncLog.js               # Esquema: log de sincronización
│       ├── services/
│       │   ├── moodleClient.js          # Cliente REST genérico para Moodle WS
│       │   └── syncService.js           # Orquestación de sync multi-plataforma
│       └── routes/
│           ├── sync.js                  # POST /api/sync, GET /api/sync/status
│           └── dashboard.js             # GET /api/dashboard/courses, users/top
├── frontend/
│   ├── package.json
│   ├── index.html
│   ├── vite.config.js                   # Proxy /api → backend
│   └── src/
│       ├── main.jsx
│       ├── App.jsx                      # Layout principal con navegación
│       ├── App.css                      # Tema minimalista turquesa
│       ├── api/
│       │   └── index.js                 # Cliente HTTP para el backend
│       └── components/
│           ├── SyncPanel.jsx            # Botón sync + barra de progreso
│           ├── Dashboard.jsx            # Contenedor de pestañas
│           ├── CourseSizeTab.jsx         # Gráfico barras apiladas por categoría
│           └── TopUsersTab.jsx          # Gráfico barras horizontales top 10
└── README.md
```

## API Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/sync` | Inicia sincronización de todas las plataformas |
| `GET` | `/api/sync/status` | Estado actual de la sincronización en curso |
| `GET` | `/api/sync/last` | Última sincronización completada |
| `GET` | `/api/dashboard/courses` | Datos de cursos agrupados por categoría |
| `GET` | `/api/dashboard/users/top` | Top 10 usuarios por almacenamiento global |
| `GET` | `/api/health` | Health check del backend |

## Esquemas MongoDB

**Colección `courses`** — Índice único: `(moodle_source, course_id)`
- `moodle_source`: URL de la plataforma de origen
- `moodle_name`: Nombre de la plataforma
- `course_id`: ID del curso en Moodle
- `course_name`, `shortname`, `category_id`, `category_name`
- `size_bytes`: Tamaño total (excluyendo backups)
- `synced_at`: Fecha de última sincronización

**Colección `users`** — Índice único: `(moodle_source, user_id)`
- `moodle_source`, `moodle_name`
- `user_id`, `username`, `fullname`
- `total_size_bytes`: Total de archivos subidos por el usuario
- `synced_at`

**Colección `synclogs`** — Registro de cada operación de sincronización
- `started_at`, `completed_at`, `status`, `platforms_total`, `platforms_synced`, `errors`

## Notas

- Los archivos de backup (`.mbz`) son **excluidos** automáticamente del cálculo de tamaño.
- El tamaño de los cursos se calcula sumando los `filesize` de los contenidos retornados por `core_course_get_contents`.
- El storage por usuario se calcula a partir de los archivos adjuntos en entregas de tareas (`mod_assign`).
- La sincronización procesa plataformas en paralelo y `SYNC_PLATFORM_CONCURRENCY` acepta un número o `all` para correr todas a la vez.
- El archivo `moodles.json` se re-lee en cada sincronización, permitiendo agregar plataformas sin reiniciar el backend.
