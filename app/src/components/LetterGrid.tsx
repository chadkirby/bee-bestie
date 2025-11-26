import { useState, useEffect, useRef, useCallback } from "react";

interface LetterGridProps {
  centerLetter: string;
  outerLetters: string[];
}

const hexRadius = 15;
const HEX_DIAMETER = hexRadius * 2;
const HEX_CENTER = hexRadius;

const pointsInSymmetricHexagon = Array.from({ length: 6 }, (_, i) => {
  const angle = (Math.PI / 3) * i - Math.PI; // rotate to have flat top
  return {
    x: HEX_CENTER + hexRadius * Math.cos(angle),
    y: HEX_CENTER + hexRadius * Math.sin(angle),
  };
})
  .map((p) => `${p.x},${p.y}`)
  .join(" ");

// Distance from the center of the flower to each outer hex center
const RING_RADIUS = hexRadius * 2;

// Overall layout radius/diameter so the container auto-sizes to fit
// (center-to-outer-center distance + one hex radius on each side)
const LAYOUT_RADIUS = RING_RADIUS + hexRadius; // ~= 3 * hexRadius
const LAYOUT_DIAMETER = LAYOUT_RADIUS * 2;

const hexOffsets = Array.from({ length: 6 }, (_, i) => {
  const angle = (Math.PI / 3) * i - Math.PI / 2;
  return {
    x: RING_RADIUS * Math.cos(angle),
    y: RING_RADIUS * Math.sin(angle),
  };
});

const Hexagon = ({ letter, isCenter = false, className = "", style }: { letter: string; isCenter?: boolean; className?: string; style?: React.CSSProperties }) => (
  <div className={`inline-block ${className}`} style={style}>
    <svg
      width={HEX_DIAMETER}
      height={HEX_DIAMETER}
      viewBox={`0 0 ${HEX_DIAMETER} ${HEX_DIAMETER}`}
    >
      <polygon
        points={pointsInSymmetricHexagon}
        fill={isCenter ? "#3b82f6" : "#ffffff"}
        stroke="#d1d5db"
        strokeWidth="1"
      />
      <text
        x={HEX_CENTER}
        y={HEX_CENTER + 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={isCenter ? "#ffffff" : "#000000"}
        fontSize={isCenter ? hexRadius * 0.9 : hexRadius * 0.75}
        style={{ fontWeight: 'bold', fontFamily: "Arial, sans-serif" }}
      >
        {letter}
      </text>
    </svg>
  </div>
);

const ANIMATION_FPS = 2; // Adjust this value to change animation speed
const FRAME_INTERVAL = 1000 / ANIMATION_FPS;

export function LetterGrid({ centerLetter, outerLetters }: LetterGridProps) {
  const [displayLetters, setDisplayLetters] = useState(outerLetters);
  const [isAnimating, setIsAnimating] = useState(false);
  const requestRef = useRef<number | undefined>(undefined);
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    setDisplayLetters(outerLetters);
  }, [outerLetters]);

  const animate = useCallback((time: number) => {
    requestRef.current = requestAnimationFrame(animate);

    const elapsed = time - lastUpdateRef.current;

    if (elapsed > FRAME_INTERVAL) {
      lastUpdateRef.current = time - (elapsed % FRAME_INTERVAL);

      setDisplayLetters((prevLetters) => {
        const newLetters = [...prevLetters];
        if (newLetters.length >= 2) {
          const idx1 = Math.floor(Math.random() * newLetters.length);
          let idx2 = Math.floor(Math.random() * newLetters.length);
          while (idx1 === idx2) {
            idx2 = Math.floor(Math.random() * newLetters.length);
          }
          [newLetters[idx1], newLetters[idx2]] = [newLetters[idx2], newLetters[idx1]];
        }
        return newLetters;
      });
    }
  }, []);

  useEffect(() => {
    if (isAnimating) {
      requestRef.current = requestAnimationFrame(animate);
    } else {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    }
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [isAnimating, animate]);

  return (
    <div
      className="relative mx-auto cursor-pointer"
      style={{ width: `${LAYOUT_DIAMETER}px`, height: `${LAYOUT_DIAMETER}px` }}
      onClick={() => setIsAnimating(!isAnimating)}
    >
      {/* Center hexagon */}
      <Hexagon
        letter={centerLetter}
        isCenter={true}
        className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
      />

      {/* Outer hexagons in hexagonal pattern */}
      {displayLetters.slice(0, hexOffsets.length).map((letter, index) => {
        const { x, y } = hexOffsets[index];

        return (
          <Hexagon
            key={index}
            letter={letter}
            className="absolute transform -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `calc(50% + ${x}px)`,
              top: `calc(50% + ${y}px)`,
            }}
          />
        );
      })}
    </div>
  );
}
