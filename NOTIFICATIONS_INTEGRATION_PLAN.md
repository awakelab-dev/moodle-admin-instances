# Integración de "Gestión de Notificaciones" (envío automático de emails)

Documento de auditoría + plan de arquitectura para traer al dashboard (Moodle Insights)
toda la funcionalidad del plugin de Moodle `local_courseprogressnotify` (envío
automatizado de emails a alumnos/instructores), que hoy vive de forma aislada e
independiente en cada una de las ~24 plataformas Moodle, cada una con su propia
configuración de plugin sin relación entre sí.

Encargo del instructor (resumen literal de lo pedido):

> Debe aprovechar el desarrollo existente para el envío de emails personalizados
> (25%, 50%, 75%, al instructor cuando tenga una actividad, cuando le toque
> evaluación, etc.). Los de 25%, 50% y 75% son muy importantes, empieza por ahí.
>
> El plugin se instala en cada plataforma, pero no tiene parámetros de
> configuración, solo lo necesario para conectar con la app. En Moodle Insights:
> se definen los disparadores (eventos), se asocian las plantillas de email a
> los eventos, se lleva la gestión de todos los parámetros de configuración (el
> plugin solo recibe esos parámetros, no debería tener nada, ni interfaces). Se
> lleva la gestión de plantillas de correo (diseño, parametrización y
> seguimiento).

En corto: el plugin pasa de ser un producto autocontenido (con su propia
configuración, sus 9 tareas cron y su propio log) a ser un **ejecutor delgado**
que Moodle Insights controla por completo — igual que ya controla la
sincronización de datos de cada plataforma, pero en la dirección contraria
(el plugin llama a Moodle Insights, no al revés).

---

## 1. Estado actual del plugin (auditoría de código)

Repositorio de referencia leído íntegramente (README, SETUP_GUIDE, y los ~28
archivos PHP): `courseprogressnotify v2.9.0 1/courseprogressnotify`.

### Qué hace hoy
9 tipos de email por cron, con deduplicación por tabla de log propia:
progreso 25%/50% (con tabla de actividades completadas/pendientes), fin de
curso próximo (7 días antes), último día, recordatorio Zoom (vía `mod_zoom`),
recordatorio de examen/tutoría presencial (detectado automáticamente desde
eventos de calendario: si el evento tiene "Ubicación" rellena o contiene la
palabra "presencial", se clasifica como examen o tutoría por palabras clave
configurables), diploma disponible (30 días tras fin de curso), y tareas de
primer/segundo día. Multilenguaje es/ca/en, con placeholders `{{var}}` en
las plantillas y modo de email combinado (es+ca en un solo correo).

### Bugs/riesgos encontrados (ordenados por gravedad)
1. **Crítico — el plugin no arranca**: `version.php` línea 25 tiene una URL
   suelta fuera de cualquier comentario → error de sintaxis PHP fatal. Hay
   que corregirlo *antes* de instalar el plugin en ninguna plataforma nueva.
2. **Alto — incumplimiento GDPR/LOPD**: el proveedor de privacidad solo
   declara qué guarda, no implementa exportación ni borrado real. Los
   registros de notificaciones de un alumno sobreviven a un borrado GDPR vía
   la herramienta de privacidad de Moodle.
3. **Alto — sin ruta de actualización**: no existe `db/upgrade.php`; con el
   plugin ya en v2.9.0, actualizar una instalación existente es frágil.
4. **Alto — bug de negocio**: el email de "diploma disponible" se envía a
   TODOS los matriculados activos a los 30 días **sin comprobar si aprobaron
   o completaron el curso**, pese a que el nombre de la tarea sugiere que sí.
5. **Medio — pérdida silenciosa de notificaciones**: varias tareas
   (segundo día, fin de curso, último día, diploma automático) usan ventanas
   de fecha exactas de un solo día; si el cron se detiene un día, esa
   notificación se pierde para siempre, sin alerta ni recuperación.
