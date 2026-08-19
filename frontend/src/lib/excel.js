const HEADER_FILL = 'FF01264C';
const HEADER_FONT = 'FFFFFFFF';
const BORDER_COLOR = 'FFD9D9D9';
const GROUP_BORDER_COLOR = 'FF0FCED3';

// Genera y descarga un .xlsx real (no CSV) con cabecera destacada, columnas
// con ancho fijo (nada de texto cortado) y texto envuelto donde haga falta,
// para que se abra ya legible en Excel sin que el usuario tenga que
// reajustar nada. `groupStartRows` marca, con un borde superior, el primer
// registro de cada bloque (p. ej. cada alumno) cuando una fila lógica ocupa
// varias filas de hoja.
export async function downloadXlsx({ filename, sheetName = 'Hoja1', columns, rows, groupStartRows }) {
  // exceljs pesa bastante (~1MB) — se carga solo al pulsar "Descargar",
  // en vez de venir en el bundle principal del Dashboard.
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  sheet.columns = columns.map((col) => ({
    header: col.header,
    key: col.key,
    width: col.width || 18,
  }));

  rows.forEach((row) => sheet.addRow(row));

  const headerRow = sheet.getRow(1);
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: HEADER_FONT } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  });

  columns.forEach((col, idx) => {
    if (col.wrap) {
      sheet.getColumn(idx + 1).alignment = { wrapText: true, vertical: 'top' };
    }
  });

  const groupStartSet = new Set(groupStartRows || []);
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const isGroupStart = groupStartSet.has(rowNumber);
    row.eachCell((cell) => {
      cell.alignment = { ...cell.alignment, vertical: 'top' };
      cell.border = {
        top: { style: isGroupStart ? 'medium' : 'hair', color: { argb: isGroupStart ? GROUP_BORDER_COLOR : BORDER_COLOR } },
        bottom: { style: 'hair', color: { argb: BORDER_COLOR } },
        left: { style: 'hair', color: { argb: BORDER_COLOR } },
        right: { style: 'hair', color: { argb: BORDER_COLOR } },
      };
    });
  });

  const lastColumnLetter = sheet.getColumn(columns.length).letter;
  sheet.autoFilter = { from: 'A1', to: `${lastColumnLetter}1` };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
