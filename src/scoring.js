export function getMissingEdges(faces, suppliedFaces) {
  const edges = new Map();
  const suppliedEdges = new Set();

  Object.entries(faces).forEach(([name, vertices]) => {
    vertices.forEach((start, index) => {
      const end = vertices[(index + 1) % vertices.length];
      const key = [start.join(','), end.join(',')].sort().join('|');
      edges.set(key, [start, end]);
      if (suppliedFaces.includes(name)) suppliedEdges.add(key);
    });
  });

  // A shared boundary is already supplied if either adjacent face is shown.
  return [...edges.entries()]
    .filter(([key]) => !suppliedEdges.has(key))
    .map(([, edge]) => edge);
}

export const SCORING_SETTINGS = Object.freeze({
  sampleStepRatio: 0.005,
  maxDistanceRatio: 0.06,
  accuracyFalloffRatio: 0.02,
});

function toSegments(edges) {
  return edges.map(([start, end]) => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    return { start, dx, dy, lengthSquared, length: Math.sqrt(lengthSquared) };
  }).filter(({ length }) => Number.isFinite(length) && length > 0);
}

function closestPoint(point, { start, dx, dy, lengthSquared }) {
  const t = Math.max(0, Math.min(1,
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared
  ));
  return { x: start.x + t * dx, y: start.y + t * dy };
}

function distanceSquared(a, b) {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}

function nearestSegment(point, segments) {
  let nearest = { index: -1, distanceSquared: Infinity };
  segments.forEach((segment, index) => {
    const distance = distanceSquared(point, closestPoint(point, segment));
    if (distance < nearest.distanceSquared) nearest = { index, distanceSquared: distance };
  });
  return nearest;
}

function sampleSegment({ start, dx, dy, length }, step, visit) {
  const count = Math.ceil(length / step);
  const pieceDx = dx / count;
  const pieceDy = dy / count;
  for (let index = 0; index < count; index += 1) {
    const t = (index + 0.5) / count;
    visit({ x: start.x + dx * t, y: start.y + dy * t }, length / count, {
      start: { x: start.x + pieceDx * index, y: start.y + pieceDy * index },
      dx: pieceDx,
      dy: pieceDy,
      lengthSquared: pieceDx * pieceDx + pieceDy * pieceDy,
    });
  }
}

function shapeSize(segments) {
  const points = segments.flatMap(({ start, dx, dy }) => [start, { x: start.x + dx, y: start.y + dy }]);
  const width = Math.max(...points.map(point => point.x)) - Math.min(...points.map(point => point.x));
  const height = Math.max(...points.map(point => point.y)) - Math.min(...points.map(point => point.y));
  return Math.hypot(width, height);
}

function projectInterval(piece, target) {
  const along = point => ((point.x - target.start.x) * target.dx + (point.y - target.start.y) * target.dy) / target.length;
  const first = along(piece.start);
  const last = along({ x: piece.start.x + piece.dx, y: piece.start.y + piece.dy });
  const clamp = value => Math.max(0, Math.min(target.length, value));
  return {
    from: clamp(Math.min(first, last)),
    to: clamp(Math.max(first, last)),
    projectedLength: Math.abs(last - first),
  };
}

function mergeIntervals(pieces) {
  const intervals = [];
  [...pieces].sort((a, b) => a.from - b.from).forEach(({ from, to }) => {
    const previous = intervals[intervals.length - 1];
    if (previous && from <= previous.to) {
      previous.to = Math.max(previous.to, to);
    } else {
      intervals.push({ from, to });
    }
  });
  return intervals;
}

export function scoreDrawing(strokes, targetEdges, suppliedEdges = []) {
  const targets = toSegments(targetEdges);
  const totalLength = targets.reduce((total, { length }) => total + length, 0);
  if (totalLength === 0) return null;

  const emptyScore = { score: 0, accuracy: 0, completeness: 0, cleanliness: 0 };
  const segments = toSegments(strokes.flatMap((stroke) =>
    stroke.slice(1).map((end, index) => [stroke[index], end])
  ));
  if (segments.length === 0) return emptyScore;

  const supplied = toSegments(suppliedEdges);
  // Include the supplied edges so both completion and tracing use the full cube's scale.
  const size = shapeSize([...targets, ...supplied]);
  const step = size * SCORING_SETTINGS.sampleStepRatio;
  const maxDistanceSquared = (size * SCORING_SETTINGS.maxDistanceRatio) ** 2;
  const falloffSquared = (size * SCORING_SETTINGS.accuracyFalloffRatio) ** 2;
  const epsilon = size * 1e-10;
  const isSuppliedInk = (point, targetDistance) => {
    const suppliedDistance = nearestSegment(point, supplied).distanceSquared;
    return suppliedDistance <= maxDistanceSquared && suppliedDistance <= targetDistance + size * size * 1e-12;
  };

  const matchedSegments = targets.map(() => []);
  let strayLength = 0;
  segments.forEach((segment) => sampleSegment(segment, step, (point, length, piece) => {
    const { index, distanceSquared: targetDistance } = nearestSegment(point, targets);
    if (isSuppliedInk(point, targetDistance)) return;
    if (targetDistance > maxDistanceSquared) {
      strayLength += length;
      return;
    }
    const interval = projectInterval(piece, targets[index]);
    const covered = interval.to - interval.from;
    if (covered <= epsilon || interval.projectedLength <= epsilon) {
      strayLength += length;
      return;
    }
    matchedSegments[index].push({ ...piece, from: interval.from, to: interval.to });
    strayLength += length * (1 - Math.min(1, covered / interval.projectedLength));
  }));

  let coveredLength = 0;
  let accurateLength = 0;
  targets.forEach((target, index) => {
    const pieces = matchedSegments[index];
    // Use the interval union: gaps stay gaps and overlapping strokes count only once.
    mergeIntervals(pieces).forEach(({ from, to }) => {
      const length = to - from;
      coveredLength += length;
      const coveredSegment = {
        start: {
          x: target.start.x + target.dx * from / target.length,
          y: target.start.y + target.dy * from / target.length,
        },
        dx: target.dx * length / target.length,
        dy: target.dy * length / target.length,
        length,
      };
      sampleSegment(coveredSegment, step, (point, weight) => {
        const distance = nearestSegment(point, pieces).distanceSquared;
        accurateLength += Math.exp(-distance / (2 * falloffSquared)) * weight;
      });
    });
  });
  if (coveredLength === 0) return emptyScore;

  const accuracy = Math.min(1, accurateLength / coveredLength);
  const completeness = Math.min(1, coveredLength / totalLength);
  const cleanliness = coveredLength / (coveredLength + strayLength);
  return {
    score: Math.round(100 * completeness * accuracy * cleanliness),
    accuracy: Math.round(100 * accuracy),
    completeness: Math.round(100 * completeness),
    cleanliness: Math.round(100 * cleanliness),
  };
}
