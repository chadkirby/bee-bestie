// src/components/galaxy/types.ts

export type PointType = 'ANSWER' | 'EXILE';

export interface GalaxyPoint {
  id: string; // Unique ID for React keys
  word: string;
  type: PointType;
  // The index (0-6) of the letter this word starts with based on your sorted letter array
  sliceIndex: number;
  length: number;     // Maps to Radius (Rho)
  score: number;      // Maps to Angle Jitter (Theta) (-1.5 to -5.0ish)
}

export interface CalculatedCoords {
  x: number;
  y: number;
  color: string;
  radius: number;
}
