import { StrictMode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import * as THREE from 'three';
import App from './App';
import { CUBE_FACES, getVisibleFaceNames } from './cube';
import { getMissingEdges } from './scoring';
import { getVanishingPoints } from './perspective';

// Keep the real Three.js camera, projection, and scene code; jsdom has no GPU.
jest.mock('three', () => ({
  ...jest.requireActual('three'),
  WebGLRenderer: jest.fn(),
}));

let renderers;

function createRenderer() {
  const renderer = {
    domElement: document.createElement('canvas'),
    setClearColor: jest.fn(),
    setSize: jest.fn(),
    setPixelRatio: jest.fn(),
    render: jest.fn(),
    dispose: jest.fn(),
    forceContextLoss: jest.fn(),
  };
  renderers.push(renderer);
  return renderer;
}

function sceneFaces() {
  const scene = renderers[renderers.length - 1].render.mock.calls[0][0];
  const names = [];
  scene.traverse((object) => {
    if (object.isLineLoop) names.push(object.name);
  });
  return names.sort();
}

function drawingCanvas() {
  const canvas = screen.getByLabelText('Drawing canvas');
  const capturedPointers = new Set();
  canvas.setPointerCapture = jest.fn((pointerId) => capturedPointers.add(pointerId));
  canvas.hasPointerCapture = jest.fn((pointerId) => capturedPointers.has(pointerId));
  canvas.releasePointerCapture = jest.fn((pointerId) => {
    capturedPointers.delete(pointerId);
    canvas.dispatchEvent(pointerEvent('lostpointercapture', { x: 0, y: 0 }, { pointerId }));
  });
  jest.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
    left: 0, top: 0, width: 760, height: 520,
  });
  return canvas;
}

function pointerEvent(type, point, { pointerId = 1, pointerType = 'mouse', isPrimary = true, button = 0 } = {}) {
  const event = new MouseEvent(type, {
    bubbles: true, clientX: point.x, clientY: point.y, button,
  });
  Object.defineProperties(event, {
    pointerId: { value: pointerId },
    pointerType: { value: pointerType },
    isPrimary: { value: isPrimary },
    // jsdom's MouseEvent rounds coordinates; real pointer input supports fractions.
    clientX: { value: point.x },
    clientY: { value: point.y },
  });
  return event;
}

function recordInk() {
  const context = {
    ...HTMLCanvasElement.prototype.getContext('2d'),
    lineTo: jest.fn(),
    stroke: jest.fn(),
  };
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
  return context;
}

function expectOverallScore(value) {
  expect(screen.getByLabelText('Overall score')).toHaveTextContent(value === null ? '—' : new RegExp(`^${value}%$`));
}

function project(point) {
  const camera = renderers[renderers.length - 1].render.mock.calls[0][1];
  const screenPoint = new THREE.Vector3(...point).project(camera);
  return { x: (screenPoint.x + 1) * 380, y: (1 - screenPoint.y) * 260 };
}

function drawStroke(canvas, points, finish = true, pointer = {}) {
  points.forEach((point, index) => {
    fireEvent(canvas, pointerEvent(index === 0 ? 'pointerdown' : 'pointermove', point, pointer));
  });
  if (finish) fireEvent(canvas, pointerEvent('pointerup', points[points.length - 1], pointer));
}

function expectedFaces(count = 3) {
  const camera = renderers[renderers.length - 1].render.mock.calls[0][1];
  return getVisibleFaceNames(camera.position).slice(0, count);
}

function missingEdges(count = 2) {
  const names = expectedFaces();
  const faces = Object.fromEntries(names.map(name => [name, CUBE_FACES[name]]));
  return getMissingEdges(faces, names.slice(0, count));
}

