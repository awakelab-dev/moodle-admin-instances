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
//
// Cada uno de los 4 diseños tiene variante clara y oscura, elegible por el
// admin de la plataforma — NO es una adaptación automática al cliente de
// correo del destinatario: eso se investigó a fondo (Gmail no soporta
// prefers-color-scheme en absoluto, Outlook es inconsistente según build)
// y no hay forma fiable de hacerlo. El tema se fuerza por plataforma, como
// el propio diseño.

export type EmailTheme = 'dark' | 'light';

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

// ───────────────────────── A · Clásico corporativo ─────────────────────────

async function headerClassic(platformName: string, theme: EmailTheme): Promise<Buffer> {
  const tag = escapeHtml(truncate(platformName, 48));
  const initials = escapeHtml(initialsFor(platformName));
  const h = 136;
  const bg = theme === 'light' ? '#EEF1F8' : '#0F1A2E';
  const logoBg = theme === 'light' ? '#0B93AA' : '#0FCED3';
  const logoText = theme === 'light' ? '#ffffff' : '#04222A';
  const tagColor = theme === 'light' ? '#6B7488' : '#7E8AA8';
  const bar = theme === 'light' ? '#0B93AA' : '#0FCED3';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${h}">
    <rect width="${WIDTH}" height="132" fill="${bg}"/>
    <rect x="275" y="24" width="50" height="50" rx="12" fill="${logoBg}"/>
    <text x="300" y="56" text-anchor="middle" font-family="${FONT}" font-size="18" font-weight="800" fill="${logoText}">${initials}</text>
    <text x="300" y="100" text-anchor="middle" font-family="${FONT}" font-size="11" font-weight="700" letter-spacing="1.5" fill="${tagColor}">${tag.toUpperCase()}</text>
    <rect y="132" width="${WIDTH}" height="4" fill="${bar}"/>
  </svg>`;
  return svgToPng(svg, WIDTH, h);
}

async function footerClassic(platformName: string, theme: EmailTheme): Promise<Buffer> {
  const name = escapeHtml(truncate(platformName, 60));
  const h = 90;
  const bg = theme === 'light' ? '#EEF1F8' : '#0F1A2E';
  const line = theme === 'light' ? '#D7DBEE' : '#223252';
  const text = theme === 'light' ? '#6B7488' : '#5A6684';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${h}">
    <rect width="${WIDTH}" height="${h}" fill="${bg}"/>
    <rect width="${WIDTH}" height="1" fill="${line}"/>
    <text x="300" y="36" text-anchor="middle" font-family="${FONT}" font-size="11" fill="${text}">${name}</text>
    <text x="300" y="58" text-anchor="middle" font-family="${FONT}" font-size="11" fill="${text}">Has recibido este mensaje porque figuras como alumno/a en esta plataforma.</text>
  </svg>`;
  return svgToPng(svg, WIDTH, h);
}

// ───────────────────────── B · Oscuro moderno ─────────────────────────

async function headerDarkModern(platformName: string, theme: EmailTheme): Promise<Buffer> {
  const name = escapeHtml(truncate(platformName, 48));
  const initials = escapeHtml(initialsFor(platformName));
  const h = 90;
  const bg = theme === 'light' ? '#FFFFFF' : '#0D1526';
  const logoBg = theme === 'light' ? '#0B93AA' : '#15F0E0';
  const logoText = theme === 'light' ? '#ffffff' : '#04222A';
  const brand = theme === 'light' ? '#1B2333' : '#F2F6FF';
  const bar = theme === 'light' ? '#0B93AA' : '#15F0E0';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${h}">
    <rect width="${WIDTH}" height="${h}" fill="${bg}"/>
    <rect x="28" y="28" width="38" height="38" rx="10" fill="${logoBg}"/>
    <text x="47" y="52" text-anchor="middle" font-family="${FONT}" font-size="14" font-weight="800" fill="${logoText}">${initials}</text>
    <text x="78" y="52" font-family="${FONT}" font-size="16" font-weight="700" fill="${brand}">${name}</text>
    <rect x="28" y="76" width="544" height="3" rx="1.5" fill="${bar}" opacity="${theme === 'light' ? '0.7' : '0.5'}"/>
  </svg>`;
  return svgToPng(svg, WIDTH, h);
}

async function footerDarkModern(platformName: string, theme: EmailTheme): Promise<Buffer> {
  const name = escapeHtml(truncate(platformName, 60));
  const h = 56;
  const bg = theme === 'light' ? '#FFFFFF' : '#0D1526';
  const line = theme === 'light' ? '#EDEEF2' : '#1C2944';
  const text = theme === 'light' ? '#9096A3' : '#5A6684';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${h}">
    <rect width="${WIDTH}" height="${h}" fill="${bg}"/>
    <rect width="${WIDTH}" height="1" fill="${line}"/>
    <text x="28" y="34" font-family="${FONT}" font-size="11" fill="${text}">${name}</text>
  </svg>`;
  return svgToPng(svg, WIDTH, h);
}