6. **Medio — el modo de email por defecto (combinado es+ca) no tiene manejo
   de errores**: una excepción ahí puede abortar el resto de una ejecución
   de cron completa en vez de fallar solo para ese alumno.
7. **Medio — rendimiento N+1**: las 9 tareas repiten 2 consultas SQL por
   curso sobre TODOS los cursos del sitio, en vez de reutilizar el patrón
   eficiente que el propio plugin ya tiene en otro archivo.
8. Hallazgos menores: código muerto (hook de navegación nunca activado),
   una tabla de base de datos creada pero nunca usada, duplicación de
   código extensa entre las 9 tareas casi idénticas, documentación
   desactualizada, y descuidos cosméticos.

**Lo positivo**: todas las consultas SQL están correctamente parametrizadas
(sin inyección SQL en ningún archivo), el sistema de deduplicación de envíos
está bien diseñado, y el informe de diagnóstico interno (`report.php`) es
sólido — su lógica de "por qué algo está pendiente/perdido" es un buen punto
de partida conceptual para el nuevo panel en Moodle Insights.

---

## 2. Arquitectura propuesta

### Principio: Moodle sigue enviando los emails; el dashboard decide qué y cómo

Los emails **tienen** que seguir saliendo desde cada Moodle (solo Moodle
conoce en tiempo real el progreso de completado, las matrículas, el email
preferido y el idioma de cada alumno, y solo Moodle puede usar
`email_to_user()` con su propio motor de correo/SMTP configurado). Lo que
se centraliza es **todo lo demás**: qué disparadores existen, qué plantilla
usa cada uno, sus parámetros (umbrales, días de antelación, palabras clave),
y el registro de qué se envió.

```
┌─────────────────────────┐         ┌──────────────────────────────┐
│   Moodle Insights        │         │   Cada plataforma Moodle      │
│   (NestJS + Postgres)     │         │   (plugin local_             │
│                           │         │    courseprogressnotify)      │
│  - Catálogo de            │  GET    │                                │
│    disparadores           │◄────────│  Cron (igual que hoy, 9       │
│  - Plantillas de email    │  config │  tareas) pide su config        │
│    (CRUD, parametrizable) │────────►│  vigente antes de evaluar      │
│  - Asociación             │         │  condiciones                   │
│    disparador↔plantilla   │         │                                │
│    (global o por curso)   │         │  Sigue calculando progreso/    │
│  - Seguimiento de envíos  │  POST   │  fechas localmente (con datos  │
│    (nuevo log central)    │◄────────│  que solo Moodle tiene) y      │
│                           │  log    │  llamando a email_to_user()    │
└─────────────────────────┘         └──────────────────────────────┘
```

### Autenticación plugin → dashboard

Se reutiliza el concepto de token ya existente (`Platform.token`), pero en
**dirección inversa** y con **credencial propia**: hoy el token de cada
plataforma sirve para que *nuestra app* llame al *Web Service de Moodle*.
Para notificaciones necesitamos lo contrario: que el *plugin dentro de
Moodle* llame a *nuestra API*. Se propone:

- Nuevo campo `Platform.notificationsApiKey` (generado por nuestra app,
  mostrado una sola vez en Configuración → Plataformas, igual que un token
  de API normal — random, hasheado en BD, revocable).
- El plugin, en su única pantalla de configuración restante ("Conexión"),
  solo pide: **URL de Moodle Insights** + **esa API key**. Nada más — ni
  campo personalizado, ni keywords, ni días de antelación, ni modo
  combinado: todo eso se elimina del plugin y pasa a vivir en nuestra BD.
- No hace falta un plugin-proxy adicional ni tocar el Web Service estándar
  de Moodle: es una llamada HTTP normal del plugin hacia un endpoint REST
  nuestro, autenticada con esa API key en un header (`Authorization: Bearer
  <key>`), igual de simple que cualquier integración webhook.

### Nuevo módulo en el backend (NestJS + Prisma)

