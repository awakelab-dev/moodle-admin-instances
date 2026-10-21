import type { EmailDesignRenderer } from './types';
import { escapeHtml, inlineContentStyles } from './helpers';
import { buildDesignImages } from './assets';

// Diseño B — "Oscuro moderno". Mismo enfoque que A (ver comentario
// completo en classic.ts): cabecera y pie como imagen vía cid:.
export const darkModernDesign: EmailDesignRenderer = async ({ platformName, subject, bodyHtml }) => {
  const { headerCid, footerCid, images } = await buildDesignImages('B', platformName, subject);
  const content = inlineContentStyles(bodyHtml, { text: '#B7C0DE', strong: '#ffffff', link: '#7FE3DA' });
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#080D18;" bgcolor="#080D18">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#080D18" style="background-color:#080D18;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
  <tr><td><img src="cid:${headerCid}" width="600" style="display:block;width:100%;max-width:600px;" alt="${escapeHtml(platformName)}"></td></tr>
  <tr>
    <td bgcolor="#0D1526" style="background-color:#0D1526;padding:20px 28px 8px;font-family:Arial,sans-serif;">${content}</td>
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