beforeEach(() => {
  renderers = [];
  jest.spyOn(Math, 'random').mockReturnValue(0.75);
  THREE.WebGLRenderer.mockImplementation(createRenderer);
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('renders the challenge using a real Three.js scene and camera', () => {
  const { container } = render(<App />);
  expect(screen.getByRole('heading', { name: /3d square/i })).toBeInTheDocument();
  expect(renderers[0].render).toHaveBeenCalledTimes(1);
  const [scene, camera] = renderers[0].render.mock.calls[0];
  expect(scene).toBeInstanceOf(THREE.Scene);
  expect(camera).toBeInstanceOf(THREE.PerspectiveCamera);
  expect(container.querySelector('.scene-layer canvas')).toBeInTheDocument();
  expect(container.querySelector('.drawing-layer')).toBeInTheDocument();
  expect(container.querySelectorAll('polygon')).toHaveLength(2);
  expect(sceneFaces()).toEqual(expectedFaces(2).sort());
  expect(container.querySelectorAll('.vanishing-point')).toHaveLength(2);
  expect(container.querySelectorAll('.perspective-guides line')).toHaveLength(1);
  expect(scene.getObjectByProperty('type', 'GridHelper')).toBeUndefined();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expectOverallScore(null);
  ['Accuracy', 'Completeness', 'Cleanliness'].forEach(label => {
    expect(screen.getByLabelText(`${label} subscore`)).toHaveTextContent('—');
  });
});

test.each([0, 0.25, 0.5, 0.75, 0.999])('aligns the projected guide with the camera at seed %s', (seed) => {
  Math.random.mockReturnValue(seed);
  const { container } = render(<App />);
  const camera = renderers[0].render.mock.calls[0][1].clone();
  camera.updateMatrixWorld();
  const expected = new THREE.Vector3(...CUBE_FACES[expectedFaces()[0]][0]).project(camera);
  const polygons = [...container.querySelectorAll('polygon')].map((polygon) =>
    polygon.getAttribute('points').split(' ').map((point) => point.split(',').map(Number))
  );
  expect(polygons[0][0][0]).toBeCloseTo((expected.x + 1) * 380);
  expect(polygons[0][0][1]).toBeCloseTo((1 - expected.y) * 260);
  polygons.flat().forEach(([x, y]) => {
    expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
    expect(x).toBeGreaterThan(0);
    expect(x).toBeLessThan(760);
    expect(y).toBeGreaterThan(0);
    expect(y).toBeLessThan(520);
  });
});

test('keeps the challenge usable when WebGL initialization fails', () => {
  THREE.WebGLRenderer.mockImplementation(() => {
    throw new Error('WebGL is unavailable');
  });
  const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const { container } = render(<App />);
  expect(screen.getByRole('heading', { name: /3d square/i })).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('You can still draw using the projected guide');
  expect(container.querySelectorAll('polygon')).toHaveLength(2);
  expect(container.querySelector('.drawing-layer')).toBeInTheDocument();
  expect(container.querySelectorAll('.vanishing-point')).toHaveLength(2);
  expect(container.querySelector('.horizon-line')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /score attempt/i }));
  expectOverallScore(0);
  expect(container.querySelectorAll('polygon')).toHaveLength(3);
  expect(warning).toHaveBeenCalled();
});

test('cleans up a failed renderer rather than leaving the page blank', () => {
  THREE.WebGLRenderer.mockImplementation(() => {
    const renderer = createRenderer();
    renderer.render.mockImplementation(() => {
      throw new Error('WebGL rendering failed');
    });
    return renderer;
  });
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  const { container } = render(<App />);
  expect(screen.getByRole('alert')).toBeInTheDocument();
  expect(container.querySelector('.scene-layer')).toBeEmptyDOMElement();
  expect(renderers[0].dispose).toHaveBeenCalledTimes(1);
  expect(renderers[0].forceContextLoss).toHaveBeenCalledTimes(1);
});

test('can submit, reveal the solution, and start again without accumulating canvases', () => {
  const { container } = render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /score attempt/i }));
  expectOverallScore(0);
  expect(container.querySelectorAll('polygon')).toHaveLength(3);
  expect(sceneFaces()).toEqual(expectedFaces().sort());
  expect(screen.getByRole('button', { name: /score attempt/i })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: /clear/i }));
  expect(screen.queryByText('0%')).not.toBeInTheDocument();
  expect(container.querySelectorAll('polygon')).toHaveLength(2);
  expect(sceneFaces()).toEqual(expectedFaces(2).sort());
  expect(screen.getByRole('button', { name: /score attempt/i })).toBeEnabled();
  expect(container.querySelectorAll('.scene-layer canvas')).toHaveLength(1);
  expect(renderers[0].dispose).toHaveBeenCalledTimes(1);
});

