import type { EmailDesignRenderer, EmailDesignInput, EmailDesignResult } from './types';
import { classicDesign } from './classic';
import { darkModernDesign } from './darkModern';
import { colorBlockDesign } from './colorBlock';
import { editorialDesign } from './editorial';

export type { EmailDesignInput, EmailDesignResult, EmailDesignImage } from './types';

// Las 4 plantillas aprobadas por el instructor (ver boceto compartido).
// Solo se editan aquí, por código — no hay editor visual de diseño (ver
// decisión de producto: los usuarios eligen entre estas, nunca las crean).
export const EMAIL_DESIGNS: Record<string, EmailDesignRenderer> = {
  A: classicDesign,
  B: darkModernDesign,
  D: colorBlockDesign,
  E: editorialDesign,
};

export const DEFAULT_EMAIL_DESIGN_KEY = 'A';

export function renderEmailDesign(designKey: string | undefined, input: EmailDesignInput): Promise<EmailDesignResult> {
  const renderer = (designKey && EMAIL_DESIGNS[designKey]) || EMAIL_DESIGNS[DEFAULT_EMAIL_DESIGN_KEY];
  return renderer(input);
}
