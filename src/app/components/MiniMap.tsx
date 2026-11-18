import React from 'react';
import { CHAPTERS } from '../../curriculum';
import { MinimapMarker } from '../../game/types';
import { HUB_CENTER } from '../../scene/ProceduralAssets';

interface MiniMapProps {
  playerX: number;
  playerZ: number;
  playerYaw: number;
  targetX: number;
  targetZ: number;
  markers: MinimapMarker[];
  reviewPortalActive: boolean;
  onExpandTopDown?: () => void;
}

export const MiniMap: React.FC<MiniMapProps> = ({
  playerX,
  playerZ,
  playerYaw,
  targetX,
  targetZ,
  markers,
  reviewPortalActive,
  onExpandTopDown,
}) => {
  // World spans roughly X: [-48, 48], Z: [-36, 50] -> map to 120x120 circle
  const size = 124;
  const center = size / 2;
  const scale = 1.15; // px per world meter centered at (0, 6)
  const worldCenterZ = 6;

  const toMapX = (wx: number) => center + wx * scale;
  const toMapY = (wz: number) => center + (wz - worldCenterZ) * scale;

  const px = Math.max(10, Math.min(size - 10, toMapX(playerX)));
  const py = Math.max(10, Math.min(size - 10, toMapY(playerZ)));
  const tx = toMapX(targetX);
  const ty = toMapY(targetZ);

  return (
    <button
      type="button"
      onClick={onExpandTopDown}
      title="اضغط للتبديل إلى الخريطة العلوية (M)"
      aria-label="خريطة الأرخبيل المصغرة — اضغط لعرض الخريطة العلوية"
      className="pointer-events-auto relative shrink-0 overflow-hidden rounded-full border-2 border-[#171C19]/20 bg-[#FBF9F4]/95 shadow-lg transition hover:border-[#1E6B47] focus-visible:outline-2 focus-visible:outline-[#1E6B47]"
      style={{ width: size, height: size }}
    >
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full">
        <circle cx={center} cy={center} r={center - 1} fill="#E7EFF5" />

        {/* Bridges */}
        {CHAPTERS.map((ch) => (
          <line
            key={`br_${ch.id}`}
            x1={toMapX(HUB_CENTER.x)}
            y1={toMapY(HUB_CENTER.z)}
            x2={toMapX(ch.islandPos[0])}
            y2={toMapY(ch.islandPos[2])}
            stroke="#D3B47A"
            strokeWidth={3}
            strokeLinecap="round"
          />
        ))}

        {/* Central Hub */}
        <circle
          cx={toMapX(HUB_CENTER.x)}
          cy={toMapY(HUB_CENTER.z)}
          r={HUB_CENTER.radius * scale}
          fill="#EDE6D8"
          stroke="#C8922B"
          strokeWidth={1.2}
        />

        {/* Review Portal Dot */}
        {reviewPortalActive && (
          <circle
            cx={toMapX(HUB_CENTER.x)}
            cy={toMapY(HUB_CENTER.z - 3.2)}
            r={3.2}
            fill="#1E6B47"
            stroke="#FFFFFF"
            strokeWidth={1}
          />
        )}

        {/* Chapter Islands */}
        {CHAPTERS.map((ch) => (
          <circle
            key={ch.id}
            cx={toMapX(ch.islandPos[0])}
            cy={toMapY(ch.islandPos[2])}
            r={ch.islandRadius * scale}
            fill={ch.stoneHex}
            stroke={ch.accentHex}
            strokeWidth={1.2}
          />
        ))}

        {/* Stations Status Dots */}
        {markers.map((m) => {
          const fill =
            m.status === 'mastered'
              ? '#1E6B47'
              : m.status === 'in_progress'
                ? '#C8922B'
                : '#8E887E';
          return (
            <circle
              key={m.id}
              cx={toMapX(m.x)}
              cy={toMapY(m.z)}
              r={2.4}
              fill={fill}
              stroke="#FFFFFF"
              strokeWidth={0.6}
            />
          );
        })}

        {/* Target Indicator */}
        <circle
          cx={tx}
          cy={ty}
          r={4.5}
          fill="none"
          stroke="#C8922B"
          strokeWidth={1.4}
        />

        {/* Player Arrow */}
        <g transform={`translate(${px}, ${py}) rotate(${(-playerYaw * 180) / Math.PI + 180})`}>
          <polygon
            points="0,-5 3.6,4 0,2.2 -3.6,4"
            fill="#B9382C"
            stroke="#FFFFFF"
            strokeWidth={0.8}
          />
        </g>
      </svg>
    </button>
  );
};
