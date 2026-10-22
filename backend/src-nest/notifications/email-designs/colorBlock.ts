import type { EmailDesignRenderer } from './types';
import { escapeHtml, inlineContentStyles } from './helpers';
import { buildDesignImages } from './assets';

// Diseño D — "Bloque de color": el único claro por defecto. Mismo enfoque
// que A/B (ver comentario completo en classic.ts).
export const colorBlockDesign: EmailDesignRenderer = async ({ platformName, subject, bodyHtml }) => {
  const { headerCid, footerCid, images } = await buildDesignImages('D', platformName, subject);
  const content = inlineContentStyles(bodyHtml, { text: '#4A5064', strong: '#1B2333', link: '#0B93AA', border: '#E7E9F0' });
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#F3F4F8;" bgcolor="#F3F4F8">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F3F4F8" style="background-color:#F3F4F8;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
  <tr><td><img src="cid:${headerCid}" width="600" style="display:block;width:100%;max-width:600px;" alt="${escapeHtml(platformName)}"></td></tr>
  <tr>
    <td bgcolor="#FFFFFF" style="background-color:#FFFFFF;color:#4A5064;padding:28px 28px 8px;font-family:Arial,sans-serif;">${content}</td>
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
