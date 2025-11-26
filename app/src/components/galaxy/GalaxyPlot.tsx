// src/components/galaxy/GalaxyPlot.tsx
"use client";

import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { GalaxyPoint } from './types';
import { useGalaxyLayout, getColor, getSize } from './useGalaxyLayout';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { ExposureConfig } from "@/ui/types";
import { AnswerItem } from "@/components/AnswerItem";

interface GalaxyPlotProps {
  data: GalaxyPoint[];
  // The 7 letters representing the slices, sorted alphabetically
  sortedLetters: string[];
  className?: string;
  showExiles: boolean;
  lettersToExpose: ExposureConfig;
}

export const GalaxyPlot: React.FC<GalaxyPlotProps> = ({
  data,
  sortedLetters,
  className = "",
  showExiles,
  lettersToExpose
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // 1. Handle responsiveness
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        const { width, height } = entries[0].contentRect;
        // Ensure width/height are never 0 to avoid division errors
        setDimensions({ width: width || 1, height: height || 1 });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // 2. Filter data based on showExiles state
  const filteredData = useMemo(() => {
    return showExiles ? data : data.filter(d => d.type === 'ANSWER');
  }, [data, showExiles]);

  // 3. Initialize Math Hook
  const layout = useGalaxyLayout({
    width: dimensions.width,
    height: dimensions.height,
    data: filteredData,
    allData: data,
    sortedLetters
  });

  const { centerX, centerY, radiusScale, minLen, maxLen, letterDots, letterPaths, sectors } = layout;

  // 4. Split letter dots into leaf (interactive) and non-leaf (canvas only)
  const { leafNodes, nonLeafNodes } = useMemo(() => {
    return {
      leafNodes: letterDots.filter(d => d.isLeaf),
      nonLeafNodes: letterDots.filter(d => !d.isLeaf),
    };
  }, [letterDots]);

  // 5. Draw Canvas Layer (Letter paths and non-leaf dots with 10% opacity)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dimensions.width === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high-DPI displays for crisp canvas
    const dpr = window.devicePixelRatio || 1;
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, dimensions.width, dimensions.height);

    // Draw paths first (so dots appear on top)
    letterPaths.forEach(path => {
      const color = getColor(path.type, path.rootLetter, sortedLetters, 0.4);

      ctx.beginPath();
      ctx.moveTo(path.x1, path.y1);
      ctx.lineTo(path.x2, path.y2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Draw non-leaf dots
    nonLeafNodes.forEach(dot => {
      const color = getColor(dot.type, dot.word[0], sortedLetters, 0.4);
      const radius = getSize(dot.type);

      ctx.beginPath();
      ctx.arc(dot.x, dot.y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
    });

  }, [dimensions, letterPaths, nonLeafNodes, sortedLetters]);

  // 6. Generate SVG Elements (Background Rings & Slices)
  const lengths = d3.range(minLen, maxLen + 1);

  return (
    <div className={`relative w-full h-full ${className}`}>
      {/* Galaxy Plot Container */}
      <div ref={containerRef} className="w-full h-full min-h-[400px]">
        {dimensions.width > 0 && (
          <>
            {/* LAYER 1: Canvas for letter paths and non-leaf dots */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 pointer-events-none"
              style={{ width: dimensions.width, height: dimensions.height }}
            />

            {/* LAYER 2: SVG for structure and interactive leaf elements */}
            <svg width={dimensions.width} height={dimensions.height} className="absolute inset-0">
              <g transform={`translate(${centerX}, ${centerY})`}>

                {/* BACKGROUND: Concentric Rings for Lengths (Rho axis) */}
                {lengths.map(len => {
                  const r = radiusScale(len);
                  return (
                    <g key={`ring-${len}`} className="text-gray-800/30 pointer-events-none">
                      <circle r={r} fill="none" stroke="currentColor" strokeWidth={1} strokeDasharray="4 4" />
                      {/* Length label on the ring */}
                      <text x={0} y={-r + 5} textAnchor="middle" fontSize={10} fill="currentColor">
                        L{len}
                      </text>
                    </g>
                  )
                })}

                {/* BACKGROUND: Central Letter Labels */}
                {sectors.map((sector) => {
                  // Place labels inside the inner hole
                  const labelR = 35;
                  const labelX = labelR * Math.cos(sector.centerAngle);
                  const labelY = labelR * Math.sin(sector.centerAngle);

                  return (
                    <text
                      key={`label-${sector.letter}`}
                      x={labelX}
                      y={labelY}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="font-bold fill-gray-400 text-lg pointer-events-none"
                    >
                      {sector.letter.toUpperCase()}
                    </text>
                  );
                })}

                {/* INTERACTIVE LEAF NODES: Final letters with tooltips */}
                <TooltipProvider>
                  {leafNodes.map((dot) => {
                    // Calculate coords relative to the SVG center group (0,0)
                    const relX = dot.x - centerX;
                    const relY = dot.y - centerY;
                    const color = getColor(dot.type, dot.word[0], sortedLetters, 0.85);
                    // Make leaf nodes larger for better hover targets
                    const baseRadius = getSize(dot.type);
                    const interactiveRadius = Math.max(baseRadius * 3, 8); // Minimum 8px for good interaction

                    return (
                      <Tooltip key={dot.wordId}>
                        <TooltipTrigger asChild>
                          <circle
                            cx={relX}
                            cy={relY}
                            r={interactiveRadius}
                            fill={color}
                            fillOpacity={0.5}
                            stroke={dot.type === 'ANSWER' ? '#FFFFFF' : 'none'}
                            strokeWidth={1.5}
                            strokeOpacity={dot.type === 'ANSWER' ? 0.5 : 0}
                            className="transition-transform duration-200 origin-center hover:scale-150 cursor-pointer hover:fill-opacity-100 hover:stroke-opacity-100"
                            style={{
                              transformBox: 'fill-box',
                              filter: dot.type === 'ANSWER' ? 'drop-shadow(0 0 4px rgba(251, 191, 36, 0.2))' : 'none'
                            }}
                          />
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="text-sm">
                            <div className="font-bold capitalize">
                              <AnswerItem
                                answer={dot.word}
                                lettersToExpose={dot.type === 'ANSWER' ? lettersToExpose : { ...lettersToExpose, showAll: true }}
                              />
                              <span className="ml-1 text-xs font-normal text-muted-foreground">({dot.word.length})</span>
                            </div>
                            <p className="text-xs text-muted-background">
                              {dot.type === 'ANSWER' ? 'Accepted Answer' : 'Wikipedia word not in answer list'}
                            </p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </TooltipProvider>
              </g>
            </svg>
          </>
        )}
      </div>
    </div>
  );
};
