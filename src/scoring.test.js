import { getMissingEdges, scoreDrawing, SCORING_SETTINGS } from './scoring';
import { CUBE_FACES, getVisibleFaceNames } from './cube';
import { createPerspectiveCamera, projectToScreen } from './perspective';

const a = [-1, -1, 1];
const b = [1, -1, 1];
const c = [1, 1, 1];
const d = [-1, 1, 1];
const e = [1, 1, -1];
const f = [-1, 1, -1];
const g = [1, -1, -1];
const faces = { front: [a, b, c, d], top: [d, c, e, f], side: [b, g, e, c] };
const keys = (edges) => edges.map((edge) => edge.map((point) => point.join(',')).sort().join('|')).sort();
const top = [{ x: 10, y: 10 }, { x: 210, y: 10 }];
const bottom = [{ x: 10, y: 110 }, { x: 210, y: 110 }];
const targets = [top, bottom];
const score = (...args) => scoreDrawing(...args).score;
const perfect = { score: 100, accuracy: 100, completeness: 100, cleanliness: 100 };
const empty = { score: 0, accuracy: 0, completeness: 0, cleanliness: 0 };

test('one supplied face leaves five unique edges, not every edge of the missing faces', () => {
  expect(keys(getMissingEdges(faces, ['front']))).toEqual(keys([
    [c, e], [e, f], [f, d], [b, g], [g, e],
  ]));
});

test('two supplied faces leave only the two edges not already shown', () => {
  expect(keys(getMissingEdges(faces, ['front', 'side']))).toEqual(keys([[e, f], [f, d]]));
});

test('shared edges are deduplicated even when their vertex order is reversed', () => {
  expect(getMissingEdges(faces, [])).toHaveLength(9);
});

test('excluding every edge leaves no scoring target', () => {
  expect(getMissingEdges(faces, Object.keys(faces))).toEqual([]);
  expect(scoreDrawing([], [])).toBeNull();
  expect(scoreDrawing([top], [])).toBeNull();
});

test('drawing only the missing edges earns full credit with endpoint-only strokes', () => {
  expect(scoreDrawing([top, bottom], targets)).toEqual(perfect);
});

test('empty strokes, isolated points, and zero-length strokes cannot complete an edge', () => {
  expect(scoreDrawing([], targets)).toEqual(empty);
  expect(scoreDrawing([[], [top[0]], [top[0], top[0]]], targets)).toEqual(empty);
});

test('tracing a supplied edge does not count toward a separate missing edge', () => {
  expect(scoreDrawing([top], [bottom])).toEqual(empty);
});

test('a perfect half-finished drawing is capped at 50%', () => {
  expect(scoreDrawing([top], targets)).toEqual({
    score: 50, accuracy: 100, completeness: 50, cleanliness: 100,
  });
});

test('repeated strokes on one edge cannot replace another missing edge', () => {
  expect(scoreDrawing([top, top, top], targets)).toEqual(scoreDrawing([top], targets));
});

test('scoring is independent of stroke direction and input event density', () => {
  const denseStroke = Array.from({ length: 101 }, (_, index) => ({ x: 10 + index * 2, y: 10 }));
  expect(scoreDrawing([denseStroke, bottom], targets)).toEqual(perfect);
  expect(scoreDrawing([top.slice().reverse(), bottom.slice().reverse()], targets)).toEqual(perfect);
});

test('separate strokes are not connected by invisible lines during scoring', () => {
  const left = [{ x: 10, y: 10 }, { x: 30, y: 10 }];
  const right = [{ x: 190, y: 10 }, { x: 210, y: 10 }];
  expect(scoreDrawing([left, right], [top])).toEqual({
    score: 20, accuracy: 100, completeness: 20, cleanliness: 100,
  });
});

