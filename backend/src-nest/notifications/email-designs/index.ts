import type { EmailDesignRenderer, EmailDesignInput, EmailDesignResult } from './types';
import { classicDesign, classicLightDesign } from './classic';
import { darkModernDesign, darkModernLightDesign } from './darkModern';
import { colorBlockDesign, colorBlockDarkDesign } from './colorBlock';
import { editorialDesign, editorialLightDesign } from './editorial';

export type { EmailDesignInput, EmailDesignResult, EmailDesignImage } from './types';
export type { EmailTheme } from './assets';

// Las 4 plantillas aprobadas por el instructor, cada una con variante clara
// y oscura (8 combinaciones en total) — solo se editan aquí, por código, no
// hay editor visual de diseño (ver decisión de producto: los usuarios
// eligen entre estas, nunca las crean). Las claves "A"/"B"/"D"/"E" se
// mantienen tal cual para no romper plataformas que ya tenían un diseño
// guardado antes de que existieran variantes de tema — cada una apunta a
// su tema "natural" de origen (A/B/E nacieron oscuros, D nació claro).
export const EMAIL_DESIGNS: Record<string, EmailDesignRenderer> = {
  A: classicDesign,
  'A-claro': classicLightDesign,
  B: darkModernDesign,
  'B-claro': darkModernLightDesign,
  D: colorBlockDesign,
  'D-oscuro': colorBlockDarkDesign,
  E: editorialDesign,
  'E-claro': editorialLightDesign,
};

export const DEFAULT_EMAIL_DESIGN_KEY = 'A';

export function renderEmailDesign(designKey: string | undefined, input: EmailDesignInput): Promise<EmailDesignResult> {
  const renderer = (designKey && EMAIL_DESIGNS[designKey]) || EMAIL_DESIGNS[DEFAULT_EMAIL_DESIGN_KEY];
  return renderer(input);
}
