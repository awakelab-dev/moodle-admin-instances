// Contrato de un "diseño" de email: envuelve el HTML que ya escribió el
// usuario en el editor (TipTap -> p/strong/em/ul/ol/li/a, con los
// {{placeholder}} todavía sin resolver) en una cabecera + pie fijos, sin
// tocar el contenido en sí. La sustitución de {{placeholder}} sigue
// ocurriendo después, en el plugin de Moodle (email_builder.php), sobre el
// HTML final ya combinado — por eso estas funciones no necesitan saber
// nada de placeholders.
export interface EmailDesignInput {
  platformName: string;
  subject: string;
  bodyHtml: string;
}

export interface EmailDesignImage {
  cid: string;
  filename: string;
  // Buffer en base64 — así viaja tal cual en el JSON de
  // GET /api/notifications/plugin/config hasta el plugin de Moodle, que lo
  // decodifica y lo incrusta con addStringEmbeddedImage() (ver
  // email_builder.php). Cabecera y pie van como imagen (no como color
  // CSS/bgcolor) porque es la única forma de que el color salga exacto en
  // Outlook de escritorio y Outlook.com/nuevo Outlook — ambos recolorean
  // automáticamente cualquier fondo puesto por CSS, pero no tocan una
  // imagen ya rasterizada (confirmado contra envíos reales).
  base64: string;
}

export interface EmailDesignResult {
  html: string;
  images: EmailDesignImage[];
}

export type EmailDesignRenderer = (input: EmailDesignInput) => Promise<EmailDesignResult>;
