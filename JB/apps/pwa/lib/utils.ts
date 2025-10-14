import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const spacingUnit = 8;

export function spacing(multiplier: number) {
  return `${(spacingUnit * multiplier) / 16}rem`;
}
