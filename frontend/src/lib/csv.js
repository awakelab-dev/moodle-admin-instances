function escapeCsvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[";\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

// Descarga un CSV (se abre directamente en Excel) a partir de una matriz de
// filas — la primera fila debe ser la cabecera. Se usa ";" como separador
// porque Excel en español usa "," como separador decimal y por tanto espera
// ";" como separador de columnas al importar CSV (si se usa "," aquí, Excel
// mete cada fila entera en una sola celda). Se añade un BOM UTF-8 para que
// Excel muestre bien tildes/ñ en vez de caracteres corruptos.
export function downloadCsv(filename, rows) {
  const csvContent = rows.map((row) => row.map(escapeCsvCell).join(';')).join('\r\n');
  const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
