// Utilidades genéricas compartidas por los componentes del frontend.
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Helper estándar de shadcn/ui: combina clases condicionales (clsx) y
// resuelve conflictos de utilidades Tailwind (twMerge) para que la última
// clase gane sin dejar clases duplicadas/contradictorias.
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const GRUPOASPASIA_SUFFIX = /\s*-\s*grupoaspasia\s*$/i;

// Quita el sufijo "- GrupoAspasia" del nombre de plataforma para mostrarlo
// más limpio en la UI (el dato real en BD conserva el sufijo).
export function formatPlatformDisplayName(name) {
  if (!name) return name;
  return name.replace(GRUPOASPASIA_SUFFIX, '').trim() || name;
}
