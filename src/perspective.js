import * as THREE from 'three';
import { CUBE_HALF_SIZE, CUBE_VERTICES } from './cube.js';

export const BOARD_WIDTH = 760;
export const BOARD_HEIGHT = 520;
export const FRAME_PADDING = 64;

export const PERSPECTIVE_MODES = {
  one: {
    label: '1 point',
    description: 'The facing square stays rectangular. Depth edges converge at VP1.',
  },
  two: {
    label: '2 points',
    description: 'Vertical edges stay parallel. The two horizontal directions converge at VP1 and VP2.',
  },
  three: {
    label: '3 points',
    description: 'All three edge directions converge, including the vertical edges.',
  },
};

const AXES = [
  { axis: 'x', direction: [1, 0, 0], color: '#fbbf24' },
  { axis: 'z', direction: [0, 0, 1], color: '#38bdf8' },
  { axis: 'y', direction: [0, 1, 0], color: '#a78bfa' },
];
const EPSILON = 1e-8;

function seededRandom(seed) {
  let state = Math.floor(seed * 4294967296) >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function createCameraPose(mode, random) {
  const sign = () => random() < 0.5 ? -1 : 1;
  const xSign = sign();
  const ySign = sign();
  const zSign = sign();
  const camera = new THREE.PerspectiveCamera(60, BOARD_WIDTH / BOARD_HEIGHT, 0.1, 1000);

  if (mode === 'one') {
    const x = xSign * (2.5 + random() * 2.8);
    const y = ySign * (2.5 + random() * 2.5);
    camera.position.set(x, y, zSign * (8 + random() * 6));
    // Translate without rotating, so only the depth axis has a finite VP.
    camera.lookAt(x, y, 0);
  } else if (mode === 'two') {
    const yaw = THREE.MathUtils.degToRad(25 + random() * 40);
    const radius = (CUBE_HALF_SIZE + 0.55) / Math.min(Math.sin(yaw), Math.cos(yaw)) * (1 + random() * 0.5);
    const y = ySign * (2.6 + random() * 2);
    camera.position.set(xSign * Math.sin(yaw) * radius, y, zSign * Math.cos(yaw) * radius);
    camera.lookAt(0, y, 0);
    camera.translateX((random() - 0.5) * 0.8);
  } else {
    const yaw = THREE.MathUtils.degToRad(25 + random() * 40);
    const pitch = THREE.MathUtils.degToRad(26 + random() * 34);
    const back = new THREE.Vector3(
      xSign * Math.sin(yaw) * Math.cos(pitch),
      ySign * Math.sin(pitch),
      zSign * Math.cos(yaw) * Math.cos(pitch)
    );
    const radius = (CUBE_HALF_SIZE + 0.55) / Math.min(Math.abs(back.x), Math.abs(back.y), Math.abs(back.z))
      * (1 + random() * 0.45);
    camera.position.copy(back.multiplyScalar(radius));
    camera.lookAt(0, 0, 0);
    camera.translateX((random() - 0.5) * 0.5);
    camera.translateY((random() - 0.5) * 0.5);
  }
  camera.updateMatrixWorld();
  return camera;
}

function getBounds(points) {
  return {
    minX: Math.min(...points.map((point) => point.x)),
    maxX: Math.max(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxY: Math.max(...points.map((point) => point.y)),
  };
}

function fitProjection(camera, random) {
  const bounds = getBounds([
    ...CUBE_VERTICES.map((point) => projectToScreen(point, camera)),
    ...getVanishingPoints(camera),
  ]);
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const availableWidth = BOARD_WIDTH - FRAME_PADDING * 2;
  const availableHeight = BOARD_HEIGHT - FRAME_PADDING * 2;
  const scale = Math.min(availableWidth / width, availableHeight / height, 2) * (0.82 + random() * 0.15);
  const centerX = FRAME_PADDING + random() * (availableWidth - width * scale)
    - (bounds.minX - BOARD_WIDTH / 2) * scale;
  const centerY = FRAME_PADDING + random() * (availableHeight - height * scale)
    - (bounds.minY - BOARD_HEIGHT / 2) * scale;
  const focalLength = BOARD_HEIGHT / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));

  // Fit the real projection, not individual markers, so all edges still converge correctly.
  camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(BOARD_HEIGHT / (2 * focalLength * scale)));
  camera.setViewOffset(
    BOARD_WIDTH, BOARD_HEIGHT,
    BOARD_WIDTH / 2 - centerX, BOARD_HEIGHT / 2 - centerY,
    BOARD_WIDTH, BOARD_HEIGHT
  );
  camera.updateMatrixWorld();
}

