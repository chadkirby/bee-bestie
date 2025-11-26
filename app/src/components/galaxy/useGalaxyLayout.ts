// src/components/galaxy/useGalaxyLayout.ts
import { useMemo } from 'react';
import * as d3 from 'd3';
import { GalaxyPoint, PointType } from './types';

interface LayoutProps {
  width: number;
  height: number;
  data: GalaxyPoint[];
  allData: GalaxyPoint[];
  sortedLetters: string[];
}

// Letter dot: represents a single character position in a word
export interface LetterDot {
  x: number;
  y: number;
  letter: string;
  word: string; // Full word for tooltip
  wordId: string;
  letterIndex: number;
  type: PointType;
  isLeaf: boolean; // True if this is the last letter of the word
  score: number; // For tooltip
  rho: number; // Polar radius
  angle: number; // Polar angle
  parent?: LetterDot;
  children: LetterDot[];
}

// Letter path: represents a line from one letter to the next
export interface LetterPath {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  wordId: string;
  type: PointType;
  rootLetter: string; // The starting letter of the word this path belongs to
}

export const useGalaxyLayout = ({
  width,
  height,
  data,
  allData,
  sortedLetters,
}: LayoutProps) => {
  const centerX = width / 2;
  const centerY = height / 2;
  // Leave padding for tooltips
  const maxRadius = Math.min(width, height) / 2 - 20;
  // varies depending on screen size
  const innerHoleRadius = Math.min(width, height) / 5;

  // --- D3 SCALES ---

  // RHO Scale: Maps word length (e.g., 4 to 9) to distance from center
  // Find actual min/max lengths in data, default to 4-9 if empty
  const lengthExtent = d3.extent(data, (d) => d.length) as [number, number];
  const minLen = lengthExtent[0] ?? 4;
  const maxLen = Math.min(lengthExtent[1] ?? 9, 12); // Cap at 12 for visual sanity

  const radiusScale = useMemo(
    () =>
      d3
        .scalePow()
        .exponent(0.5) // Very aggressive power scale - gives much more space to inner rings
        .domain([minLen, maxLen])
        .range([innerHoleRadius, maxRadius]),
    [minLen, maxLen, innerHoleRadius, maxRadius]
  );

  // --- HELPER FUNCTIONS ---

  // --- SECTOR CALCULATION ---
  // Calculate dynamic sector sizes based on unique 4-letter prefixes of ANSWERS
  const sectors = useMemo(() => {
    // 1. Get all unique 4-letter prefixes from VISIBLE data
    // This allows the layout to adapt when Exiles are shown, preventing collisions.
    const prefixSet = new Set(data.map((d) => d.word.slice(0, 4)));

    // 2. Calculate Slot Size
    // Total slots = unique prefixes + 7 gaps (one per letter sector)
    const totalSlots = prefixSet.size + 7;
    const slotAngle = (2 * Math.PI) / totalSlots;

    let currentAngle = -Math.PI / 2; // Start at top (12 o'clock)

    return sortedLetters.map((letter) => {
      // Count unique prefixes for this letter
      const prefixesForLetter = Array.from(prefixSet).filter((prefix) =>
        prefix.toLowerCase().startsWith(letter.toLowerCase())
      ).length;

      // Sector size is proportional to the number of unique prefixes
      const sectorSize = prefixesForLetter * slotAngle;

      // Gap is exactly 1 slot size
      const gapSize = slotAngle;

      const start = currentAngle;
      const end = start + sectorSize;
      const center = start + sectorSize / 2;

      // Advance currentAngle for the next letter, including the gap
      currentAngle += sectorSize + gapSize;

      return {
        letter,
        startAngle: start,
        endAngle: end,
        centerAngle: center,
      };
    });
  }, [data, sortedLetters]);

  const getSectorCenter = (letter: string) => {
    const sector = sectors.find(
      (s) => s.letter.toLowerCase() === letter.toLowerCase()
    );
    return sector ? sector.centerAngle : 0;
  };

  // Generate all letter dots and paths for the dataset
  const { letterDots, letterPaths } = useMemo(() => {
    const nodeMap = new Map<string, LetterDot>();

    // 1. Map Prefixes to Angles
    // We need to reconstruct the exact angles used in the sector calculation
    // to ensure nodes align perfectly with the visual sectors.
    const prefixToAngle = new Map<string, number>();

    // Re-derive the slot logic locally to map specific prefixes to angles
    const prefixSet = new Set(data.map((d) => d.word.slice(0, 4)));
    const totalSlots = prefixSet.size + 7;
    const slotAngle = (2 * Math.PI) / totalSlots;

    let currentAngle = -Math.PI / 2; // Start at top

    sortedLetters.forEach((letter) => {
      // Get prefixes for this letter, sorted alphabetically
      const letterPrefixes = Array.from(prefixSet)
        .filter((p) => p.toLowerCase().startsWith(letter.toLowerCase()))
        .sort();

      // Add gap
      currentAngle += slotAngle;

      // Assign angles
      letterPrefixes.forEach((prefix) => {
        const angle = currentAngle + slotAngle / 2; // Center of the slot
        prefixToAngle.set(prefix, angle);
        currentAngle += slotAngle;
      });
    });

    // Helper to get angle for any word
    const getAngleForNode = (word: string): number => {
      // Case A: Word is long enough to map directly to a slot (or be an exile near one)
      if (word.length >= 4) {
        const prefix = word.slice(0, 4);
        if (prefixToAngle.has(prefix)) {
          return prefixToAngle.get(prefix)!;
        }
        // Exile case: Prefix not in answer set.
        // Find the nearest prefix starting with the same letter.
        // If none (rare), default to sector center.
        const firstChar = word[0];
        const sector = sectors.find((s) => s.letter === firstChar);
        if (!sector) return 0; // Should not happen

        // Find all prefixes for this letter
        const letterPrefixes = Array.from(prefixToAngle.keys())
          .filter((k) => k.startsWith(firstChar))
          .sort();

        if (letterPrefixes.length === 0) return sector.centerAngle;

        // Find insertion point
        for (let i = 0; i < letterPrefixes.length; i++) {
          if (word < letterPrefixes[i]) {
            if (i === 0) return prefixToAngle.get(letterPrefixes[0])!;
            // Interpolate or pick closest?
            // Let's just pick the closest to keep it simple and aligned.
            return prefixToAngle.get(letterPrefixes[i])!;
          }
        }
        return prefixToAngle.get(letterPrefixes[letterPrefixes.length - 1])!;
      }

      // Case B: Word is short (L1, L2, L3). Average of descendants.
      // Find all prefixes that start with this word
      const descendants = Array.from(prefixToAngle.keys()).filter((p) =>
        p.startsWith(word)
      );

      if (descendants.length === 0) {
        // Should not happen if it's a parent of an answer.
        // If it's a parent of only exiles, fallback to sector center.
        const sector = sectors.find((s) => s.letter === word[0]);
        return sector ? sector.centerAngle : 0;
      }

      const sum = descendants.reduce(
        (acc, p) => acc + (prefixToAngle.get(p) || 0),
        0
      );
      return sum / descendants.length;
    };

    // 2. Build the Tree (Nodes & Links)
    data.forEach((point) => {
      let prefix = '';
      let parentNode: LetterDot | undefined;

      for (let i = 0; i < point.word.length; i++) {
        const char = point.word[i];
        prefix += char;

        let node = nodeMap.get(prefix);

        if (!node) {
          // Calculate rho (radius)
          const letterPosition = i + 1;
          let rho: number;
          if (letterPosition < minLen) {
            const startRadius = 15;
            const progress = (letterPosition - 1) / (minLen - 1);
            rho = startRadius + progress * (innerHoleRadius - startRadius);
          } else {
            rho = radiusScale(Math.min(letterPosition, maxLen));
          }

          // Calculate angle immediately
          const angle = getAngleForNode(prefix);

          node = {
            x: centerX + rho * Math.cos(angle),
            y: centerY + rho * Math.sin(angle),
            letter: char,
            word: prefix,
            wordId: '',
            letterIndex: i,
            type: point.type,
            isLeaf: false,
            score: 0,
            rho,
            angle,
            parent: parentNode,
            children: [],
          };

          if (parentNode) {
            parentNode.children.push(node);
          }

          nodeMap.set(prefix, node);
        }

        // Update node properties if this word makes it a leaf or an ANSWER
        if (i === point.word.length - 1) {
          node.isLeaf = true;
          node.word = point.word;
          node.wordId = point.id;
          node.score = point.score;
          if (point.type === 'ANSWER') node.type = 'ANSWER';
        }

        parentNode = node;
      }
    });

    const allDots = Array.from(nodeMap.values());

    // 3. Generate Paths
    const allPaths: LetterPath[] = allDots
      .filter(
        (node): node is LetterDot & { parent: LetterDot } => !!node.parent
      )
      .map((node) => ({
        x1: node.parent.x,
        y1: node.parent.y,
        x2: node.x,
        y2: node.y,
        wordId: node.wordId,
        type: node.type,
        rootLetter: node.word[0], // Store the root letter for coloring
      }));

    return { letterDots: allDots, letterPaths: allPaths };
  }, [
    data,
    radiusScale,
    maxLen,
    centerX,
    centerY,
    minLen,
    innerHoleRadius,
    sectors,
    sortedLetters,
  ]);

  return {
    centerX,
    centerY,
    maxRadius,
    radiusScale,
    sectors,
    minLen,
    maxLen,
    letterDots,
    letterPaths,
  };
};

// --- STYLING HELPERS ---

export const HONEY_PALETTE = [
  '#ECAE20', // Warm Yellow
  '#D68C15', // Orange Gold
  '#B86B18', // Bronze
  '#965F26', // Light Brown
  '#C4A645', // Muted Gold
  '#D99E30', // Honey
  '#E3B656', // Light Amber
];

export function getColor(
  type: PointType,
  rootLetter: string,
  sortedLetters: string[],
  opacity: number = 0.25
): `rgba(${number}, ${number}, ${number}, ${number})` {
  // Helper to convert hex to rgb
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 0, g: 0, b: 0 };
  };

  if (type === 'EXILE') {
    // Tailwind red-400
    return `rgba(248, 113, 113, ${opacity})`;
  }

  // Find index of root letter
  const index = sortedLetters.indexOf(rootLetter.toLowerCase());
  const colorHex = HONEY_PALETTE[index >= 0 ? index % HONEY_PALETTE.length : 0];
  const rgb = hexToRgb(colorHex);

  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
}

export function getSize(type: PointType) {
  switch (type) {
    case 'ANSWER':
      return 2; // Smaller dots for letter-by-letter
    case 'EXILE':
      return 1.5;
    default:
      return 1; // Tiny dust
  }
}
