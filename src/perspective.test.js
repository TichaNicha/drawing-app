import * as THREE from 'three';
import { CUBE_FACES, CUBE_HALF_SIZE, CUBE_VERTICES, getVisibleFaceNames } from './cube';
import {
  BOARD_WIDTH, BOARD_HEIGHT, FRAME_PADDING, createPerspectiveCamera, projectToScreen,
  getVanishingPoints, getHorizon,
} from './perspective';

const modes = [
  ['one', ['z']],
  ['two', ['x', 'z']],
  ['three', ['x', 'z', 'y']],
];
const directions = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };

function distanceFromLine(point, [start, end]) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  return Math.abs(dx * (point.y - start.y) - dy * (point.x - start.x)) / Math.hypot(dx, dy);
}

describe.each(modes)('%s-point perspective', (mode, axes) => {
  test.each([0, 0.001, 0.125, 0.25, 0.5, 0.75, 0.999])('has the right finite VPs and stays framed at seed %s', (seed) => {
    const camera = createPerspectiveCamera(mode, seed);
    expect(camera).toBeInstanceOf(THREE.PerspectiveCamera);
    expect(getVanishingPoints(camera).map((point) => point.axis)).toEqual(axes);
    expect(Math.abs(camera.position.x)).toBeGreaterThan(CUBE_HALF_SIZE);
    expect(Math.abs(camera.position.y)).toBeGreaterThan(CUBE_HALF_SIZE);
    expect(Math.abs(camera.position.z)).toBeGreaterThan(CUBE_HALF_SIZE);
    expect(getVisibleFaceNames(camera.position)).toHaveLength(3);
    const allPoints = [
      ...CUBE_VERTICES.map(point => projectToScreen(point, camera)),
      ...getVanishingPoints(camera),
    ];
    allPoints.forEach(point => {
      expect(Number.isFinite(point.x) && Number.isFinite(point.y)).toBe(true);
      expect(point.x).toBeGreaterThanOrEqual(FRAME_PADDING - 1e-5);
      expect(point.x).toBeLessThanOrEqual(BOARD_WIDTH - FRAME_PADDING + 1e-5);
      expect(point.y).toBeGreaterThanOrEqual(FRAME_PADDING - 1e-5);
      expect(point.y).toBeLessThanOrEqual(BOARD_HEIGHT - FRAME_PADDING + 1e-5);
    });
  });

  test('projected parallel edges converge at the actual, unclamped vanishing points', () => {
    const camera = createPerspectiveCamera(mode, 0.63);
    getVanishingPoints(camera).forEach((point) => {
      for (const start of [[-1, -1, -1], [1, -1, 0]]) {
        const end = start.map((value, index) => value + directions[point.axis][index] * 2);
        const edge = [projectToScreen(start, camera), projectToScreen(end, camera)];
        expect(distanceFromLine(point, edge)).toBeLessThan(1e-6);
      }
    });
  });

  test('the horizon passes through the ground-plane vanishing points', () => {
    const camera = createPerspectiveCamera(mode, 0.63);
    const horizon = getHorizon(camera);
    expect(horizon).toHaveLength(2);
    getVanishingPoints(camera).filter((point) => point.axis !== 'y').forEach((point) => {
      expect(distanceFromLine(point, horizon)).toBeLessThan(1e-6);
    });
    horizon.forEach((point) => {
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(BOARD_WIDTH);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(BOARD_HEIGHT);
    });
  });
});

test('one-point perspective keeps the facing square rectangular', () => {
  const camera = createPerspectiveCamera('one', 0.75);
  const face = CUBE_FACES[getVisibleFaceNames(camera.position)[0]];
  const [a, b, c, d] = face.map((point) => projectToScreen(point, camera));
  expect(a.x).toBeCloseTo(d.x, 8);
  expect(b.x).toBeCloseTo(c.x, 8);
  expect(a.y).toBeCloseTo(b.y, 8);
  expect(c.y).toBeCloseTo(d.y, 8);
  expect(Math.abs(a.x - b.x)).toBeCloseTo(Math.abs(a.y - d.y), 8);
});

test('two-point perspective keeps vertical edges parallel', () => {
  const camera = createPerspectiveCamera('two', 0.75);
  for (const [x, z] of [[-1.8, 1.8], [1.8, 1.8], [1.8, -1.8]]) {
    const bottom = projectToScreen([x, -CUBE_HALF_SIZE, z], camera);
    const top = projectToScreen([x, CUBE_HALF_SIZE, z], camera);
    expect(bottom.x).toBeCloseTo(top.x, 8);
  }
});

