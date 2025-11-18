import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getBeeScore(word: string): number {
  const length = word.length;
  if (length <= 4) return 1;
  const uniqLetters = new Set(word).size;
  if (uniqLetters >= 7) return word.length + 7;
  return word.length;
}
