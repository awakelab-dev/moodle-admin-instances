import type { EmailDesignRenderer } from './types';
import { escapeHtml, inlineContentStyles } from './helpers';
import { buildDesignImages } from './assets';

// Diseño E — "Editorial con franja". Mismo enfoque que los demás (ver
// comentario completo en classic.ts) — aquí además resuelve de paso el
// problema del degradado (Outlook no soporta linear-gradient en absoluto):
// al ser una imagen, el degradado sale perfecto en cualquier cliente.
export const editorialDesign: EmailDesignRenderer = async ({ platformName, subject, bodyHtml }) => {
  const { headerCid, footerCid, images } = await buildDesignImages('E', platformName, subject);
  const content = inlineContentStyles(bodyHtml, { text: '#AEB4C4', strong: '#ffffff', link: '#5FE6E0', border: '#1C2944' });
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
    <td bgcolor="#0F1A2E" style="background-color:#0F1A2E;color:#AEB4C4;padding:26px 28px 8px;font-family:Arial,sans-serif;">${content}</td>
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