test('camera translation alone does not move the vanishing points', () => {
  const camera = createPerspectiveCamera('three', 0.75);
  const before = getVanishingPoints(camera);
  camera.position.add(new THREE.Vector3(3, -2, 1));
  const after = getVanishingPoints(camera);
  before.forEach((point, index) => {
    expect(after[index].x).toBeCloseTo(point.x, 8);
    expect(after[index].y).toBeCloseTo(point.y, 8);
  });
});

test('an off-canvas horizon is omitted rather than clamped to a fake location', () => {
  const camera = new THREE.PerspectiveCamera(40, BOARD_WIDTH / BOARD_HEIGHT, 0.1, 100);
  camera.position.set(0, 10, 10);
  camera.lookAt(0, 0, 0);
  expect(getHorizon(camera)).toBeNull();
});

test('clipping also handles a tilted horizon', () => {
  const camera = createPerspectiveCamera('two', 0.5);
  camera.rotateZ(0.2);
  const horizon = getHorizon(camera);
  expect(horizon).toHaveLength(2);
  getVanishingPoints(camera).filter((point) => point.axis !== 'y').forEach((point) => {
    expect(distanceFromLine(point, horizon)).toBeLessThan(1e-6);
  });
});

test('different seeds give different views without changing the perspective mode', () => {
  for (const [mode] of modes) {
    const first = createPerspectiveCamera(mode, 0.1);
    const second = createPerspectiveCamera(mode, 0.9);
    expect(first.position.equals(second.position)).toBe(false);
    expect(getVanishingPoints(first)).toHaveLength(getVanishingPoints(second).length);
  }
});

test.each(modes)('%s-point sampling covers above, below, left, right, front, and back', (mode) => {
  const cameras = Array.from({ length: 64 }, (_, index) => createPerspectiveCamera(mode, index / 64));
  const octants = new Set(cameras.map(camera => ['x', 'y', 'z'].map(axis => Math.sign(camera.position[axis])).join(',')));
  expect(octants.size).toBe(8);
  for (const axis of ['x', 'y', 'z']) {
    const values = cameras.map(camera => camera.position[axis]);
    expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(6);
  }
  const points = cameras.flatMap(getVanishingPoints);
  expect(Math.max(...points.map(p => p.x)) - Math.min(...points.map(p => p.x))).toBeGreaterThan(250);
  expect(Math.max(...points.map(p => p.y)) - Math.min(...points.map(p => p.y))).toBeGreaterThan(150);
});

test.each(['two', 'three'])('%s-point sampling has substantially varied yaw, not just shifted markers', mode => {
  const cameras = Array.from({ length: 128 }, (_, index) => createPerspectiveCamera(mode, index / 128));
  const yaw = cameras.map(camera => {
    const direction = camera.getWorldDirection(new THREE.Vector3());
    return THREE.MathUtils.radToDeg(Math.atan2(Math.abs(direction.x), Math.abs(direction.z)));
  });
  expect(Math.max(...yaw) - Math.min(...yaw)).toBeGreaterThan(25);
});

test('three-point sampling varies vertical angle as well as viewing from above and below', () => {
  const cameras = Array.from({ length: 64 }, (_, index) => createPerspectiveCamera('three', index / 64));
  const pitch = cameras.map(camera => {
    const direction = camera.getWorldDirection(new THREE.Vector3());
    return THREE.MathUtils.radToDeg(Math.asin(Math.abs(direction.y)));
  });
  expect(Math.max(...pitch) - Math.min(...pitch)).toBeGreaterThan(20);
});

test('a seed produces reproducible geometry regardless of unrelated random calls', () => {
  const first = createPerspectiveCamera('three', 0.37);
  Math.random();
  Math.random();
  const second = createPerspectiveCamera('three', 0.37);
  expect(second.position.equals(first.position)).toBe(true);
  expect(second.projectionMatrix.elements).toEqual(first.projectionMatrix.elements);
  expect(getVanishingPoints(second)).toEqual(getVanishingPoints(first));
});

test.each(modes)('%s-point fitting keeps every VP and cube corner inside across a large seed sample', mode => {
  for (let index = 0; index < 200; index += 1) {
    const camera = createPerspectiveCamera(mode, index / 200);
    const points = [...getVanishingPoints(camera), ...CUBE_VERTICES.map(point => projectToScreen(point, camera))];
    expect(points.every(point =>
      point.x >= FRAME_PADDING - 1e-5 && point.x <= BOARD_WIDTH - FRAME_PADDING + 1e-5
      && point.y >= FRAME_PADDING - 1e-5 && point.y <= BOARD_HEIGHT - FRAME_PADDING + 1e-5
    )).toBe(true);
  }
});
