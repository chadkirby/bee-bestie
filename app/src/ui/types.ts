import { DateTime } from 'luxon';
import type { SortKey } from '@/components/WordExplorer';

/**
 * Shared type definitions for the Spelling Bee companion application.
 * This file serves as the single source of truth for common interfaces.
 */

export interface ExposureConfig {
  showAll?: true;
  startingLetters: number;
  endingLetters: number;
}

// Callback function types
export type OnLettersToExposeChange = (config: ExposureConfig) => void;
export type OnChangeSortBy = (sortBy: SortKey) => void;
export type OnToggleSortDirection = () => void;
export type OnDateChange = (date: DateTime) => void;