test('disposes GPU resources during StrictMode remounting and on unmount', () => {
  const disposeGeometry = jest.spyOn(THREE.BufferGeometry.prototype, 'dispose');
  const disposeMaterial = jest.spyOn(THREE.Material.prototype, 'dispose');
  const { container, unmount } = render(<StrictMode><App /></StrictMode>);
  expect(renderers).toHaveLength(2);
  expect(container.querySelectorAll('.scene-layer canvas')).toHaveLength(1);
  unmount();
  renderers.forEach((renderer) => {
    expect(renderer.dispose).toHaveBeenCalledTimes(1);
    expect(renderer.forceContextLoss).toHaveBeenCalledTimes(1);
  });
  expect(disposeGeometry).toHaveBeenCalled();
  expect(disposeMaterial).toHaveBeenCalled();
});

test('recovers from a renderer initialization failure on a new attempt', () => {
  THREE.WebGLRenderer.mockImplementationOnce(() => {
    throw new Error('WebGL is unavailable');
  });
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  render(<App />);
  expect(screen.getByRole('alert')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /1 face/i }));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(renderers[0].render).toHaveBeenCalled();
});

test.each([
  ['1 face', 1],
  ['2 faces', 2],
])('does not render any hidden face in Three.js or SVG in %s mode', (mode, count) => {
  const { container } = render(<App />);
  fireEvent.click(screen.getByRole('button', { name: mode }));
  expect(sceneFaces()).toEqual(expectedFaces(count).sort());
  expect(container.querySelectorAll('polygon')).toHaveLength(count);
  fireEvent.click(screen.getByRole('button', { name: /score attempt/i }));
  expect(sceneFaces()).toEqual(expectedFaces().sort());
  expect(container.querySelectorAll('polygon')).toHaveLength(3);
});

test.each([1, 2, 3].flatMap((points) => [
  [points, '1 face', 1],
  [points, '2 faces', 2],
]))('awards 100%% for missing edges in %s-point perspective with %s supplied', (points, mode, count) => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: `${points} vanishing point${points === 1 ? '' : 's'}` }));
  fireEvent.click(screen.getByRole('button', { name: mode }));
  const canvas = drawingCanvas();
  missingEdges(count).forEach((edge) => drawStroke(canvas, edge.map(project)));
  fireEvent.click(screen.getByRole('button', { name: /score attempt/i }));
  expectOverallScore(100);
});

test('tracing only the supplied faces cannot complete the challenge', () => {
  const { container } = render(<App />);
  const canvas = drawingCanvas();
  [...container.querySelectorAll('polygon')].forEach((polygon) => {
    const points = polygon.getAttribute('points').split(' ').map((point) => {
      const [x, y] = point.split(',').map(Number);
      return { x, y };
    });
    drawStroke(canvas, [...points, points[0]]);
  });
  fireEvent.click(screen.getByRole('button', { name: /score attempt/i }));
  const score = Number.parseInt(container.querySelector('.score-card strong').textContent, 10);
  expect(score).toBeLessThan(50);
});

test('switching challenges clears old strokes instead of scoring them against the new shape', () => {
  render(<App />);
  const canvas = drawingCanvas();
  missingEdges().forEach((edge) => drawStroke(canvas, edge.map(project)));
  fireEvent.click(screen.getByRole('button', { name: '1 face' }));
  fireEvent.click(screen.getByRole('button', { name: /score attempt/i }));
  expectOverallScore(0);
});

test('submission includes an in-progress stroke and locks the revealed attempt', () => {
  render(<App />);
  const canvas = drawingCanvas();
  missingEdges().forEach((edge, index) => drawStroke(canvas, edge.map(project), index === 0));
  fireEvent.click(screen.getByRole('button', { name: /score attempt/i }));
  expectOverallScore(100);
  expect(canvas).toHaveAttribute('aria-disabled', 'true');
  expect(screen.getByRole('button', { name: /score attempt/i })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: /clear/i }));
  expect(canvas).toHaveAttribute('aria-disabled', 'false');
  fireEvent.click(screen.getByRole('button', { name: /score attempt/i }));
  expectOverallScore(0);
});

