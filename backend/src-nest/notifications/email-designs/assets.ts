import sharp from 'sharp';
import { initialsFor, escapeHtml } from './helpers';

// Cabecera y pie de cada diseño se generan como PNG (no como color CSS) a
// propósito: es la única forma de que el color salga EXACTO en Outlook de
// escritorio y Outlook.com/nuevo Outlook, que recolorean automáticamente
// cualquier fondo puesto por CSS/bgcolor (confirmado contra el correo real
// — ver historial de pruebas). El bloque de texto del medio sigue siendo
// HTML normal porque su alto cambia según el contenido, así que no se
// puede convertir en imagen de forma práctica.
//
// Se generan con sharp + SVG (no con un navegador) para no depender de
// tener Chrome instalado en el servidor de producción — a cambio, el texto
// usa una tipografía genérica del sistema en vez de Poppins (Poppins solo
// se puede cargar vía Google Fonts en HTML normal, no aquí).

export interface EmailImage {
  cid: string;
  filename: string;
  base64: string;
}

const FONT = "-apple-system, 'Segoe UI', Arial, sans-serif";
const WIDTH = 600;

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text;
}

async function svgToPng(svg: string, width: number, height: number): Promise<Buffer> {
  return sharp(Buffer.from(svg), { density: 192 }).resize(width * 2, height * 2).png().toBuffer();
}

async function headerClassic(platformName: string): Promise<Buffer> {
  const tag = escapeHtml(truncate(platformName, 48));
  const initials = escapeHtml(initialsFor(platformName));
  const h = 136;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${h}">
    <rect width="${WIDTH}" height="132" fill="#0F1A2E"/>
    <rect x="275" y="24" width="50" height="50" rx="12" fill="#0FCED3"/>
    <text x="300" y="56" text-anchor="middle" font-family="${FONT}" font-size="18" font-weight="800" fill="#04222A">${initials}</text>
    <text x="300" y="100" text-anchor="middle" font-family="${FONT}" font-size="11" font-weight="700" letter-spacing="1.5" fill="#7E8AA8">${tag.toUpperCase()}</text>
    <rect y="132" width="${WIDTH}" height="4" fill="#0FCED3"/>
  </svg>`;
  return svgToPng(svg, WIDTH, h);
}

async function footerClassic(platformName: string): Promise<Buffer> {
  const name = escapeHtml(truncate(platformName, 60));
  const h = 90;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${h}">
    <rect width="${WIDTH}" height="${h}" fill="#0F1A2E"/>
    <rect width="${WIDTH}" height="1" fill="#223252"/>
    <text x="300" y="36" text-anchor="middle" font-family="${FONT}" font-size="11" fill="#5A6684">${name}</text>
    <text x="300" y="58" text-anchor="middle" font-family="${FONT}" font-size="11" fill="#5A6684">Has recibido este mensaje porque figuras como alumno/a en esta plataforma.</text>
  </svg>`;
  return svgToPng(svg, WIDTH, h);
}

async function headerDarkModern(platformName: string): Promise<Buffer> {
  const name = escapeHtml(truncate(platformName, 48));
  const initials = escapeHtml(initialsFor(platformName));
  const h = 90;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${h}">
    <rect width="${WIDTH}" height="${h}" fill="#0D1526"/>
    <rect x="28" y="28" width="38" height="38" rx="10" fill="#15F0E0"/>
    <text x="47" y="52" text-anchor="middle" font-family="${FONT}" font-size="14" font-weight="800" fill="#04222A">${initials}</text>
    <text x="78" y="52" font-family="${FONT}" font-size="16" font-weight="700" fill="#F2F6FF">${name}</text>
    <rect x="28" y="76" width="544" height="3" rx="1.5" fill="#15F0E0" opacity="0.5"/>
  </svg>`;
  return svgToPng(svg, WIDTH, h);
}

async function footerDarkModern(platformName: string): Promise<Buffer> {
  const name = escapeHtml(truncate(platformName, 60));
  const h = 56;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${h}">
    <rect width="${WIDTH}" height="${h}" fill="#0D1526"/>
    <rect width="${WIDTH}" height="1" fill="#1C2944"/>
    <text x="28" y="34" font-family="${FONT}" font-size="11" fill="#5A6684">${name}</text>
  </svg>`;
  return svgToPng(svg, WIDTH, h);
}