function framingQuality(camera) {
  const bounds = getBounds(CUBE_VERTICES.map((point) => projectToScreen(point, camera)));
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const markerGap = Math.min(...getVanishingPoints(camera).map((point) => Math.hypot(
    Math.max(bounds.minX - point.x, 0, point.x - bounds.maxX),
    Math.max(bounds.minY - point.y, 0, point.y - bounds.maxY)
  )));
  return Math.min(width / 170, height / 140, 360 / Math.max(width, height), markerGap / 28);
}

export function createPerspectiveCamera(mode, seed) {
  if (!Object.prototype.hasOwnProperty.call(PERSPECTIVE_MODES, mode)) {
    throw new Error(`Unknown perspective mode: ${mode}`);
  }
  const random = seededRandom(seed);
  let bestCamera;
  let bestQuality = -Infinity;
  // Every candidate fits on the board; favor readable shapes with space around the markers.
  for (let attempt = 0; attempt < 96; attempt += 1) {
    const camera = createCameraPose(mode, random);
    fitProjection(camera, random);
    const quality = framingQuality(camera);
    if (quality > bestQuality) {
      bestCamera = camera;
      bestQuality = quality;
    }
    if (quality >= 1) return camera;
  }
  return bestCamera;
}

export function projectToScreen(point, camera) {
  const vector = Array.isArray(point) ? new THREE.Vector3(...point) : point.clone();
  vector.project(camera);
  return {
    x: (vector.x + 1) * BOARD_WIDTH / 2,
    y: (1 - vector.y) * BOARD_HEIGHT / 2,
  };
}

function projectDirection(direction, camera) {
  // Directions have w=0: translating the camera must not move a vanishing point.
  const clip = new THREE.Vector4(...direction, 0)
    .applyMatrix4(camera.matrixWorldInverse)
    .applyMatrix4(camera.projectionMatrix);
  return new THREE.Vector3(
    (clip.x + clip.w) * BOARD_WIDTH / 2,
    (clip.w - clip.y) * BOARD_HEIGHT / 2,
    clip.w
  );
}

export function getVanishingPoints(camera) {
  camera.updateMatrixWorld();
  return AXES.flatMap(({ direction, ...axis }) => {
    const point = projectDirection(direction, camera);
    if (Math.abs(point.z) < EPSILON) return [];
    return [{ ...axis, x: point.x / point.z, y: point.y / point.z }];
  }).map((point, index) => ({ ...point, label: `VP${index + 1}` }));
}

export function getHorizon(camera) {
  camera.updateMatrixWorld();
  const line = projectDirection([1, 0, 0], camera).cross(projectDirection([0, 0, 1], camera));
  const scale = Math.hypot(line.x, line.y);
  if (scale < EPSILON) return null;
  line.divideScalar(scale);
  const intersections = [];
  const addIntersection = (x, y) => {
    if (x < -EPSILON || x > BOARD_WIDTH + EPSILON || y < -EPSILON || y > BOARD_HEIGHT + EPSILON) return;
    const point = { x: Math.max(0, Math.min(BOARD_WIDTH, x)), y: Math.max(0, Math.min(BOARD_HEIGHT, y)) };
    if (!intersections.some((other) => Math.hypot(point.x - other.x, point.y - other.y) < EPSILON)) {
      intersections.push(point);
    }
  };
  if (Math.abs(line.y) > EPSILON) {
    addIntersection(0, -line.z / line.y);
    addIntersection(BOARD_WIDTH, -(line.x * BOARD_WIDTH + line.z) / line.y);
  }
  if (Math.abs(line.x) > EPSILON) {
    addIntersection(-line.z / line.x, 0);
    addIntersection(-(line.y * BOARD_HEIGHT + line.z) / line.x, BOARD_HEIGHT);
  }
  return intersections.length >= 2 ? intersections.slice(0, 2) : null;
}