// ───────────────────────── D · Bloque de color ─────────────────────────
// El bloque de color de marca (#0B93AA) se mantiene en los dos temas — lo
// que cambia es el cuerpo/tarjetas alrededor, no la cabecera en sí.

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

async function footerColorBlock(platformName: string, theme: EmailTheme): Promise<Buffer> {
  const name = escapeHtml(truncate(platformName, 60));
  const h = 56;
  const bg = theme === 'light' ? '#0B93AA' : '#072026';
  const text = theme === 'light' ? '#D9FBFF' : '#7FE3DA';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${h}">
    <rect width="${WIDTH}" height="${h}" fill="${bg}"/>
    <text x="300" y="34" text-anchor="middle" font-family="${FONT}" font-size="11" fill="${text}">${name}</text>
  </svg>`;
  return svgToPng(svg, WIDTH, h);
}

// ───────────────────────── E · Editorial con franja ─────────────────────────
// El degradado de marca se mantiene en los dos temas (es la seña de
// identidad del diseño); lo que cambia es el cuerpo alrededor.
//
// El asunto NO se incrusta aquí a propósito (antes se rasterizaba dentro
// de esta imagen): en el momento en que se genera esta imagen, el asunto
// todavía puede contener {{placeholders}} sin resolver (eso lo hace el
// plugin de Moodle después, con una sustitución de texto sobre el HTML
// final) — una vez convertido en PNG, un "{{coursename}}" sin resolver se
// queda ahí para siempre. El "asunto como titular" de este diseño se
// muestra como texto HTML normal en editorial.ts, no aquí, para que el
// plugin sí pueda sustituirlo con normalidad.

async function headerEditorial(platformName: string): Promise<Buffer> {
  const tag = escapeHtml(truncate(platformName, 48));
  const h = 70;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${h}">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0B2545"/>
        <stop offset="100%" stop-color="#0FCED3"/>
      </linearGradient>
    </defs>
    <rect width="${WIDTH}" height="${h}" fill="url(#g)"/>
    <text x="300" y="42" text-anchor="middle" font-family="${FONT}" font-size="12" font-weight="700" letter-spacing="1.5" fill="#ffffff">${tag.toUpperCase()}</text>
  </svg>`;
  return svgToPng(svg, WIDTH, h);
}

async function footerEditorial(platformName: string, theme: EmailTheme): Promise<Buffer> {
  return footerDarkModern(platformName, theme);
}

// ───────────────────────── Registro por diseño+tema ─────────────────────────

// Una entrada por diseño+tema: genera {header, footer} ya como PNG + los
// nombres de cid que el HTML del diseño debe referenciar.
export async function buildDesignImages(
  designKey: string,
  theme: EmailTheme,
  platformName: string,
): Promise<{ headerCid: string; footerCid: string; images: EmailImage[] }> {
  const headerCid = `op_header_${designKey}_${theme}`;
  const footerCid = `op_footer_${designKey}_${theme}`;

  let header: Buffer;
  let footer: Buffer;
  switch (designKey) {
    case 'B':
      header = await headerDarkModern(platformName, theme);
      footer = await footerDarkModern(platformName, theme);
      break;
    case 'D':
      header = await headerColorBlock(platformName);
      footer = await footerColorBlock(platformName, theme);
      break;
    case 'E':
      header = await headerEditorial(platformName);
      footer = await footerEditorial(platformName, theme);
      break;
    case 'A':
    default:
      header = await headerClassic(platformName, theme);
      footer = await footerClassic(platformName, theme);
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