test('the revealed answer cannot be traced to improve a submitted score', () => {
  const context = HTMLCanvasElement.prototype.getContext('2d');
  const stroke = jest.fn();
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ ...context, stroke });
  render(<App />);
  const canvas = drawingCanvas();
  fireEvent.click(screen.getByRole('button', { name: /score attempt/i }));
  const calls = stroke.mock.calls.length;
  missingEdges().forEach((edge) => drawStroke(canvas, edge.map(project)));
  fireEvent.click(screen.getByRole('button', { name: /score attempt/i }));
  expectOverallScore(0);
  expect(stroke).toHaveBeenCalledTimes(calls);
});

test('all faces enables drawing and scoring with tracing instructions', () => {
  const context = recordInk();
  const { container } = render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /all faces/i }));
  expect(screen.queryByText('N/A')).not.toBeInTheDocument();
  expect(screen.getByText(/Trace every visible edge as accurately as possible/i)).toBeInTheDocument();
  expect(screen.getByText('Goal: trace all visible edges')).toBeInTheDocument();
  expect(sceneFaces()).toEqual(expectedFaces().sort());
  expect(container.querySelectorAll('polygon')).toHaveLength(3);
  expect(screen.getByRole('button', { name: /score attempt/i })).toBeEnabled();
  const canvas = drawingCanvas();
  expect(canvas).toHaveAttribute('aria-disabled', 'false');
  drawStroke(canvas, [{ x: 100, y: 100 }, { x: 200, y: 200 }]);
  expect(context.stroke).toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: /clear/i }));
  expect(screen.getByRole('button', { name: /all faces/i })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: '1 face' }));
  expect(screen.getByText('Goal: complete the square')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /score attempt/i })).toBeEnabled();
});

test.each([1, 2, 3])('selecting %s-point perspective changes the camera and shows only markers and a horizon', (points) => {
  const { container } = render(<App />);
  const button = screen.getByRole('button', { name: `${points} vanishing point${points === 1 ? '' : 's'}` });
  fireEvent.click(button);
  expect(button).toHaveAttribute('aria-pressed', 'true');
  expect(container.querySelectorAll('.vanishing-point')).toHaveLength(points);
  expect(container.querySelectorAll('.vanishing-arrow')).toHaveLength(0);
  expect(container.querySelectorAll('.vanishing-point circle')).toHaveLength(points);
  expect(container.querySelector('.perspective-guides')).not.toHaveTextContent('off canvas');
  const camera = renderers[renderers.length - 1].render.mock.calls[0][1];
  const actualPoints = getVanishingPoints(camera);
  [...container.querySelectorAll('.vanishing-point circle')].forEach((marker, index) => {
    expect(Number(marker.getAttribute('cx'))).toBeCloseTo(actualPoints[index].x, 8);
    expect(Number(marker.getAttribute('cy'))).toBeCloseTo(actualPoints[index].y, 8);
  });
  expect(container.querySelectorAll('.perspective-guides line')).toHaveLength(1);
  expect(container.querySelectorAll('.guide-layer line')).toHaveLength(9);
  expect(container.querySelector('.grid-layer')).not.toBeInTheDocument();
  const scene = renderers[renderers.length - 1].render.mock.calls[0][0];
  expect(scene.getObjectByProperty('type', 'GridHelper')).toBeUndefined();
  expect(sceneFaces()).toEqual(expectedFaces(2).sort());
});

