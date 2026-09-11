import { useMemo } from 'react';
import { BOARD_WIDTH, BOARD_HEIGHT, getHorizon, getVanishingPoints } from './perspective';

function PerspectiveGuides({ camera }) {
  const points = useMemo(() => getVanishingPoints(camera), [camera]);
  const horizon = useMemo(() => getHorizon(camera), [camera]);

  return (
    <g className="perspective-guides">
      {horizon && (
        <g>
          <line
            className="horizon-line"
            x1={horizon[0].x}
            y1={horizon[0].y}
            x2={horizon[1].x}
            y2={horizon[1].y}
          />
          <text
            className="horizon-label"
            x={(horizon[0].x + horizon[1].x) / 2}
            y={(horizon[0].y + horizon[1].y) / 2 - 10}
            textAnchor="middle"
          >
            Horizon
          </text>
        </g>
      )}
      {points.map((point) => {
        const labelRight = point.x >= BOARD_WIDTH / 2;
        const description = `${point.label}, ${point.axis.toUpperCase()} direction`;
        return (
          <g key={point.axis} className="vanishing-point" role="img" aria-label={description}>
            <title>{description}</title>
            <circle cx={point.x} cy={point.y} r={6} fill={point.color} stroke="#0b1020" strokeWidth={2} />
            <text
              className="vanishing-label"
              x={point.x + (labelRight ? 14 : -14)}
              y={point.y + (point.y >= BOARD_HEIGHT / 2 ? 24 : -14)}
              textAnchor={labelRight ? 'start' : 'end'}
              fill={point.color}
            >
              {point.label}
            </text>
          </g>
        );
      })}
    </g>
  );
}

export default PerspectiveGuides;