test('accuracy decreases smoothly with distance instead of using the old 18-pixel pass/fail rule', () => {
  const offsets = [0, 1, 2, 4, 8, 11];
  const results = offsets.map(offset =>
    scoreDrawing([[{ x: 10, y: 10 + offset }, { x: 210, y: 10 + offset }]], [top])
  );
  results.forEach((result, index) => {
    const falloff = 200 * SCORING_SETTINGS.accuracyFalloffRatio;
    expect(result.accuracy).toBe(Math.round(Math.exp(-(offsets[index] ** 2) / (2 * falloff ** 2)) * 100));
    expect(result.completeness).toBe(100);
    expect(result.cleanliness).toBe(100);
    expect(result.score).toBe(result.accuracy);
    if (index > 0) expect(result.score).toBeLessThan(results[index - 1].score);
  });
  expect(scoreDrawing([[{ x: 10, y: 40 }, { x: 210, y: 40 }]], [top])).toEqual(empty);
});

test('zero-length projected targets do not cause division by zero', () => {
  expect(scoreDrawing([top], [[top[0], top[0]]])).toBeNull();
});

test('a nearby supplied boundary cannot stand in for a missing edge inside the tolerance band', () => {
  const supplied = [{ x: 10, y: 100 }, { x: 210, y: 100 }];
  expect(scoreDrawing([supplied], [bottom], [supplied])).toEqual(empty);
  expect(scoreDrawing([bottom, supplied], [bottom], [supplied])).toEqual(perfect);
});

test('one traced edge cannot also complete a nearby parallel target edge', () => {
  const nearby = [{ x: 10, y: 20 }, { x: 210, y: 20 }];
  expect(score([top], [top, nearby])).toBe(50);
  expect(scoreDrawing([top, nearby], [top, nearby])).toEqual(perfect);
});

test.each(['one', 'two', 'three'].flatMap(mode =>
  [0.024, 0.04, 0.5, 0.75].map(seed => [mode, seed])
))('%s perspective, seed %s: tracing requires all nine visible edges', (mode, seed) => {
  const camera = createPerspectiveCamera(mode, seed);
  const names = getVisibleFaceNames(camera.position);
  const projectEdges = edges => edges.map(edge => edge.map(point => projectToScreen(point, camera)));
  const targets = projectEdges(getMissingEdges(Object.fromEntries(names.map(name => [name, CUBE_FACES[name]])), []));
  const partial = projectEdges(getMissingEdges(Object.fromEntries(names.slice(0, 2).map(name => [name, CUBE_FACES[name]])), []));
  const length = edges => edges.reduce((sum, [start, end]) => sum + Math.hypot(end.x - start.x, end.y - start.y), 0);
  expect(targets).toHaveLength(9);
  expect(partial).toHaveLength(7);
  expect(scoreDrawing(targets, targets)).toEqual(perfect);
  const partialScore = scoreDrawing(partial, targets);
  expect(partialScore.completeness).toBe(Math.round(length(partial) / length(targets) * 100));
  expect(partialScore.score).toBe(partialScore.completeness);
  expect(scoreDrawing([], targets)).toEqual(empty);
});

test('extra off-target ink reduces cleanliness without hiding a complete, accurate drawing', () => {
  const stray = [{ x: 10, y: 300 }, { x: 410, y: 300 }];
  const result = { score: 50, accuracy: 100, completeness: 100, cleanliness: 50 };
  expect(scoreDrawing([top, bottom, stray], targets)).toEqual(result);
  expect(scoreDrawing([...Array(20).fill(top), bottom, stray], targets)).toEqual(result);
});

test('cleanliness penalties are based on ink length, not the number of pointer events', () => {
  const stray = [{ x: 10, y: 300 }, { x: 410, y: 300 }];
  const denseStray = Array.from({ length: 401 }, (_, index) => ({ x: 10 + index, y: 300 }));
  expect(scoreDrawing([top, bottom, denseStray], targets))
    .toEqual(scoreDrawing([top, bottom, stray], targets));
});

test.each([0.25, 0.5, 2, 10])('all metrics are invariant to uniform scaling by %s and translation', scale => {
  const supplied = [{ x: 10, y: 150 }, { x: 210, y: 150 }];
  const strokes = [[{ x: 10, y: 14 }, { x: 160, y: 14 }], bottom, supplied, [{ x: 10, y: 300 }, { x: 110, y: 300 }]];
  const transform = edges => edges.map(edge => edge.map(point => ({
    x: point.x * scale + 43, y: point.y * scale - 67,
  })));
  expect(scoreDrawing(transform(strokes), transform(targets), transform([supplied])))
    .toEqual(scoreDrawing(strokes, targets, [supplied]));
});