test('changing perspective clears ink and score but preserves the chosen face count', () => {
  const { container } = render(<App />);
  fireEvent.click(screen.getByRole('button', { name: '1 face' }));
  const canvas = drawingCanvas();
  missingEdges(1).forEach((edge) => drawStroke(canvas, edge.map(project)));
  fireEvent.click(screen.getByRole('button', { name: /score attempt/i }));
  expectOverallScore(100);
  fireEvent.click(screen.getByRole('button', { name: '3 vanishing points' }));
  expectOverallScore(null);
  expect(container.querySelectorAll('polygon')).toHaveLength(1);
  expect(container.querySelectorAll('.vanishing-point')).toHaveLength(3);
  expect(canvas).toHaveAttribute('aria-disabled', 'false');
  fireEvent.click(screen.getByRole('button', { name: /score attempt/i }));
  expectOverallScore(0);
  fireEvent.click(screen.getByRole('button', { name: /clear/i }));
  expect(screen.getByRole('button', { name: '3 vanishing points' })).toHaveAttribute('aria-pressed', 'true');
  expect(container.querySelectorAll('.vanishing-point')).toHaveLength(3);
});

test('vanishing point guides do not depend on hidden faces or change when the solution is revealed', () => {
  const { container } = render(<App />);
  fireEvent.click(screen.getByRole('button', { name: '1 face' }));
  const guides = container.querySelector('.perspective-guides').innerHTML;
  fireEvent.click(screen.getByRole('button', { name: /score attempt/i }));
  expect(container.querySelectorAll('polygon')).toHaveLength(3);
  expect(container.querySelector('.perspective-guides').innerHTML).toBe(guides);
});

test('tracing mode stays selected and clears its previous score when changing perspective', () => {
  const { container } = render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /all faces/i }));
  const canvas = drawingCanvas();
  missingEdges(0).forEach(edge => drawStroke(canvas, edge.map(project)));
  fireEvent.click(screen.getByRole('button', { name: /score attempt/i }));
  expectOverallScore(100);
  fireEvent.click(screen.getByRole('button', { name: '1 vanishing point' }));
  expectOverallScore(null);
  expect(screen.getByRole('button', { name: /all faces/i })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: /score attempt/i })).toBeEnabled();
  expect(container.querySelectorAll('polygon')).toHaveLength(3);
  expect(container.querySelectorAll('.vanishing-point')).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: /score attempt/i }));
  expectOverallScore(0);
});

test.each([1, 2, 3])('tracing all nine unique edges once earns 100%% in %s-point perspective', (points) => {
  const { container } = render(<App />);
  fireEvent.click(screen.getByRole('button', { name: `${points} vanishing point${points === 1 ? '' : 's'}` }));
  fireEvent.click(screen.getByRole('button', { name: /all faces/i }));
  const canvas = drawingCanvas();
  const edges = missingEdges(0);
  expect(edges).toHaveLength(9);
  edges.forEach(edge => drawStroke(canvas, edge.map(project)));
  fireEvent.click(screen.getByRole('button', { name: /score attempt/i }));
  expectOverallScore(100);
  ['Accuracy', 'Completeness', 'Cleanliness'].forEach(label => {
    expect(screen.getByLabelText(`${label} subscore`)).toHaveTextContent(/^100%$/);
  });
  expect(screen.getByText('Trace scored')).toBeInTheDocument();
  expect(screen.getByText(/Strong tracing/i)).toBeInTheDocument();
  expect(container.querySelectorAll('polygon')).toHaveLength(3);
  expect(canvas).toHaveAttribute('aria-disabled', 'true');
  expect(screen.getByRole('button', { name: /score attempt/i })).toBeDisabled();
  drawStroke(canvas, [{ x: 0, y: 0 }, { x: 760, y: 0 }]);
  fireEvent.click(screen.getByRole('button', { name: /score attempt/i }));
  expectOverallScore(100);
  fireEvent.click(screen.getByRole('button', { name: /clear/i }));
  expectOverallScore(null);
  ['Accuracy', 'Completeness', 'Cleanliness'].forEach(label => {
    expect(screen.getByLabelText(`${label} subscore`)).toHaveTextContent('—');
  });
  expect(canvas).toHaveAttribute('aria-disabled', 'false');
  fireEvent.click(screen.getByRole('button', { name: /score attempt/i }));
  expectOverallScore(0);
  expect(screen.getByText(/No trace drawn/i)).toBeInTheDocument();
});

test('empty attempts display zero for every scoring component', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /score attempt/i }));
  expectOverallScore(0);
  ['Accuracy', 'Completeness', 'Cleanliness'].forEach(label => {
    expect(screen.getByLabelText(`${label} subscore`)).toHaveTextContent(/^0%$/);
  });
});

