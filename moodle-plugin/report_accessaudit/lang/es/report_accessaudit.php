<?php
defined('MOODLE_INTERNAL') || die();

// Strings originais
$string['pluginname']         = 'Auditoría de Acceso';
$string['accessaudit:view']   = 'Ver auditoría de acceso';
$string['pagetitle']          = 'Auditoría de Acceso de Usuarios';
$string['username']           = 'Usuario';
$string['fullname']           = 'Nombre completo';
$string['email']              = 'Correo';
$string['access']             = 'Acceso';
$string['ip']                 = 'IP';
$string['city']               = 'Ciudad';
$string['region']             = 'Estado/Región';
$string['country']            = 'País';
$string['datetime']           = 'Fecha y hora';
$string['suspicious']         = '⚠️ Sospechoso';
$string['normal']             = 'Normal';
$string['filter_suspicious']  = 'Solo sospechosos';
$string['filter_all']         = 'Todos';
$string['no_records']         = 'No hay registros de acceso aún.';
$string['locations_detected'] = 'Ubicaciones detectadas';

// Pestañas
$string['tab_locations'] = 'Ubicaciones de login';
$string['tab_patterns']  = 'Patrones de compartición';

// Patrones
$string['analyze_now']          = 'Analizar ahora';
$string['analyze_hint']         = 'El análisis se ejecuta automáticamente cada noche a las 03:00. Para cambiar el horario: Administración del sitio → Servidor → Tareas programadas.';
$string['analyze_done']         = 'Análisis completado: {$a->patterns} patrones encontrados en {$a->courses} cursos analizados.';
$string['no_patterns_yet']      = 'Aún no se ha ejecutado ningún análisis. Haz clic en "Analizar ahora" para comenzar.';
$string['no_patterns_filtered'] = 'Ningún patrón coincide con el filtro seleccionado.';
$string['last_analysis']        = 'Último análisis';
$string['pattern_type']         = 'Patrón';
$string['pattern_sequential']   = 'Secuencial';
$string['pattern_simultaneous'] = 'Simultáneo';
$string['pattern_both']         = 'Secuencial + Simultáneo';
$string['students_count']       = 'Alumnos (tiempo promedio/recurso)';
$string['risk_level']           = 'Riesgo';
$string['risk_high']            = 'Alto';
$string['risk_medium']          = 'Medio';
$string['risk_low']             = 'Bajo';
$string['detail']               = 'Detectado en';

// Tarea programada
$string['task_analyze']         = 'Analizar patrones de acceso sospechosos';
$string['no_patterns_yet']      = 'Aún no se ha ejecutado ningún análisis. El reporte corre automáticamente cada noche a las 03:00.';
