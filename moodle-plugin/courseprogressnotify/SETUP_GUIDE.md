# Notificaciones de Progreso de Curso - Guía de Configuración

## ¿Qué hace este plugin?

Este plugin envía automáticamente notificaciones por correo electrónico a los estudiantes cuando alcanzan hitos importantes en sus cursos:
- Progreso del 25% y 50% completado
- Curso finalizando en 7 días
- Último día del curso
- Sesiones de Zoom próximas
- Sesiones presenciales (exámenes, tutorías)
- Diploma disponible (30 días después de finalizar el curso)
- Recordatorios del primer y segundo día

## Instrucciones de Configuración

### Paso 1: Crear el Campo Personalizado

1. Ve a **Administración del sitio** → **Cursos** → **Campos personalizados del curso**
2. Haz clic en **"Agregar una nueva categoría"** (si aún no tienes una) o usa una categoría existente
3. Haz clic en **"Agregar un nuevo campo personalizado"** → **Casilla de verificación**
4. Completa:
   - **Nombre**: `Habilitar notificaciones por correo` (o similar)
   - **Nombre corto**: `courseemailnotifications_enabled` (exactamente así)
5. Haz clic en **"Guardar cambios"**

### Paso 2: Configurar el Plugin

1. Ve a **Administración del sitio** → **Plugins** → **Plugins locales** → **Notificaciones de progreso de curso**
2. En **"Nombre corto del campo personalizado"**, ingresa: `courseemailnotifications_enabled`
3. Ajusta otras configuraciones si es necesario:
   - **Días antes para la invitación Zoom**: Cuántos días antes de una sesión Zoom enviar recordatorios (predeterminado: 2)
   - **Días antes para sesiones presenciales**: Cuántos días antes de exámenes/tutorías enviar recordatorios (predeterminado: 2)
4. Haz clic en **"Guardar cambios"**

### Paso 3: Habilitar Notificaciones para un Curso

1. Ve a cualquier curso
2. Haz clic en **"Editar ajustes"**
3. Desplázate hacia abajo para encontrar la casilla **"Habilitar notificaciones por correo"**
4. **Marca la casilla** para habilitar notificaciones para este curso
5. Haz clic en **"Guardar cambios y mostrar"**

## Cómo Usar

### Modo Automático
Una vez configurado, el plugin se ejecuta automáticamente en horarios programados y envía correos a los estudiantes que cumplan los criterios.

### Pruebas Manuales
Para probar notificaciones inmediatamente:

1. Ve a **Administración del sitio** → **Plugins** → **Plugins locales** → **Notificaciones de progreso de curso**
2. Haz clic en **"Verificar Notificaciones Ahora"**
3. Elige qué tipo de notificación quieres probar
4. Haz clic en el botón correspondiente

## Notas Importantes

- Solo los cursos con la **casilla habilitada** enviarán notificaciones
- Los estudiantes recibirán cada notificación **solo una vez** (sin duplicados)
- El plugin respeta la configuración de zona horaria de los estudiantes para fechas/horas
- Las notificaciones se envían solo a estudiantes activos y matriculados

## Solución de Problemas

**Advertencia "No hay un campo personalizado configurado"**
- Asegúrate de haber creado el campo personalizado con el nombre corto exacto: `courseemailnotifications_enabled`
- Verifica que ingresaste este nombre corto en la configuración del plugin

**Los estudiantes no reciben correos**
- Verifica que la casilla esté habilitada en la configuración del curso
- Comprueba que los estudiantes estén matriculados activamente (no suspendidos)
- Confirma que el seguimiento de finalización del curso esté habilitado (para notificaciones de progreso)

**No se encuentran cursos al hacer pruebas**
- Habilita la casilla en al menos un curso
- Para notificaciones de progreso: asegúrate de que el curso tenga el seguimiento de finalización habilitado

## Soporte

Para problemas técnicos, revisa los registros del plugin:
- **Administración del sitio** → **Servidor** → **Registros**
