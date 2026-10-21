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

export type EmailDesignRenderer = (input: EmailDesignInput) => string;
