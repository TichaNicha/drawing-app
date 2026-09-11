import { CUBE_FACES, CUBE_HALF_SIZE, CUBE_VERTICES, getVisibleFaceNames } from './cube';
import { getMissingEdges } from './scoring';

test('defines a closed cube with six equal square faces and twelve unique edges', () => {
  expect(CUBE_VERTICES).toHaveLength(8);
  expect(Object.keys(CUBE_FACES)).toHaveLength(6);
  expect(getMissingEdges(CUBE_FACES, [])).toHaveLength(12);
  Object.values(CUBE_FACES).forEach((face) => {
    expect(face).toHaveLength(4);
    const edges = face.map((start, index) => face[(index + 1) % 4].map((end, axis) => end - start[axis]));
    edges.forEach((edge, index) => {
      expect(Math.hypot(...edge)).toBeCloseTo(CUBE_HALF_SIZE * 2);
      const next = edges[(index + 1) % 4];
      expect(edge.reduce((sum, value, axis) => sum + value * next[axis], 0)).toBeCloseTo(0);
    });
  });
});

test.each([-1, 1].flatMap(x => [-1, 1].flatMap(y => [-1, 1].map(z => [x, y, z]))))(
  'selects only the outward-facing surfaces from octant %s, %s, %s',
  (x, y, z) => {
    const names = getVisibleFaceNames({ x: x * 5, y: y * 5, z: z * 5 });
    expect(names).toEqual([
      z > 0 ? 'front' : 'back',
      x > 0 ? 'right' : 'left',
      y > 0 ? 'top' : 'bottom',
    ]);
    const visible = Object.fromEntries(names.map(name => [name, CUBE_FACES[name]]));
    expect(getMissingEdges(visible, names.slice(0, 1))).toHaveLength(5);
    expect(getMissingEdges(visible, names.slice(0, 2))).toHaveLength(2);
    expect(getMissingEdges(visible, names)).toEqual([]);
  }
);

test('does not expose an edge-on face', () => {
  expect(getVisibleFaceNames({ x: CUBE_HALF_SIZE, y: 5, z: 5 })).toEqual(['front', 'top']);
});
