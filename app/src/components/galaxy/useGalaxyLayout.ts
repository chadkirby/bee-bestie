// src/components/galaxy/useGalaxyLayout.ts
import { useMemo } from 'react';
import * as d3 from 'd3';
import { GalaxyPoint, PointType } from './types';

interface LayoutProps {
  width: number;
  height: number;
  data: GalaxyPoint[];
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
}

// Letter path: represents a line from one letter to the next
export interface LetterPath {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  wordId: string;
  type: PointType;
}

export const useGalaxyLayout = ({ width, height, data }: LayoutProps) => {
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

  const sliceAngleSize = (2 * Math.PI) / 7;

  // Generate all letter dots and paths for the dataset
  const { letterDots, letterPaths } = useMemo(() => {
    const nodeMap = new Map<string, LetterDot>();
    const deviationFactor = 0.1;

    // 1. Generate unique nodes (prefixes)
    data.forEach((point) => {
      const sliceStartAngle = point.sliceIndex * sliceAngleSize - Math.PI / 2;
      const sliceCenterAngle = sliceStartAngle + sliceAngleSize / 2;

      let prefix = '';

      for (let i = 0; i < point.word.length; i++) {
        const char = point.word[i];
        prefix += char;

        // If node already exists, we might need to update it if it's a leaf for THIS word
        let node = nodeMap.get(prefix);

        if (!node) {
          // Calculate position from scratch
          // Note: The angle calculation depends on the depth 'i'
          // All previous diffs are weighted by the current depth factor
          let cumulativeAngle = sliceCenterAngle;
          for (let j = 1; j <= i; j++) {
            const diff =
              point.word.charCodeAt(j) - point.word.charCodeAt(j - 1);
            cumulativeAngle += diff * deviationFactor ** (1 + i / 7);
          }

          const letterPosition = i + 1;
          let rho: number;
          if (letterPosition < minLen) {
            const startRadius = 10;
            const progress = (letterPosition - 1) / (minLen - 1);
            rho = startRadius + progress * (innerHoleRadius - startRadius);
          } else {
            rho = radiusScale(Math.min(letterPosition, maxLen));
          }

          const x = centerX + rho * Math.cos(cumulativeAngle);
          const y = centerY + rho * Math.sin(cumulativeAngle);

          node = {
            x,
            y,
            letter: char,
            word: prefix, // Default to prefix, will be overwritten if leaf
            wordId: '', // Placeholder
            letterIndex: i,
            type: point.type, // Default to current type, prioritize ANSWER later?
            isLeaf: false,
            score: 0,
            rho,
            angle: cumulativeAngle,
          };
          nodeMap.set(prefix, node);
        }

        // If this is the last letter of the current word, mark it as a leaf
        if (i === point.word.length - 1) {
          node.isLeaf = true;
          node.word = point.word;
          node.wordId = point.id;
          node.type = point.type;
          node.score = point.score;
        }
      }
    });

    const allDots = Array.from(nodeMap.values());

    // 2. Resolve collisions for leaf nodes
    // Group leaf nodes by their ring (approximate rho)
    const leafNodes = allDots.filter((d) => d.isLeaf);
    const nodesByRing = d3.group(leafNodes, (d) => Math.round(d.rho));

    nodesByRing.forEach((nodes) => {
      if (nodes.length <= 1) return;

      const rho = nodes[0].rho;
      // Minimum arc length for separation (approx 20px)
      const minArc = 20;
      const minAngle = minArc / rho;

      // Iterative relaxation
      for (let iter = 0; iter < 10; iter++) {
        // Sort by angle
        nodes.sort((a, b) => a.angle - b.angle);

        for (let i = 0; i < nodes.length; i++) {
          const a = nodes[i];
          const b = nodes[(i + 1) % nodes.length];

          let diff = b.angle - a.angle;
          if (diff < 0) diff += 2 * Math.PI; // Wrap around

          if (diff < minAngle) {
            const overlap = minAngle - diff;
            const move = overlap / 2;

            // Move apart
            a.angle -= move;
            b.angle += move;

            // Normalize angles to keep them well-behaved
            a.angle = ((a.angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
            b.angle = ((b.angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
          }
        }
      }

      // Apply new positions
      nodes.forEach((node) => {
        node.x = centerX + node.rho * Math.cos(node.angle);
        node.y = centerY + node.rho * Math.sin(node.angle);
      });
    });

    // 3. Generate paths from adjusted dots
    const allPaths: LetterPath[] = [];

    data.forEach((point) => {
      // Reconstruct the sequence of nodes for this word
      const dots: LetterDot[] = [];
      let prefix = '';
      for (const char of point.word) {
        prefix += char;
        const node = nodeMap.get(prefix);
        if (node) dots.push(node);
      }

      // Create path segments
      for (let i = 0; i < dots.length - 1; i++) {
        const current = dots[i];
        const next = dots[i + 1];
        allPaths.push({
          x1: current.x,
          y1: current.y,
          x2: next.x,
          y2: next.y,
          wordId: point.id,
          type: point.type,
        });
      }
    });

    return { letterDots: allDots, letterPaths: allPaths };
  }, [
    data,
    radiusScale,
    maxLen,
    centerX,
    centerY,
    minLen,
    innerHoleRadius,
    sliceAngleSize,
  ]);

  return {
    centerX,
    centerY,
    maxRadius,
    radiusScale,
    sliceAngleSize,
    minLen,
    maxLen,
    letterDots,
    letterPaths,
  };
};

// --- STYLING HELPERS ---
export function getColor(type: PointType, opacity: number = 0.25) {
  switch (type) {
    case 'ANSWER':
      // Tailwind yellow-400
      return `rgba(251, 191, 36, ${opacity})`;
    // "Dark Matter" color - distinct from gold, but looks "important"
    case 'EXILE':
      // Tailwind red-400
      return `rgba(248, 113, 113, ${opacity})`;
    // Pseudo-word dust - faint and transparent
    default:
      // Tailwind gray-400 with low opacity
      return `rgba(156, 163, 175, ${opacity})`;
  }
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