test('the score breakdown explains an accurate but incomplete trace', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /all faces/i }));
  const canvas = drawingCanvas();
  const [start, end] = missingEdges(0)[0].map(project);
  drawStroke(canvas, [start, { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }]);
  fireEvent.click(screen.getByRole('button', { name: /score attempt/i }));
  expect(screen.getByLabelText('Accuracy subscore')).toHaveTextContent(/^100%$/);
  expect(screen.getByLabelText('Cleanliness subscore')).toHaveTextContent(/^100%$/);
  const completeness = Number.parseInt(screen.getByLabelText('Completeness subscore').textContent, 10);
  expect(completeness).toBeGreaterThan(0);
  expect(completeness).toBeLessThan(50);
  expectOverallScore(completeness);
  fireEvent.click(screen.getByRole('button', { name: '1 vanishing point' }));
  ['Accuracy', 'Completeness', 'Cleanliness'].forEach(label => {
    expect(screen.getByLabelText(`${label} subscore`)).toHaveTextContent('—');
  });
});

test('tracing only one face gives partial credit instead of full completion', () => {
  const { container } = render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /all faces/i }));
  const canvas = drawingCanvas();
  const face = CUBE_FACES[expectedFaces()[0]];
  drawStroke(canvas, [...face, face[0]].map(project));
  fireEvent.click(screen.getByRole('button', { name: /score attempt/i }));
  const score = Number.parseInt(container.querySelector('.score-card strong').textContent, 10);
  expect(score).toBeGreaterThan(0);
  expect(score).toBeLessThan(100);
});

test('stray marks reduce the score of an otherwise complete all-faces trace', () => {
  const { container } = render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /all faces/i }));
  const canvas = drawingCanvas();
  missingEdges(0).forEach(edge => drawStroke(canvas, edge.map(project)));
  drawStroke(canvas, [{ x: 0, y: 0 }, { x: 760, y: 0 }]);
  fireEvent.click(screen.getByRole('button', { name: /score attempt/i }));
  expect(Number.parseInt(container.querySelector('.score-card strong').textContent, 10)).toBeLessThan(100);
});

test('the all-faces target cannot be completed by blanket hatching', () => {
  const { container } = render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /all faces/i }));
  const canvas = drawingCanvas();
  for (let y = 5; y < 520; y += 30) drawStroke(canvas, [{ x: 0, y }, { x: 760, y }]);
  fireEvent.click(screen.getByRole('button', { name: /score attempt/i }));
  expect(Number.parseInt(container.querySelector('.score-card strong').textContent, 10)).toBeLessThan(25);
});

test('switching from tracing to completion restores supplied-edge exclusions', () => {
  Math.random.mockReturnValue(0.024);
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: '1 vanishing point' }));
  fireEvent.click(screen.getByRole('button', { name: /all faces/i }));
  const canvas = drawingCanvas();
  missingEdges(0).forEach(edge => drawStroke(canvas, edge.map(project)));
  fireEvent.click(screen.getByRole('button', { name: /score attempt/i }));
  expectOverallScore(100);
  fireEvent.click(screen.getByRole('button', { name: '2 faces' }));
  expectedFaces(2).forEach(name => {
    const face = CUBE_FACES[name];
    drawStroke(canvas, [...face, face[0]].map(project));
  });
  fireEvent.click(screen.getByRole('button', { name: /score attempt/i }));
  expectOverallScore(0);
});

test('all-faces tracing also scores the SVG guide when WebGL is unavailable', () => {
  THREE.WebGLRenderer.mockImplementation(() => { throw new Error('WebGL is unavailable'); });
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  const { container } = render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /all faces/i }));
  const canvas = drawingCanvas();
  [...container.querySelectorAll('polygon')].forEach(polygon => {
    const points = polygon.getAttribute('points').split(' ').map(point => {
      const [x, y] = point.split(',').map(Number);
      return { x, y };
    });
    drawStroke(canvas, [...points, points[0]]);
  });
  fireEvent.click(screen.getByRole('button', { name: /score attempt/i }));
  expect(screen.getByRole('alert')).toBeInTheDocument();
  expectOverallScore(100);
});

