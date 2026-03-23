import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMeasurementType(type: string, value: number) {
  switch (type) {
    case 'reps': return `${value} reps`;
    case 'seconds': return `${value}s`;
    case 'meters': return `${value}m`;
    default: return `${value}`;
  }
}
