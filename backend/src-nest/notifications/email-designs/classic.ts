import type { EmailDesignRenderer } from './types';
import { escapeHtml, inlineContentStyles } from './helpers';
import { buildDesignImages } from './assets';

// Diseño A — "Clásico corporativo". Cabecera y pie son imágenes PNG
// generadas al vuelo (ver assets.ts) e incrustadas con cid: — es la única
// forma confirmada de que el color salga exacto en Outlook de escritorio y
// Outlook.com/nuevo Outlook (ambos recolorean automáticamente cualquier
// fondo CSS, pero no tocan una imagen ya rasterizada). El bloque de texto
// del medio sigue siendo HTML normal porque su alto cambia según el
// contenido — ahí no hay forma práctica de usar una imagen.
export const classicDesign: EmailDesignRenderer = async ({ platformName, subject, bodyHtml }) => {
  const { headerCid, footerCid, images } = await buildDesignImages('A', platformName, subject);
  const content = inlineContentStyles(bodyHtml, { text: '#A9B2CC', strong: '#ffffff', link: '#5FE6E0' });
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#05070C;" bgcolor="#05070C">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#05070C" style="background-color:#05070C;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
  <tr><td><img src="cid:${headerCid}" width="600" style="display:block;width:100%;max-width:600px;" alt="${escapeHtml(platformName)}"></td></tr>
  <tr>
    <td bgcolor="#0F1A2E" style="background-color:#0F1A2E;padding:28px 28px 8px;font-family:Arial,sans-serif;">${content}</td>
  </tr>
  <tr><td><img src="cid:${footerCid}" width="600" style="display:block;width:100%;max-width:600px;" alt="${escapeHtml(platformName)}"></td></tr>
</table>
</td></tr>
</table>
</body>
</html>
`;
  return { html, images };
};