test('fast pointer events retain both endpoints and committed strokes before React renders', () => {
  render(<App />);
  const canvas = drawingCanvas();
  const submit = screen.getByRole('button', { name: /score attempt/i });
  act(() => {
    missingEdges().forEach((edge) => {
      const points = edge.map(project);
      points.forEach((point, index) => {
        canvas.dispatchEvent(pointerEvent(index === 0 ? 'pointerdown' : 'pointermove', point));
      });
      canvas.dispatchEvent(pointerEvent('pointerup', points[points.length - 1]));
    });
    submit.click();
  });
  expectOverallScore(100);
});

test('tracing supplied faces in the reported one-point view earns no completion credit', () => {
  Math.random.mockReturnValue(0.024);
  const { container } = render(<App />);
  fireEvent.click(screen.getByRole('button', { name: '1 vanishing point' }));
  const canvas = drawingCanvas();
  [...container.querySelectorAll('polygon')].forEach((polygon) => {
    const points = polygon.getAttribute('points').split(' ').map((point) => {
      const [x, y] = point.split(',').map(Number);
      return { x, y };
    });
    drawStroke(canvas, [...points, points[0]]);
  });
  fireEvent.click(screen.getByRole('button', { name: /score attempt/i }));
  expectOverallScore(0);
});

test('covering the board with hatching does not earn a high accuracy score', () => {
  const { container } = render(<App />);
  const canvas = drawingCanvas();
  for (let y = 5; y < 520; y += 30) {
    drawStroke(canvas, [{ x: 0, y }, { x: 760, y }]);
  }
  fireEvent.click(screen.getByRole('button', { name: /score attempt/i }));
  expect(Number.parseInt(container.querySelector('.score-card strong').textContent, 10)).toBeLessThan(20);
});

test.each([false, true])('other pointers cannot erase or stop the active stroke (other primary: %s)', (isPrimary) => {
  const context = recordInk();
  render(<App />);
  const canvas = drawingCanvas();
  const active = { pointerId: 7, pointerType: 'touch' };
  const other = { pointerId: 8, pointerType: isPrimary ? 'pen' : 'touch', isPrimary };
  drawStroke(canvas, [{ x: 100, y: 180 }, { x: 230, y: 180 }], false, active);
  const calls = context.stroke.mock.calls.length;
  drawStroke(canvas, [{ x: 350, y: 270 }, { x: 440, y: 270 }], true, other);
  fireEvent(canvas, pointerEvent('pointercancel', { x: 0, y: 0 }, other));
  fireEvent(canvas, pointerEvent('lostpointercapture', { x: 0, y: 0 }, other));
  expect(context.stroke).toHaveBeenCalledTimes(calls);
  expect(canvas.setPointerCapture).toHaveBeenCalledTimes(1);
  expect(canvas.hasPointerCapture(7)).toBe(true);
  fireEvent(canvas, pointerEvent('pointermove', { x: 300, y: 180 }, active));
  fireEvent(canvas, pointerEvent('pointerup', { x: 360, y: 180 }, active));
  expect(context.lineTo).toHaveBeenLastCalledWith(360, 180);
  expect(canvas.releasePointerCapture).toHaveBeenCalledWith(7);
  const completedCalls = context.stroke.mock.calls.length;
  fireEvent(canvas, pointerEvent('pointermove', { x: 510, y: 310 }, other));
  expect(context.stroke).toHaveBeenCalledTimes(completedCalls);
});

test.each([
  { button: 2 }, { button: 1 }, { button: 5, pointerType: 'pen' },
  { isPrimary: false, pointerType: 'touch' },
])('ignores non-drawing button or secondary contact %p', (pointer) => {
  const context = recordInk();
  render(<App />);
  const canvas = drawingCanvas();
  drawStroke(canvas, [{ x: 100, y: 100 }, { x: 200, y: 200 }], true, pointer);
  expect(canvas.setPointerCapture).not.toHaveBeenCalled();
  expect(context.lineTo).not.toHaveBeenCalled();
  expect(context.stroke).not.toHaveBeenCalled();
});

