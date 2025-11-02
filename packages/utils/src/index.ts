import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge class names using tailwind-aware merging.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Base spacing unit (in pixels) used to compute consistent spacing scale.
 */
export const spacingUnit = 8;

/**
 * Generate a spacing value in rems from the base spacing unit.
 */
export function spacing(multiplier: number): string {
  return `${(spacingUnit * multiplier) / 16}rem`;
}