test('drawing extra marks cannot increase the distance tolerance', () => {
  const offset = [{ x: 10, y: 18 }, { x: 210, y: 18 }];
  const baseline = scoreDrawing([offset], [top]);
  const result = scoreDrawing([offset, [{ x: -1000, y: -1000 }, { x: -980, y: -1000 }]], [top]);
  expect(result.accuracy).toBe(baseline.accuracy);
  expect(result.completeness).toBe(baseline.completeness);
  expect(result.cleanliness).toBeLessThan(baseline.cleanliness);
});

test('tiny dashes earn credit only for their actual length, without filling the gaps', () => {
  const dashes = Array.from({ length: 7 }, (_, index) => [
    { x: 10 + index * 30, y: 10 }, { x: 12 + index * 30, y: 10 },
  ]);
  expect(scoreDrawing(dashes, [top])).toEqual({
    score: 7, accuracy: 100, completeness: 7, cleanliness: 100,
  });
});

test('overlapping traced intervals are merged, rather than counted twice', () => {
  const first = [{ x: 10, y: 10 }, { x: 110, y: 10 }];
  const second = [{ x: 60, y: 10 }, { x: 160, y: 10 }];
  expect(scoreDrawing([first, second], [top])).toEqual({
    score: 75, accuracy: 100, completeness: 75, cleanliness: 100,
  });
});

test('a perpendicular crossing does not count as tracing the edge', () => {
  expect(scoreDrawing([[{ x: 110, y: -50 }, { x: 110, y: 70 }]], [top])).toEqual(empty);
});

test('overshooting an edge adds stray ink instead of extra completeness', () => {
  const result = scoreDrawing([[{ x: -90, y: 10 }, { x: 310, y: 10 }]], [top]);
  expect(result.completeness).toBe(100);
  expect(result.accuracy).toBe(100);
  expect(result.cleanliness).toBeCloseTo(50, 0);
  expect(result.score).toBeCloseTo(50, 0);
});

test.each(['one', 'two', 'three'].flatMap(mode =>
  [0.024, 0.559, 0.593, 0.75].flatMap(seed => [1, 2].map(count => [mode, seed, count]))
))('%s perspective, seed %s, %s supplied faces: only missing-edge ink earns credit', (mode, seed, count) => {
  const camera = createPerspectiveCamera(mode, seed);
  const names = getVisibleFaceNames(camera.position);
  const suppliedNames = names.slice(0, count);
  const allFaces = Object.fromEntries(names.map(name => [name, CUBE_FACES[name]]));
  const suppliedFaces = Object.fromEntries(suppliedNames.map(name => [name, CUBE_FACES[name]]));
  const projectEdges = edges => edges.map(edge => edge.map(point => projectToScreen(point, camera)));
  const missing = projectEdges(getMissingEdges(allFaces, suppliedNames));
  const supplied = projectEdges(getMissingEdges(suppliedFaces, []));
  const hatching = Array.from({ length: 18 }, (_, index) => [
    { x: 0, y: 5 + index * 30 }, { x: 760, y: 5 + index * 30 },
  ]);
  expect(scoreDrawing(supplied, missing, supplied)).toEqual(empty);
  expect(scoreDrawing(missing, missing, supplied)).toEqual(perfect);
  const pixelRounded = missing.map(edge => edge.map(point => ({ x: Math.floor(point.x), y: Math.floor(point.y) })));
  const roundedScore = scoreDrawing(pixelRounded, missing, supplied);
  expect(roundedScore.score).toBeGreaterThan(90);
  expect(roundedScore.completeness).toBeGreaterThanOrEqual(95);
  expect(scoreDrawing([...missing, ...supplied], missing, supplied)).toEqual(perfect);
  const hatchedScore = scoreDrawing(hatching, missing, supplied);
  expect(hatchedScore.score).toBeLessThan(20);
  [roundedScore, hatchedScore].forEach(result => {
    Object.values(result).forEach(value => {
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    });
    expect(result.score).toBeLessThanOrEqual(result.completeness);
  });
});
