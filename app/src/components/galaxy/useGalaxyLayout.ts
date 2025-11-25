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
  // Calculate dynamic sector sizes based on word counts
  const sectors = useMemo(() => {
    // 1. Calculate counts
    const counts = new Map<string, number>();
    sortedLetters.forEach((l) => counts.set(l.toLowerCase(), 0));

    allData.forEach((p) => {
      const firstChar = p.word[0].toLowerCase();
      counts.set(firstChar, (counts.get(firstChar) || 0) + 1);
    });

    // 2. Smart Ordering: Interleave most and least popular
    // This separates dense sectors with sparse ones to reduce collisions
    const lettersByCount = [...sortedLetters].sort((a, b) => {
      const countA = counts.get(a.toLowerCase()) || 0;
      const countB = counts.get(b.toLowerCase()) || 0;
      return countB - countA; // Descending
    });

    const orderedLetters: string[] = [];
    let left = 0;
    let right = lettersByCount.length - 1;
    while (left <= right) {
      if (left === right) {
        orderedLetters.push(lettersByCount[left]);
      } else {
        orderedLetters.push(lettersByCount[left]);
        orderedLetters.push(lettersByCount[right]);
      }
      left++;
      right--;
    }

    // 3. Generate Sectors
    const totalWords = allData.length;
    const minAngle = (2 * Math.PI) / 14;
    const totalMinAngle = minAngle * 7;
    const remainingAngle = 2 * Math.PI - totalMinAngle;

    let currentAngle = -Math.PI / 2;

    return orderedLetters.map((letter) => {
      const count = counts.get(letter.toLowerCase()) || 0;
      const proportion = totalWords > 0 ? count / totalWords : 0;
      const allocatedAngle = minAngle + remainingAngle * proportion;

      const start = currentAngle;
      const end = currentAngle + allocatedAngle;
      const center = start + allocatedAngle / 2;

      currentAngle += allocatedAngle;

      return {
        letter,
        startAngle: start,
        endAngle: end,
        centerAngle: center,
      };
    });
  }, [allData, sortedLetters]);

  const getSectorCenter = (letter: string) => {
    const sector = sectors.find(
      (s) => s.letter.toLowerCase() === letter.toLowerCase()
    );
    return sector ? sector.centerAngle : 0;
  };

  // Generate all letter dots and paths for the dataset
  const { letterDots, letterPaths } = useMemo(() => {
    const nodeMap = new Map<string, LetterDot>();
    // Deviation factor: determines how much the angle changes based on letter difference
    // Reduced to keep trails tighter and within sectors
    // const deviationFactor = 0.05; // This is no longer used

    // 1. Build the Tree (Nodes & Links)
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

          node = {
            x: 0, // Will be calculated later
            y: 0,
            letter: char,
            word: prefix,
            wordId: '',
            letterIndex: i,
            type: point.type, // Default, might be upgraded to ANSWER
            isLeaf: false,
            score: 0,
            rho,
            angle: 0, // Will be calculated later
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
          // Upgrade type to ANSWER if ANY word sharing this node is an answer
          // (Though usually leaf nodes are unique to a word, unless duplicates exist)
          if (point.type === 'ANSWER') node.type = 'ANSWER';
        } else {
          // For intermediate nodes, if they are part of an ANSWER path,
          // we might want to color them? For now, keep as is.
          if (point.type === 'ANSWER' && node.type !== 'ANSWER') {
            // Optional: Upgrade intermediate nodes to ANSWER type if they lead to an answer?
            // node.type = 'ANSWER';
          }
        }

        parentNode = node;
      }
    });

    const allDots = Array.from(nodeMap.values());

    // 2. Layout Level by Level
    // Group by depth (letterIndex)
    const maxDepth = d3.max(allDots, (d) => d.letterIndex) ?? 0;

    for (let depth = 0; depth <= maxDepth; depth++) {
      const nodesAtDepth = allDots.filter((d) => d.letterIndex === depth);

      // A. Calculate Ideal Angles (Inherit from parent + tiny jitter)
      // Group by parent to handle siblings
      const nodesByParent = d3.group(nodesAtDepth, (d) => d.parent);

      nodesByParent.forEach((children, parent) => {
        if (!parent) {
          // Roots: Fixed at slice center
          children.forEach((node) => {
            // Use the dynamic sector center for the first letter
            node.angle = getSectorCenter(node.letter);
          });
        } else {
          // Children: Start at parent's FINAL angle
          // Sort siblings to ensure deterministic spread direction
          children.sort((a, b) => a.letter.localeCompare(b.letter));

          const count = children.length;
          // Very small jitter to break symmetry and allow collision algo to do the work
          const jitter = 0.01;

          children.forEach((child, i) => {
            // Center the jitter around the parent's angle
            const offset = (i - (count - 1) / 2) * jitter;
            child.angle = parent.angle + offset;
          });
        }
      });

      // B. Resolve Collisions for THIS depth
      // Sort by angle to find neighbors
      nodesAtDepth.sort((a, b) => a.angle - b.angle);

      const rho = nodesAtDepth[0]?.rho || 100;
      const minArc = 14; // Minimum distance between dots (pixels)
      const minAngle = minArc / rho;

      // Iterative relaxation
      for (let iter = 0; iter < 10; iter++) {
        let moved = false;
        for (let i = 0; i < nodesAtDepth.length - 1; i++) {
          const a = nodesAtDepth[i];
          const b = nodesAtDepth[i + 1];

          let diff = b.angle - a.angle;

          // Check for wrap-around collision (important for full circles)
          // But here we mostly care about local collisions.
          // If we want to support 360 wrap, we should check last vs first too.
          // For now, linear check is usually sufficient given the sector layout.

          if (diff < minAngle) {
            const overlap = minAngle - diff;
            const move = overlap / 2;

            // Push apart
            a.angle -= move;
            b.angle += move;
            moved = true;
          }
        }
        if (!moved) break;
      }

      // Update coordinates
      nodesAtDepth.forEach((node) => {
        node.x = centerX + node.rho * Math.cos(node.angle);
        node.y = centerY + node.rho * Math.sin(node.angle);
      });
    }

    // 3. Generate Paths
    const allPaths: LetterPath[] = [];
    allDots.forEach((node) => {
      if (node.parent) {
        allPaths.push({
          x1: node.parent.x,
          y1: node.parent.y,
          x2: node.x,
          y2: node.y,
          wordId: node.wordId, // Use the node's wordId (might be empty if intermediate)
          type: node.type,
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
export function getColor(
  type: PointType,
  opacity: number = 0.25
): `rgba(${number}, ${number}, ${number}, ${number})` {
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