async function headerColorBlock(platformName: string): Promise<Buffer> {
  const tag = escapeHtml(truncate(platformName, 48));
  const initials = escapeHtml(initialsFor(platformName));
  const h = 150;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${h}">
    <rect width="${WIDTH}" height="${h}" fill="#0B93AA"/>
    <circle cx="300" cy="56" r="22" fill="#FFFFFF"/>
    <text x="300" y="62" text-anchor="middle" font-family="${FONT}" font-size="15" font-weight="800" fill="#0B93AA">${initials}</text>
    <text x="300" y="108" text-anchor="middle" font-family="${FONT}" font-size="12" font-weight="700" letter-spacing="0.5" fill="#D9FBFF">${tag.toUpperCase()}</text>
  </svg>`;
  return svgToPng(svg, WIDTH, h);
}

async function footerColorBlock(platformName: string): Promise<Buffer> {
  const name = escapeHtml(truncate(platformName, 60));
  const h = 56;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${h}">
    <rect width="${WIDTH}" height="${h}" fill="#0B93AA"/>
    <text x="300" y="34" text-anchor="middle" font-family="${FONT}" font-size="11" fill="#D9FBFF">${name}</text>
  </svg>`;
  return svgToPng(svg, WIDTH, h);
}

// Parte en máximo 2 líneas por longitud de caracteres — suficiente para un
// asunto de notificación real, no es un ajuste de texto general.
function wrapTwoLines(text: string, maxPerLine = 34): [string, string?] {
  if (text.length <= maxPerLine) return [text];
  const breakAt = text.lastIndexOf(' ', maxPerLine);
  const splitPoint = breakAt > 10 ? breakAt : maxPerLine;
  return [text.slice(0, splitPoint).trim(), truncate(text.slice(splitPoint).trim(), maxPerLine)];
}

async function headerEditorial(platformName: string, subject: string): Promise<Buffer> {
  const tag = escapeHtml(truncate(platformName, 48));
  const lines = wrapTwoLines(escapeHtml(subject), 38);
  const h = lines.length > 1 ? 140 : 110;
  const subjectY = lines.length > 1 ? 74 : 78;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${h}">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0B2545"/>
        <stop offset="100%" stop-color="#0FCED3"/>
      </linearGradient>
    </defs>
    <rect width="${WIDTH}" height="${h}" fill="url(#g)"/>
    <text x="300" y="38" text-anchor="middle" font-family="${FONT}" font-size="11" font-weight="700" letter-spacing="1.5" fill="#BFEFF2">${tag.toUpperCase()}</text>
    <text x="300" y="${subjectY}" text-anchor="middle" font-family="${FONT}" font-size="21" font-weight="800" fill="#ffffff">${lines[0]}</text>
    ${lines[1] ? `<text x="300" y="${subjectY + 28}" text-anchor="middle" font-family="${FONT}" font-size="21" font-weight="800" fill="#ffffff">${lines[1]}</text>` : ''}
  </svg>`;
  return svgToPng(svg, WIDTH, h);
}

async function footerEditorial(platformName: string): Promise<Buffer> {
  return footerDarkModern(platformName);
}

// Una entrada por diseño: genera {header, footer} ya como PNG + los nombres
// de cid que el HTML del diseño debe referenciar.
export async function buildDesignImages(
  designKey: string,
  platformName: string,
  subject: string,
): Promise<{ headerCid: string; footerCid: string; images: EmailImage[] }> {
  const headerCid = `op_header_${designKey}`;
  const footerCid = `op_footer_${designKey}`;

  let header: Buffer;
  let footer: Buffer;
  switch (designKey) {
    case 'B':
      header = await headerDarkModern(platformName);
      footer = await footerDarkModern(platformName);
      break;
    case 'D':
      header = await headerColorBlock(platformName);
      footer = await footerColorBlock(platformName);
      break;
    case 'E':
      header = await headerEditorial(platformName, subject);
      footer = await footerEditorial(platformName);
      break;
    case 'A':
    default:
      header = await headerClassic(platformName);
      footer = await footerClassic(platformName);
      break;
  }

  return {
    headerCid,
    footerCid,
    images: [
      { cid: headerCid, filename: `${headerCid}.png`, base64: header.toString('base64') },
      { cid: footerCid, filename: `${footerCid}.png`, base64: footer.toString('base64') },
    ],
  };
}
