// Iniciales para el badge del logo — las dos primeras palabras del
// nombre de la plataforma ("Catalejo Digital" -> "CD"), o las dos primeras
// letras si solo tiene una palabra ("Sanase" -> "SA").
export function initialsFor(platformName: string): string {
  const words = platformName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '??';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

// Muchos clientes de correo (sobre todo Outlook/Exchange Online) eliminan
// el bloque <style> del <head> por seguridad antes de mostrar el email —
// solo sobreviven los estilos puestos directamente en cada etiqueta como
// atributo style="". Por eso el contenido que escribe el usuario en el
// editor (p/strong/em/ul/ol/li/a sin estilo propio) necesita que le
// inyectemos el color de cada diseño aqui, en vez de confiar en un
// selector CSS tipo ".content p" que puede desaparecer entero.
export interface ContentPalette {
  text: string;
  strong: string;
  link: string;
  // Borde/separador para tablas (p. ej. la tabla de progreso por actividad
  // que genera progress_calculator::build_progress_table_html() — usa
  // clases CSS de Moodle como "generaltable" que no existen en un email,
  // así que sin esto sale con el estilo por defecto del navegador: texto
  // negro sobre fondo oscuro, prácticamente invisible).
  border: string;
}

// Nota: el color base también se pone explícito en el <td> contenedor de
// cada diseño (ver classic.ts, etc.), así que cualquier HTML insertado
// DESPUÉS de esta función (como {{progress_table}}, sustituido en el
// plugin de Moodle, no aquí) lo hereda por CSS sin necesidad de que esta
// función lo conozca. Esto sigue aplicando estilos explícitos además, por
// higiene y por si algún cliente no respeta la herencia.
export function inlineContentStyles(html: string, palette: ContentPalette): string {
  return html
    .replace(
      /<p(\s[^>]*)?>/gi,
      `<p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:${palette.text};">`,
    )
    .replace(/<(strong|b)(\s[^>]*)?>/gi, `<$1 style="color:${palette.strong};">`)
    .replace(/<ul(\s[^>]*)?>/gi, `<ul style="margin:0 0 18px;padding-left:20px;">`)
    .replace(/<ol(\s[^>]*)?>/gi, `<ol style="margin:0 0 18px;padding-left:20px;">`)
    .replace(
      /<li(\s[^>]*)?>/gi,
      `<li style="margin-bottom:8px;font-size:15px;line-height:1.6;color:${palette.text};">`,
    )
    .replace(/<a\s+([^>]*)>/gi, (_match, attrs) => `<a style="color:${palette.link};" ${attrs}>`)
    .replace(
      /<table(\s[^>]*)?>/gi,
      `<table style="width:100%;border-collapse:collapse;margin:0 0 18px;font-size:14px;color:${palette.text};">`,
    )
    .replace(/<thead(\s[^>]*)?>/gi, '<thead>')
    .replace(/<tbody(\s[^>]*)?>/gi, '<tbody>')
    .replace(/<tr(\s[^>]*)?>/gi, '<tr>')
    .replace(
      /<th(\s[^>]*)?>/gi,
      `<th align="left" style="padding:8px 10px;border-bottom:2px solid ${palette.border};color:${palette.strong};font-weight:700;">`,
    )
    .replace(
      /<td(\s[^>]*)?>/gi,
      `<td style="padding:8px 10px;border-bottom:1px solid ${palette.border};color:${palette.text};">`,
    );
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
