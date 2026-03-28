'use client';

import React, { useState, useMemo, memo } from 'react';
import mapData from '@/lib/data/tn-map-paths.json';

interface TNInteractiveMapProps {
  onDistrictSelect: (districtName: string) => void;
  activeDistrict?: string;
}

type DistrictMapEntry = { path: string; centroid: [number, number] };
type DistrictMapData = {
  viewBox: string;
  districts: Record<string, DistrictMapEntry>;
};

const DISTRICT_LABEL_TWEAKS: Record<
  string,
  { dx?: number; dy?: number; fontSize?: number; letterSpacing?: string }
> = {
  Chennai: { dx: 18, dy: -2, fontSize: 8.2, letterSpacing: '-0.01em' },
  Thiruvallur: { dx: 0, dy: -8, fontSize: 8.2, letterSpacing: '-0.01em' },
  Ranipet: { dx: 0, dy: -6, fontSize: 8.0, letterSpacing: '-0.01em' },
  Kanchipuram: { dx: 10, dy: 2, fontSize: 8.0, letterSpacing: '-0.01em' },
  Chengalpattu: { dx: 12, dy: 8, fontSize: 8.0, letterSpacing: '-0.01em' },
  Kallakurichi: { dx: 0, dy: -4, fontSize: 8.0, letterSpacing: '-0.01em' },
  Cuddalore: { dx: 8, dy: 0, fontSize: 8.0, letterSpacing: '-0.01em' },
  Ariyalur: { dx: 10, dy: -2, fontSize: 8.0, letterSpacing: '-0.01em' },
  Thanjavur: { dx: -8, dy: 6, fontSize: 7.2, letterSpacing: '-0.01em' },
  Thiruvarur: { dx: 18, dy: 10, fontSize: 7.2, letterSpacing: '-0.01em' },
  Mayiladuthurai: { dx: 18, dy: 0, fontSize: 7.0, letterSpacing: '-0.01em' },
  Nagapattinam: { dx: 20, dy: 18, fontSize: 7.0, letterSpacing: '-0.01em' },
  Pudukkottai: { dx: 6, dy: 6, fontSize: 8.0, letterSpacing: '-0.01em' },
};

// Sub-component for individual district paths to optimize re-renders
const DistrictPath = memo(({ 
  name, 
  path, 
  isSelected, 
  isHovered, 
  onMouseEnter, 
  onMouseLeave, 
  onClick 
}: {
  name: string;
  path: string;
  isSelected: boolean;
  isHovered: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
}) => {
  return (
    <path
      d={path}
      className={`
        transition-[fill,stroke] duration-200 cursor-pointer outline-none
        ${isSelected ? 'fill-teal-600 stroke-white stroke-[2]' : 
          isHovered ? 'fill-teal-400 stroke-white stroke-[1.5]' : 
          'fill-white stroke-teal-200 hover:fill-teal-50 stroke-[0.8]'}
      `}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
    >
      <title>{name}</title>
    </path>
  );
});

DistrictPath.displayName = 'DistrictPath';

// Sub-component for district labels to optimize re-renders
const DistrictLabel = memo(({ 
  name, 
  centroid, 
  isSelected, 
  isHovered 
}: {
  name: string;
  centroid: [number, number];
  isSelected: boolean;
  isHovered: boolean;
}) => {
  const tweak = DISTRICT_LABEL_TWEAKS[name] || {};
  const defaultFontSize = name.length >= 12 ? 7.2 : name.length >= 10 ? 7.8 : 8.6;
  const baseFontSize = tweak.fontSize ?? defaultFontSize;
  const fontSize = isSelected ? baseFontSize + 1.8 : isHovered ? baseFontSize + 0.8 : baseFontSize;

  return (
    <text
      x={centroid[0] + (tweak.dx ?? 0)}
      y={centroid[1] + (tweak.dy ?? 0)}
      textAnchor="middle"
      dominantBaseline="middle"
      paintOrder="stroke"
      style={{
        fontSize: `${fontSize}px`,
        letterSpacing: tweak.letterSpacing ?? '-0.015em',
        strokeWidth: 1.2,
      }}
      className={`
        pointer-events-none select-none font-black uppercase transition-all duration-200
        ${isSelected ? 'fill-white stroke-teal-700' : isHovered ? 'fill-teal-900 stroke-white' : 'fill-teal-800/65 stroke-white'}
      `}
    >
      {name}
    </text>
  );
});

DistrictLabel.displayName = 'DistrictLabel';

const TNInteractiveMap: React.FC<TNInteractiveMapProps> = ({ onDistrictSelect, activeDistrict }) => {
  const [hoveredDistrict, setHoveredDistrict] = useState<string | null>(null);
  const typedMapData = mapData as unknown as DistrictMapData;

  const districts = typedMapData.districts;

  // Calculate padded viewBox to prevent label clipping at edges
  const paddedViewBox = useMemo(() => {
    const [x, y, w, h] = typedMapData.viewBox.split(' ').map(Number);
    const padding = 60; // Extra space for labels
    return `${x - padding} ${y - padding} ${w + padding * 2} ${h + padding * 2}`;
  }, [typedMapData.viewBox]);

  return (
    <div className="relative w-full max-w-[950px] mx-auto bg-transparent group">
      <svg
        viewBox={paddedViewBox}
        className="w-full h-full overflow-visible"
        preserveAspectRatio="xMidYMid meet"
      >
        <g>
          {Object.entries(districts).map(([name, data]) => (
            <DistrictPath
              key={`path-${name}`}
              name={name}
              path={data.path}
              isSelected={activeDistrict === name}
              isHovered={hoveredDistrict === name}
              onMouseEnter={() => setHoveredDistrict(name)}
              onMouseLeave={() => setHoveredDistrict(null)}
              onClick={() => onDistrictSelect(name)}
            />
          ))}
          
          {Object.entries(districts).map(([name, data]) => (
            <DistrictLabel
              key={`label-${name}`}
              name={name}
              centroid={data.centroid}
              isSelected={activeDistrict === name}
              isHovered={hoveredDistrict === name}
            />
          ))}
        </g>
      </svg>
    </div>
  );
};

export default TNInteractiveMap;
