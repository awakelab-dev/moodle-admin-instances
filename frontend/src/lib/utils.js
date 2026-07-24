import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const GRUPOASPASIA_SUFFIX = /\s*-\s*grupoaspasia\s*$/i;

export function formatPlatformDisplayName(name) {
  if (!name) return name;
  return name.replace(GRUPOASPASIA_SUFFIX, '').trim() || name;
}
