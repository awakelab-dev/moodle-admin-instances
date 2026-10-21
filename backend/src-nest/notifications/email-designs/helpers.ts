// Iniciales para el badge del logo — las dos primeras palabras del
// nombre de la plataforma ("Catalejo Digital" -> "CD"), o las dos primeras
// letras si solo tiene una palabra ("Sanase" -> "SA").
export function initialsFor(platformName: string): string {
  const words = platformName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '??';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