test('records release coordinates beyond the last pointer move', () => {
  const context = recordInk();
  render(<App />);
  const canvas = drawingCanvas();
  drawStroke(canvas, [{ x: 100, y: 170 }, { x: 200, y: 170 }], false);
  fireEvent(canvas, pointerEvent('pointerup', { x: 300, y: 170 }));
  expect(context.lineTo).toHaveBeenLastCalledWith(300, 170);
  expect(canvas.hasPointerCapture(1)).toBe(false);
});

test('complete down/up-only strokes render and score even with no intermediate move event', () => {
  render(<App />);
  const canvas = drawingCanvas();
  missingEdges().forEach((edge) => {
    const [start, end] = edge.map(project);
    fireEvent(canvas, pointerEvent('pointerdown', start));
    fireEvent(canvas, pointerEvent('pointerup', end));
  });
  fireEvent.click(screen.getByRole('button', { name: /score attempt/i }));
  expectOverallScore(100);
});

test.each(['pointercancel', 'lostpointercapture'])('%s preserves partial ink without appending bogus coordinates', (type) => {
  const context = recordInk();
  render(<App />);
  const canvas = drawingCanvas();
  drawStroke(canvas, [{ x: 100, y: 170 }, { x: 200, y: 170 }], false);
  fireEvent(canvas, pointerEvent(type, { x: 0, y: 0 }));
  expect(context.lineTo).toHaveBeenLastCalledWith(200, 170);
  expect(canvas.hasPointerCapture(1)).toBe(false);
  const calls = context.stroke.mock.calls.length;
  fireEvent(canvas, pointerEvent('pointermove', { x: 300, y: 170 }));
  fireEvent(canvas, pointerEvent('pointerup', { x: 300, y: 170 }));
  expect(context.stroke).toHaveBeenCalledTimes(calls);
  drawStroke(canvas, [{ x: 400, y: 200 }, { x: 500, y: 200 }], true, { pointerId: 2 });
  const endpoint = context.lineTo.mock.calls[context.lineTo.mock.calls.length - 1];
  expect(endpoint[0]).toBeCloseTo(500);
  expect(endpoint[1]).toBeCloseTo(200);
});

test('captured pointer stays active outside the board without storing invisible off-board ink', () => {
  const context = recordInk();
  render(<App />);
  const canvas = drawingCanvas();
  drawStroke(canvas, [{ x: 100, y: 170 }, { x: 200, y: 170 }], false);
  fireEvent(canvas, pointerEvent('pointerleave', { x: 800, y: 170 }));
  expect(canvas.hasPointerCapture(1)).toBe(true);
  fireEvent(canvas, pointerEvent('pointermove', { x: 850, y: 170 }));
  fireEvent(canvas, pointerEvent('pointerup', { x: 900, y: 170 }));
  expect(context.lineTo).toHaveBeenLastCalledWith(760, 170);
  expect(canvas.hasPointerCapture(1)).toBe(false);
});

test('resetting during a stroke releases capture and ignores its later release', () => {
  render(<App />);
  const canvas = drawingCanvas();
  drawStroke(canvas, [{ x: 100, y: 170 }, { x: 200, y: 170 }], false);
  fireEvent.click(screen.getByRole('button', { name: /clear/i }));
  expect(canvas.releasePointerCapture).toHaveBeenCalledWith(1);
  fireEvent(canvas, pointerEvent('pointerup', { x: 300, y: 170 }));
  fireEvent.click(screen.getByRole('button', { name: /score attempt/i }));
  expectOverallScore(0);
});

test('submitting during a captured stroke releases it without committing duplicate ink', () => {
  render(<App />);
  const canvas = drawingCanvas();
  missingEdges().forEach((edge, index) => drawStroke(canvas, edge.map(project), index === 0));
  expect(canvas.hasPointerCapture(1)).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: /score attempt/i }));
  expect(canvas.hasPointerCapture(1)).toBe(false);
  expectOverallScore(100);
  fireEvent(canvas, pointerEvent('pointerup', { x: 0, y: 0 }));
  expectOverallScore(100);
});