Tablas nuevas (nombres tentativos):
- `NotificationTrigger` — catálogo de disparadores disponibles (progreso 25/
  50/75%, fin de curso, Zoom, presencial examen/tutoría, diploma, primer/
  segundo día, nuevo: actividad pendiente de evaluar para el instructor,
  evaluación próxima). Cada uno con su tipo de parámetros esperados (umbral,
  días de antelación, etc.), a favor de que en el futuro se añadan más sin
  tocar el plugin.
- `NotificationTemplate` — plantillas de email (asunto + cuerpo HTML con
  placeholders `{{var}}`, por idioma), editables desde el dashboard con
  vista previa, versionadas (para poder revertir un cambio de plantilla).
- `NotificationRule` — asocia un `NotificationTrigger` con una
  `NotificationTemplate`, con alcance global o por plataforma/curso, y sus
  parámetros concretos (ej. "progreso 25%" con la plantilla X, activo en
  todas las plataformas salvo Y).
- `NotificationDeliveryLog` — reemplaza/centraliza el log que hoy vive
  aislado en cada Moodle: quién recibió qué, cuándo, desde qué plataforma,
  éxito/fallo — visible en un único panel para las 24 plataformas juntas,
  algo que hoy es literalmente imposible sin entrar plataforma por
  plataforma.

Endpoints nuevos, expuestos bajo un prefijo propio (ej. `/api/notifications/
plugin/*`) protegidos por la `notificationsApiKey` del plugin (no por el
login de usuario normal, ya que quien llama es el cron de Moodle, no una
persona):
- `GET /notifications/plugin/config` — el plugin lo llama al arrancar cada
  tarea cron; devuelve las reglas activas relevantes con su plantilla ya
  resuelta (placeholders sin reemplazar, eso lo sigue haciendo el plugin
  con los datos reales del alumno/curso que solo él tiene).
- `POST /notifications/plugin/log` — el plugin reporta cada envío (éxito o
  fallo) inmediatamente después de intentarlo.

Y endpoints normales (protegidos por sesión de admin, como el resto del
dashboard) para la pestaña nueva del frontend: CRUD de plantillas, CRUD de
reglas/asociaciones, y consulta del log centralizado con filtros.

### Nueva pestaña en el frontend: "Gestión de Notificaciones"

Dentro de "Moodle Insights" (junto a Dashboard y Cursos y Alumnos), con
al menos:
- **Disparadores**: lista de los disponibles, activar/desactivar por
  plataforma, configurar sus parámetros (umbral de progreso, días de
  antelación, palabras clave de detección presencial).
- **Plantillas**: editor de asunto/cuerpo con lista de placeholders
  disponibles por tipo de disparador, vista previa con datos de ejemplo
  (como las capturas que mandaste), por idioma.
- **Seguimiento**: tabla de envíos (quién, qué, cuándo, plataforma, estado),
  filtrable — heredera directa del ya sólido `report.php` del plugin actual,
  pero agregando las 24 plataformas en un solo sitio en vez de una por una.

### Cambios en el plugin de Moodle

Se elimina: `settings.php` casi por completo (solo queda URL + API key),
`courses.php` y `classes/admin_setting_diploma_only_courses.php` (esa
gestión pasa al dashboard), toda la lógica de "modo combinado"/keywords
como configuración local (pasan a venir por API).

Se mantiene: las 9 (pronto más) `scheduled_task`, `progress_calculator`,
`presential_provider` (detección en sí, porque necesita datos de Moodle),
`zoom_provider`, `email_builder` (adaptado para recibir la plantilla ya
resuelta desde la API en vez de leerla de `lang/`).

Se añade: un pequeño cliente HTTP (`classes/insights_client.php`) que
resuelve la config al inicio de cada tarea y reporta el log al final.

---

## 3. Plan por fases (empezar por 25/50/75%)

**Fase 0 — antes de tocar nada de esto**: corregir el bug crítico de
`version.php` en el plugin actual (sin esto no se puede ni instalar en una
plataforma de prueba).

**Fase 1 — MVP centrado en progreso (25/50/75%)**:
1. Backend: tablas `NotificationTrigger`/`NotificationTemplate`/
   `NotificationRule`/`NotificationDeliveryLog` + migración Prisma.
2. Backend: endpoints `GET config` / `POST log` protegidos por API key, y
   los endpoints de administración (CRUD plantillas/reglas) para el
   frontend.
3. Backend: campo `notificationsApiKey` en `Platform` + generación/rotación
   desde Configuración.
4. Frontend: pestaña "Gestión de Notificaciones" con CRUD de plantillas y
   reglas para los 3 disparadores de progreso (25/50/75% — el 75% es nuevo,
   no existe todavía en el plugin actual).
5. Plugin: adaptar `check_progress_25`/`50` + nueva `check_progress_75`
   para llamar a la API en vez de leer config/plantillas locales; probar
   contra UNA plataforma de prueba antes de desplegar a las demás.

**Fase 2 — resto de disparadores de alumno**: fin de curso, último día,
Zoom, presencial, diploma (corrigiendo de paso el bug de "no verifica
aprobación"), primer/segundo día — migrándolos uno a uno al mismo patrón.

**Fase 3 — disparadores nuevos pedidos por el instructor**: aviso al
instructor cuando tiene una actividad pendiente de calificar, aviso de
evaluación próxima. Estos son conceptualmente nuevos (no existen en el
plugin actual) y requieren decidir con el instructor qué evento de Moodle
los dispara exactamente.

**Fase 4 — limpieza**: retirar del plugin todo lo que ya quedó obsoleto
(`courses.php`, `admin_setting_diploma_only_courses.php`, settings locales),
y aprovechar para corregir los hallazgos altos de la auditoría (privacy
provider, `db/upgrade.php`) ya que se va a tocar el plugin de todas formas.

---

## 4. Decisiones pendientes de confirmar con el instructor

- ~~¿La `notificationsApiKey` es una credencial nueva y separada del token
  de Web Service que ya existe por plataforma, o se reutiliza el mismo
  campo `token`?~~ **Resuelto: credencial nueva y separada.** El token de
  Web Service que ya tenemos autentica llamadas nuestras hacia el endpoint
  estándar de Moodle (`webservice/rest/server.php`) — es una credencial del
  protocolo propio de Moodle, en la dirección nosotros→Moodle, sin ninguna
  validez para autenticar contra nuestra propia API. No hace falta ningún
  plugin-proxy adicional tampoco: Moodle ya trae de fábrica una clase
  `curl` (`lib/filelib.php`) que cualquier plugin puede usar para hacer
  peticiones HTTP salientes normales; el propio `courseprogressnotify`
  solo necesita añadir dos llamadas HTTP (antes y después de cada tarea
  cron) usando esa clase y la nueva `notificationsApiKey` como
  `Authorization: Bearer`. Un único contrato genérico
  (`GET .../config` + `POST .../log`) cubre los 9 tipos de email sin
  excepción, porque todos siguen el mismo patrón (evaluar localmente con
  datos de Moodle → pedir plantilla → enviar → reportar).
- ¿Las plantillas deben poder personalizarse por plataforma/curso, o son
  siempre globales para toda la organización? (Afecta el diseño de
  `NotificationRule`.)
- ¿Qué evento exacto de Moodle debe disparar el aviso "instructor tiene una
  actividad pendiente de calificar" (Fase 3) — cualquier entrega nueva, o
  solo tras X horas sin calificar?
- ¿Se conserva el modo de email combinado (es+ca) como lo tiene hoy el
  plugin, o el dashboard permite configurar el idioma por plantilla/regla?

---

*Este documento es un plan de arquitectura, no una implementación. El
código del plugin auditado permanece intacto (no se modificó nada) en
`courseprogressnotify v2.9.0 1/courseprogressnotify`. Próximo paso sugerido:
confirmar las decisiones pendientes arriba y empezar por la Fase 0 (fix
crítico) + Fase 1 (progreso 25/50/75%).*
